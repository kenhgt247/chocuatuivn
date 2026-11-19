/**
 * Bản đồ cộng đồng.
 * - Nền: OpenFreeMap (miễn phí, không cần khoá), vẽ bằng MapLibre tải từ CDN khi mở bản đồ.
 * - Mỗi tin là một vòng tròn mờ (~700 m) vì vị trí đã làm tròn, không phải địa chỉ nhà.
 * - Nhiều tin cùng chỗ (thường là tâm xã/phường) gộp thành một nhóm có số đếm.
 * - Tên địa danh tiếng Việt; ẩn ranh giới trên biển và nhãn của bản đồ gốc quanh hai quần đảo,
 *   rồi tự ghi "Quần đảo Hoàng Sa (Việt Nam)", "Quần đảo Trường Sa (Việt Nam)".
 * - "Gần tôi" chỉ dùng GPS trên máy để sắp xếp, không gửi đi đâu.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CommunityListing, CommunityKind } from '../services/community';
import { KIcon, KIND_META, IntentBadge, kindText } from './CommunityUI';
import { tinPath, thumbOf } from '../utils/format';
import { wardFromLabel, distanceKm, type Ward } from '../utils/dvhc';
import { wardShape } from '../utils/ranhgioi';

const MAP_STYLE: string = (import.meta as any).env?.VITE_MAP_STYLE || 'https://tiles.openfreemap.org/styles/positron';
const LIB = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl';
const GREEN = '#1F6F43';
const AMBER = '#D9932A';

let libPromise: Promise<any> | null = null;
function loadMapLibre(): Promise<any> {
  const w = window as any;
  if (w.maplibregl) return Promise.resolve(w.maplibregl);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-maplibre]')) {
        const css = document.createElement('link');
        css.rel = 'stylesheet'; css.href = LIB + '.css'; css.setAttribute('data-maplibre', '');
        document.head.appendChild(css);
      }
      const s = document.createElement('script');
      s.src = LIB + '.js'; s.async = true;
      const t = setTimeout(() => reject(new Error('timeout')), 20000);
      s.onload = () => { clearTimeout(t); w.maplibregl ? resolve(w.maplibregl) : reject(new Error('no lib')); };
      s.onerror = () => { clearTimeout(t); reject(new Error('load')); };
      document.head.appendChild(s);
    }).catch(e => { libPromise = null; throw e; });
  }
  return libPromise;
}

/** Vùng biển quanh hai quần đảo: ẩn nhãn/ranh giới của bản đồ gốc ở đây, thay bằng nhãn của mình. */
const SEA_MASK = {
  type: 'MultiPolygon',
  coordinates: [
    [[[110.6, 15.3], [113.3, 15.3], [113.3, 17.5], [110.6, 17.5], [110.6, 15.3]]],
    [[[111.0, 6.4], [117.6, 6.4], [117.6, 12.3], [111.0, 12.3], [111.0, 6.4]]],
  ],
};
const ISLANDS = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { t: 'Quần đảo Hoàng Sa\n(Việt Nam)' }, geometry: { type: 'Point', coordinates: [112.0, 16.45] } },
    { type: 'Feature', properties: { t: 'Quần đảo Trường Sa\n(Việt Nam)' }, geometry: { type: 'Point', coordinates: [114.2, 9.9] } },
  ],
};
const VN_VIEW = { center: [106.4, 15.9] as [number, number], zoom: 4.4 };
const EMPTY = { type: 'FeatureCollection', features: [] as any[] };

/** Chỉnh nền bản đồ: màu kem–xanh, tên tiếng Việt, bỏ ranh giới tranh chấp/trên biển. */
function patchBaseStyle(map: any) {
  const layers: any[] = map.getStyle()?.layers || [];
  const name = ['coalesce', ['get', 'name:vi'], ['get', 'name:latin'], ['get', 'name']];
  const outside = ['!', ['within', SEA_MASK]];
  for (const l of layers) {
    try {
      if (l.type === 'symbol' && l.source === 'openmaptiles') {
        const tf = l.layout?.['text-field'];
        if (tf && JSON.stringify(tf).includes('name')) map.setLayoutProperty(l.id, 'text-field', name);
        map.setFilter(l.id, l.filter ? ['all', l.filter, outside] : outside);
      }
      if (l['source-layer'] === 'boundary') {
        if (l.id === 'boundary_2') map.setFilter(l.id, ['all', l.filter, outside]);
        else map.setLayoutProperty(l.id, 'visibility', 'none');
      }
    } catch (_) { /* lớp lạ: bỏ qua */ }
  }
  const paint: [string, string, any][] = [
    ['background', 'background-color', '#F6F1E4'],
    ['water', 'fill-color', '#CFE2DE'],
    ['park', 'fill-color', '#E2ECD6'],
    ['landcover_wood', 'fill-color', '#E2ECD6'],
    ['landuse_residential', 'fill-color', '#F1EADA'],
    ['building', 'fill-color', '#ECE3D0'],
  ];
  for (const [id, prop, v] of paint) { try { if (map.getLayer(id)) map.setPaintProperty(id, prop, v); } catch (_) { /* bỏ qua */ } }
}

type Pt = { lat: number; lng: number };
type Props = { items: CommunityListing[]; area: string };

function kmText(d?: number) {
  if (d == null || !Number.isFinite(d)) return '';
  return d < 1 ? 'dưới 1 km' : '~' + (d < 10 ? d.toFixed(1).replace('.', ',') : Math.round(d)) + ' km';
}
function hasPt(x: CommunityListing) { return typeof x.lat === 'number' && typeof x.lng === 'number'; }

function Thumb({ item, size = 'h-14 w-14' }: { item: CommunityListing; size?: string }) {
  const kind = (item.communityKind || 'gift') as CommunityKind;
  const img = thumbOf(item);
  return img
    ? <img src={img} alt="" loading="lazy" className={size + ' rounded-xl object-cover shrink-0'} />
    : <span className={size + ' rounded-xl grid place-items-center text-emerald-700 shrink-0 ' + KIND_META[kind].tint}><KIcon name={kind} className="w-6 h-6" /></span>;
}

function Row({ item, dist, active, onClick }: { item: CommunityListing; dist?: number; active?: boolean; onClick: () => void; key?: React.Key }) {
  const kind = (item.communityKind || 'gift') as CommunityKind;
  return <button onClick={onClick} data-id={item.id}
    className={'w-full flex gap-3 p-2.5 rounded-xl text-left transition-colors ' + (active ? 'bg-emerald-50 ring-1 ring-emerald-700' : 'hover:bg-cream')}>
    <Thumb item={item} />
    <span className="min-w-0 flex-1 flex flex-col gap-1">
      <IntentBadge kind={kind} intent={item.communityIntent} className="self-start" />
      <span className="text-[15px] font-bold leading-snug line-clamp-2">{item.title}</span>
      <span className="text-xs text-slate-600 truncate">{[kmText(dist), (item.location || '').split(',')[0]].filter(Boolean).join(' · ')}</span>
    </span>
  </button>;
}

function Picked({ item, dist, onClose }: { item: CommunityListing; dist?: number; onClose: () => void }) {
  const kind = (item.communityKind || 'gift') as CommunityKind;
  return <div className="bg-white rounded-2xl shadow-xl border border-line p-3 flex gap-3 items-start">
    <Thumb item={item} size="h-20 w-20" />
    <div className="min-w-0 flex-1">
      <IntentBadge kind={kind} intent={item.communityIntent} />
      <p className="font-bold leading-snug line-clamp-2 mt-1">{item.title}</p>
      <p className="text-xs text-slate-600 truncate mt-0.5">{[kmText(dist), (item.location || '').split(',')[0]].filter(Boolean).join(' · ')}</p>
      <Link to={tinPath(item)} className="inline-flex items-center mt-2 h-10 px-4 rounded-full bg-emerald-700 text-white text-sm font-bold">
        {item.communityIntent === 'need' ? 'Xem & giúp' : 'Xem & hỏi ' + kindText(kind, 'have').toLowerCase()}
      </Link>
    </div>
    <button onClick={onClose} aria-label="Đóng" className="h-9 w-9 -mr-1 -mt-1 grid place-items-center rounded-full hover:bg-cream"><KIcon name="x" className="w-5 h-5" /></button>
  </div>;
}

const CommunityMap: React.FC<Props> = ({ items, area }) => {
  const box = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const readyRef = useRef(false);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ward, setWard] = useState<Ward | null>(null);
  const [me, setMe] = useState<Pt | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null); // w,s,e,n
  const [moved, setMoved] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [group, setGroup] = useState<string[] | null>(null);
  const [sheet, setSheet] = useState(false);

  const onMap = useMemo(() => items.filter(hasPt), [items]);
  const byId = useMemo(() => Object.fromEntries(items.map(x => [x.id, x])), [items]);
  const origin: Pt | null = me || (ward ? { lat: ward.lat, lng: ward.lng } : null);
  const dist = (x: CommunityListing) => origin && hasPt(x) ? distanceKm(origin.lat, origin.lng, x.lat as number, x.lng as number) : undefined;

  const shown = useMemo(() => {
    let list = group ? group.map(id => byId[id]).filter(Boolean) as CommunityListing[]
      : bounds ? onMap.filter(x => (x.lng as number) >= bounds[0] && (x.lng as number) <= bounds[2] && (x.lat as number) >= bounds[1] && (x.lat as number) <= bounds[3])
      : items;
    if (origin) list = [...list].sort((a, b) => (dist(a) ?? 1e9) - (dist(b) ?? 1e9));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, onMap, byId, bounds, group, origin?.lat, origin?.lng]);

  /* Khởi tạo bản đồ */
  useEffect(() => {
    let alive = true;
    loadMapLibre().then(ml => {
      if (!alive || !box.current) return;
      const map = new ml.Map({
        container: box.current, style: MAP_STYLE, center: VN_VIEW.center, zoom: VN_VIEW.zoom,
        minZoom: 3, maxZoom: 17, attributionControl: false, dragRotate: false, pitchWithRotate: false,
        cooperativeGestures: false,
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right');
      map.on('error', (e: any) => { if (!readyRef.current && /style|fetch|network/i.test(String(e?.error?.message || ''))) setFailed(true); });
      map.on('load', () => {
        if (!alive) return;
        patchBaseStyle(map);
        map.addSource('xa', { type: 'geojson', data: EMPTY });
        map.addLayer({ id: 'xa-nen', type: 'fill', source: 'xa', paint: { 'fill-color': GREEN, 'fill-opacity': 0.05 } });
        map.addLayer({ id: 'xa-vien', type: 'line', source: 'xa', paint: { 'line-color': GREEN, 'line-width': 2, 'line-opacity': 0.8, 'line-dasharray': [2, 1.5] } });
        map.addSource('tin', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 44, clusterMaxZoom: 15 });
        const color = ['match', ['get', 'intent'], 'need', AMBER, GREEN];
        // ~700 m bán kính (vĩ độ Việt Nam), không nhỏ hơn vài điểm ảnh khi thu nhỏ
        const radius = ['interpolate', ['exponential', 2], ['zoom'], 5, 6, 11, 10, 18, 1280];
        map.addLayer({ id: 'tin-mo', type: 'circle', source: 'tin', filter: ['!', ['has', 'point_count']],
          paint: { 'circle-radius': radius, 'circle-color': color, 'circle-opacity': 0.16, 'circle-blur': 0.25,
            'circle-stroke-width': 1.5, 'circle-stroke-color': color, 'circle-stroke-opacity': 0.4 } });
        map.addLayer({ id: 'tin-cham', type: 'circle', source: 'tin', filter: ['!', ['has', 'point_count']],
          paint: { 'circle-radius': 6, 'circle-color': color, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#fff' } });
        map.addLayer({ id: 'tin-chon', type: 'circle', source: 'tin', filter: ['==', ['get', 'id'], ''],
          paint: { 'circle-radius': 11, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 3, 'circle-stroke-color': '#1D2A22' } });
        map.addLayer({ id: 'nhom', type: 'circle', source: 'tin', filter: ['has', 'point_count'],
          paint: { 'circle-radius': ['step', ['get', 'point_count'], 17, 5, 21, 20, 26], 'circle-color': GREEN,
            'circle-stroke-width': 3, 'circle-stroke-color': '#fff', 'circle-opacity': 0.95 } });
        map.addLayer({ id: 'nhom-so', type: 'symbol', source: 'tin', filter: ['has', 'point_count'],
          layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 14, 'text-allow-overlap': true },
          paint: { 'text-color': '#fff' } });
        map.addSource('toi', { type: 'geojson', data: EMPTY });
        map.addLayer({ id: 'toi-quang', type: 'circle', source: 'toi', paint: { 'circle-radius': 18, 'circle-color': '#2F6FD6', 'circle-opacity': 0.15 } });
        map.addLayer({ id: 'toi', type: 'circle', source: 'toi', paint: { 'circle-radius': 7, 'circle-color': '#2F6FD6', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } });
        map.addSource('dao', { type: 'geojson', data: ISLANDS });
        map.addLayer({ id: 'dao', type: 'symbol', source: 'dao', minzoom: 3,
          layout: { 'text-field': ['get', 't'], 'text-font': ['Noto Sans Italic'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 8, 14],
            'text-allow-overlap': true, 'text-ignore-placement': true, 'text-max-width': 14 },
          paint: { 'text-color': '#2D5B57', 'text-halo-color': '#F6F1E4', 'text-halo-width': 1.5 } });

        const pick = (id: string) => { setGroup(null); setSel(id); };
        map.on('click', 'tin-cham', (e: any) => pick(e.features[0].properties.id));
        map.on('click', 'tin-mo', (e: any) => { if (!map.queryRenderedFeatures(e.point, { layers: ['tin-cham', 'nhom'] }).length) pick(e.features[0].properties.id); });
        map.on('click', 'nhom', async (e: any) => {
          const f = e.features[0]; const src = map.getSource('tin');
          try {
            const leaves: any[] = await src.getClusterLeaves(f.properties.cluster_id, 100, 0);
            const [x0, y0] = leaves[0].geometry.coordinates;
            const same = leaves.every(l => Math.abs(l.geometry.coordinates[0] - x0) < 2e-3 && Math.abs(l.geometry.coordinates[1] - y0) < 2e-3);
            const z = await src.getClusterExpansionZoom(f.properties.cluster_id);
            if (same || z > 15) { setSel(null); setGroup(leaves.map(l => l.properties.id)); setSheet(true); map.easeTo({ center: f.geometry.coordinates }); }
            else map.easeTo({ center: f.geometry.coordinates, zoom: z + 0.3 });
          } catch (_) { /* bỏ qua */ }
        });
        for (const id of ['tin-cham', 'tin-mo', 'nhom']) {
          map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
        }
        map.on('dragstart', () => setMoved(true));
        map.on('zoomstart', (e: any) => { if (e.originalEvent) setMoved(true); });
        readyRef.current = true;
        setReady(true);
      });
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; readyRef.current = false; try { mapRef.current?.remove(); } catch (_) { /* bỏ qua */ } mapRef.current = null; };
  }, []);

  /* Xã/phường đang chọn → viền + căn bản đồ */
  useEffect(() => {
    let alive = true;
    wardFromLabel(area).then(w => { if (alive) setWard(w); }).catch(() => { if (alive) setWard(null); });
    return () => { alive = false; };
  }, [area]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let alive = true;
    (async () => {
      const shape = ward ? await wardShape(ward.provinceCode, ward.code) : null;
      if (!alive) return;
      map.getSource('xa')?.setData(shape || EMPTY);
      if (ward) {
        const [s, w, n, e] = ward.bbox;
        map.fitBounds([[w, s], [e, n]], { padding: 40, maxZoom: 14, duration: fittedRef.current ? 800 : 0 });
        fittedRef.current = true;
      } else if (!fittedRef.current && onMap.length) {
        const xs = onMap.map(x => x.lng as number), ys = onMap.map(x => x.lat as number);
        map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 50, maxZoom: 13, duration: 0 });
        fittedRef.current = true;
      }
      setMoved(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ward]);

  /* Dữ liệu tin */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getSource('tin')?.setData({
      type: 'FeatureCollection',
      features: onMap.map(x => ({ type: 'Feature', properties: { id: x.id, intent: x.communityIntent || 'have' }, geometry: { type: 'Point', coordinates: [x.lng, x.lat] } })),
    });
  }, [ready, onMap]);

  /* Tin đang chọn */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter('tin-chon', ['==', ['get', 'id'], sel || '']);
    if (sel) {
      const it = byId[sel];
      if (it && hasPt(it)) map.easeTo({ center: [it.lng, it.lat], zoom: Math.max(map.getZoom(), 13) });
      listRef.current?.querySelector('[data-id="' + sel + '"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sel]);

  /* Vị trí của tôi (chỉ trên máy) */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getSource('toi')?.setData(me ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [me.lng, me.lat] } } : EMPTY);
  }, [ready, me]);

  const nearMe = () => {
    if (!navigator.geolocation) { setNotice('Máy của bạn không hỗ trợ định vị. Hãy chọn xã/phường ở đầu trang.'); return; }
    setLocating(true); setNotice('');
    navigator.geolocation.getCurrentPosition(p => {
      setLocating(false);
      const pt = { lat: p.coords.latitude, lng: p.coords.longitude };
      setMe(pt); setBounds(null); setGroup(null); setSel(null); setMoved(false);
      const acc = p.coords.accuracy || 0;
      mapRef.current?.flyTo({ center: [pt.lng, pt.lat], zoom: acc > 1500 ? 12 : 13.5 });
      setNotice(acc > 1500
        ? 'Máy chỉ đoán được vị trí trong khoảng ' + (Math.round(acc / 100) / 10).toString().replace('.', ',') + ' km (máy tính thường đoán theo Wi‑Fi nên hay lệch). Chấm xanh dương có thể chưa đúng chỗ bạn — hãy chọn xã/phường ở đầu trang để chính xác hơn.'
        : 'Đã sắp tin theo khoảng cách. Vị trí chỉ dùng trên máy bạn, không gửi đi.');
    }, () => {
      setLocating(false);
      setNotice('Chưa lấy được vị trí. Hãy bật định vị hoặc chọn xã/phường ở đầu trang.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  const searchHere = () => {
    const map = mapRef.current; if (!map) return;
    const b = map.getBounds();
    setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    setGroup(null); setSel(null); setMoved(false); setSheet(true);
  };
  const showAll = () => { setBounds(null); setGroup(null); };

  const selItem = sel ? byId[sel] : null;
  const title = group ? group.length + ' tin ở cùng khu vực' : bounds ? shown.length + ' tin trong vùng đang xem' : (origin ? 'Tin gần ' + (me ? 'bạn' : (ward?.name || 'đây')) : 'Tất cả tin');
  const List = <>
    {shown.length ? shown.map(x => <Row key={x.id} item={x} dist={dist(x)} active={x.id === sel} onClick={() => { setSel(x.id); setSheet(false); }} />)
      : <p className="text-sm text-slate-600 p-4 text-center">Chưa có tin nào ở vùng này. Thử kéo bản đồ rộng ra rồi bấm "Tìm trong khu vực này".</p>}
  </>;
  const filterChip = (group || bounds) && <button onClick={showAll} className="text-sm font-semibold text-emerald-700 min-h-9 px-2">Xem tất cả</button>;

  if (failed) {
    return <div className="flex flex-col gap-3">
      <p className="bg-sun-light text-sun-dark rounded-2xl p-3 text-sm">Chưa tải được bản đồ (mạng chậm hoặc dịch vụ bản đồ đang bận). Đây là danh sách tin.</p>
      <div className="bg-white border border-line rounded-2xl p-2">{List}</div>
    </div>;
  }

  return <div className="md:grid md:grid-cols-[340px_1fr] lg:grid-cols-[380px_1fr] md:gap-4">
    <style>{`.ccut-map .maplibregl-ctrl-bottom-right{margin-bottom:84px}.ccut-map .maplibregl-ctrl-group{border-radius:14px;overflow:hidden}
      .ccut-map .maplibregl-ctrl-group button{width:40px;height:40px}
      @media(min-width:768px){.ccut-map .maplibregl-ctrl-bottom-right{margin-bottom:0}}`}</style>

    {/* Danh sách bên trái (máy tính) */}
    <aside className="hidden md:flex flex-col h-[640px] bg-white border border-line rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line">
        <h3 className="font-extrabold">{title}</h3>{filterChip}
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">{List}</div>
    </aside>

    {/* Bản đồ */}
    <div className="ccut-map relative h-[calc(100dvh-240px)] min-h-[440px] md:h-[640px] rounded-2xl overflow-hidden border border-line bg-[#F6F1E4]">
      <div className="absolute inset-0"><div ref={box} className="w-full h-full" aria-label="Bản đồ tin cộng đồng" /></div>
      {!ready && <div className="absolute inset-0 grid place-items-center text-slate-600 text-sm">
        <span className="flex items-center gap-2"><span className="h-4 w-4 rounded-full border-2 border-emerald-700 border-t-transparent animate-spin" />Đang mở bản đồ…</span>
      </div>}

      <div className="absolute top-3 left-3 right-16 flex flex-wrap items-start gap-2 pointer-events-none">
        <button onClick={nearMe} disabled={locating}
          className="pointer-events-auto h-10 px-3.5 rounded-full bg-white shadow-md border border-line text-sm font-bold flex items-center gap-1.5 text-ink disabled:opacity-60">
          <KIcon name="locate" className="w-[18px] h-[18px] text-[#2F6FD6]" />{locating ? 'Đang tìm…' : 'Gần tôi'}
        </button>
        {moved && ready && <button onClick={searchHere}
          className="pointer-events-auto h-10 px-4 rounded-full bg-emerald-700 text-white shadow-md text-sm font-bold flex items-center gap-1.5">
          <KIcon name="search" className="w-4 h-4" />Tìm trong khu vực này
        </button>}
      </div>
      {notice && <div className="absolute top-16 left-3 right-3 md:right-auto md:max-w-sm bg-white/95 border border-line shadow rounded-xl px-3 py-2 text-[13px] text-slate-700 flex gap-2 items-start">
        <span className="flex-1">{notice}</span>
        <button onClick={() => setNotice('')} aria-label="Đóng"><KIcon name="x" className="w-4 h-4" /></button>
      </div>}

      {/* Chú thích (máy tính) */}
      <div className="hidden md:block absolute bottom-3 left-3 bg-white/95 border border-line rounded-xl px-3 py-2 text-xs text-slate-700 shadow max-w-[260px]">
        <div className="flex items-center gap-3 font-semibold">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: GREEN }} />Tôi có</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: AMBER }} />Tôi cần</span>
          <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded-full bg-emerald-700 text-white text-[9px] grid place-items-center font-bold">3</span>Nhóm tin</span>
        </div>
        <p className="mt-1 leading-snug">Vòng tròn mờ là khu vực gần đúng (~1 km), không phải địa chỉ nhà.</p>
      </div>

      {/* Tin đang chọn */}
      {selItem && <div className="absolute left-3 right-3 bottom-[88px] md:bottom-auto md:top-16 md:left-auto md:right-14 md:w-[340px] z-10">
        <Picked item={selItem} dist={dist(selItem)} onClose={() => setSel(null)} />
      </div>}

      {/* Danh sách trượt lên (điện thoại) */}
      <div className={'md:hidden absolute inset-x-0 bottom-0 z-20 bg-white rounded-t-3xl shadow-[0_-6px_24px_rgba(0,0,0,0.12)] flex flex-col transition-[max-height] duration-300 ' + (sheet ? 'max-h-[62%]' : 'max-h-[76px]')}>
        <button onClick={() => setSheet(v => !v)} className="w-full pt-2 pb-3 px-4 flex flex-col items-center gap-2" aria-expanded={sheet}>
          <span className="h-1.5 w-10 rounded-full bg-line" />
          <span className="w-full flex items-center justify-between">
            <span className="font-extrabold">{title}</span>
            <span className="text-sm font-semibold text-emerald-700">{sheet ? 'Thu gọn' : 'Xem danh sách'}</span>
          </span>
        </button>
        {sheet && <div className="overflow-y-auto px-2 pb-3 flex flex-col gap-1">
          {(group || bounds) && <div className="flex justify-end -mt-2">{filterChip}</div>}
          {List}
        </div>}
      </div>
    </div>
  </div>;
};

export default CommunityMap;
