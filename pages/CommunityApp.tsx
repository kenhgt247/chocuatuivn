/**
 * Chợ Của Tui — các trang cộng đồng: Khám phá, Đăng tin, Chi tiết tin, Yêu cầu, Đã lưu.
 * Thiết kế: nền kem, xanh lá đậm, vàng nắng; hai nút chính "Tôi có" / "Tôi cần".
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cachedPage, loadPage, rememberScope, type Scope } from '../utils/feed';
import ShareModal from '../components/ShareModal';
import PhotoViewer from '../components/PhotoViewer';
import PullToRefresh from '../components/PullToRefresh';
import { parseVoicePost } from '../utils/voicePost';
import { ThanksList, ThankButton } from '../components/Thanks';
import { BadgeRow } from '../components/Badges';
import { db } from '../services/db';
import {
  community, kindLabels, statusLabels, MAX_PHOTOS, safetyNotes,
  type CommunityKind, type CommunityIntent, type CommunityListing, type CommunityRequest, type ThankNote
} from '../services/community';
import { KIcon, KIND_META, kindText, IntentBadge, Steps, RequestActions, SafetyBox, VoiceButton } from '../components/CommunityUI';
import { getArea, getAreaPoint, onAreaChange, sameArea, setArea, getRadius, shortArea } from '../utils/area';
import { AreaInput } from '../components/AreaInput';
import { wardFromLabel, provinceFromLabel, distanceKm, type Ward } from '../utils/dvhc';
import { formatTimeAgo, tinPath, thumbOf, slugify } from '../utils/format';
import type { User, PublicProfile } from '../types';
const CommunityMap = React.lazy(() => import('../components/CommunityMap'));
async function findBannedWord(text: string): Promise<string | null> {
  try {
    const { default: list } = await import('../functions/tu-cam.json');
    const t = ' ' + text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9+]+/g, ' ').trim() + ' ';
    for (const [name, words] of Object.entries((list as any).cam as Record<string, string[]>)) if (words.some(w => t.includes(' ' + w + ' '))) return name;
  } catch (_) { /* bỏ qua */ }
  return null;
}

const KINDS: CommunityKind[] = ['gift', 'borrow', 'help', 'repair'];
const MEET_PLACES = ['Cổng chợ', 'Cổng trường', 'Nhà văn hoá', 'UBND phường/xã', 'Gửi tiệm tạp hoá', 'Tại nhà'];

const btnPrimary = 'min-h-12 rounded-2xl px-5 font-bold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60';
const btnLight = 'min-h-12 rounded-2xl px-5 font-bold bg-white border border-line text-ink hover:bg-cream';
const inputCls = 'w-full min-h-12 rounded-[14px] border border-[#C9C1AE] bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-600';

function ErrorMessage({ message }: { message: string }) {
  return <p role="alert" className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">{message}</p>;
}
function AuthRequired() {
  return <div className="max-w-md mx-auto rounded-3xl bg-white border border-line p-8 text-center">
    <img src="/icons/icon-192.png" alt="" className="h-14 w-14 rounded-2xl mx-auto" />
    <h1 className="text-2xl font-extrabold mt-4">Đăng nhập để tiếp tục</h1>
    <p className="text-slate-600 mt-2">Xem tin không cần tài khoản. Chỉ đăng tin và liên hệ mới cần đăng nhập.</p>
    <Link className={btnPrimary + ' inline-flex items-center mt-5'} to="/login">Đăng nhập miễn phí</Link>
  </div>;
}

function useArea(user?: User | null) {
  const [area, setArea] = useState(() => getArea(user?.location || ''));
  useEffect(() => onAreaChange(() => setArea(getArea(user?.location || ''))), [user?.location]);
  useEffect(() => { if (!getArea('') && user?.location) setArea(user.location); }, [user?.location]);
  return area;
}
function metaLine(item: CommunityListing, area: string) {
  const where = sameArea(item.location, area) ? 'Cùng khu vực' : (item.location || '').split(',')[0];
  const when = item.createdAt ? formatTimeAgo(String(item.createdAt)) : '';
  return [where, when].filter(Boolean).join(' · ');
}

/* ---------------- Thẻ tin ---------------- */
function Card({ item, area = '', eager = false, extra = '' }: { item: CommunityListing; area?: string; eager?: boolean; extra?: string; key?: React.Key }) {
  const kind = (item.communityKind || 'gift') as CommunityKind;
  const img = thumbOf(item);
  return <Link to={tinPath(item)} className="flex flex-col bg-white rounded-2xl overflow-hidden border border-line hover:shadow-md transition-shadow">
    {img
      ? <img src={img} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" {...(eager ? { fetchpriority: 'high' } as any : {})} width={480} height={360} className="h-[108px] sm:h-40 w-full object-cover bg-[#ECE5D4]" />
      : <div className={'h-[108px] sm:h-40 grid place-items-center text-emerald-700 ' + KIND_META[kind].tint}><KIcon name={kind} className="w-11 h-11" strokeWidth={1.6} /></div>}
    <div className="p-3 flex flex-col gap-1.5">
      <IntentBadge kind={kind} intent={item.communityIntent} className="self-start" />
      <span className="text-[15px] font-bold leading-snug line-clamp-2">{item.title}</span>
      <span className="text-xs text-slate-600 truncate">{extra && <b className="text-emerald-700">{extra} · </b>}{metaLine(item, area)}</span>
    </div>
  </Link>;
}
export { Card };

/* ---------------- Khám phá ---------------- */
const shortProvince = (n?: string) => (n || '').replace(/^(Thành phố|Tỉnh)\s+/, '');

/** Danh sách có phân trang: hiện bản lưu trên máy ngay, tải bản mới, kéo xuống tự tải thêm. */
function usePaged(scope: Scope | null) {
  const [items, setItems] = useState<CommunityListing[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const k = scope ? JSON.stringify(scope) : '';
  const seq = useRef(0);
  useEffect(() => {
    if (!scope) { setItems([]); setNext(null); setLoading(false); return; }
    const n = ++seq.current;
    const saved = cachedPage(scope);
    setError('');
    if (saved) { setItems(saved.items); setNext(saved.next); setLoading(false); } else { setItems([]); setLoading(true); }
    loadPage(scope).then(p => { if (n === seq.current) { setItems(p.items); setNext(p.next); } })
      .catch(e => { if (n === seq.current && !saved) setError(e?.message || 'Không tải được tin'); })
      .finally(() => { if (n === seq.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  const loadMore = async () => {
    if (!scope || !next || more) return;
    const n = seq.current;
    setMore(true);
    try {
      const p = await loadPage(scope, next);
      if (n !== seq.current) return;
      setItems(old => { const seen = new Set(old.map(x => x.id)); return [...old, ...p.items.filter(x => !seen.has(x.id))]; });
      setNext(p.next);
    } catch (_) { /* thử lại khi kéo xuống lần sau */ } finally { if (n === seq.current) setMore(false); }
  };
  const reload = async () => {
    if (!scope) return;
    const n = ++seq.current;
    try { const p = await loadPage(scope, null, true); if (n === seq.current) { setItems(p.items); setNext(p.next); setError(''); } } catch (_) { /* giữ danh sách cũ */ }
  };
  return { items, next, loading, more, error, loadMore, reload };
}

/** Kéo tới cuối danh sách thì gọi onHit. */
function Sentinel({ onHit, active }: { onHit: () => void; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onHit); cb.current = onHit;
  useEffect(() => {
    if (!active || !ref.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) cb.current(); }, { rootMargin: '600px 0px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [active]);
  return <div ref={ref} aria-hidden="true" />;
}

const SkGrid = () => <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-56 rounded-2xl bg-[#ECE5D4] animate-pulse" />)}</div>;

type Sort = 'gan' | 'moi';
type IntentF = 'all' | 'have' | 'need';
type Place = { ward: Ward | null; provCode: string | null; provName: string; pt: { lat: number; lng: number } | null };
const byNew = (a: CommunityListing, b: CommunityListing) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
const kmText = (d: number | null) => d == null ? '' : d < 1 ? 'Dưới 1 km' : (d < 10 ? d.toFixed(1).replace('.', ',') : '~' + Math.round(d)) + ' km';
const openAreaSheet = () => window.dispatchEvent(new Event('ccut-open-area'));

function Home({ user }: { user: User | null }) {
  const area = useArea(user);
  const [radius, setRadiusState] = useState(getRadius);
  useEffect(() => onAreaChange(() => setRadiusState(getRadius())), []);
  const [place, setPlace] = useState<Place | null>(null);
  const [kind, setKind] = useState<CommunityKind | 'all'>('all');
  const [intent, setIntent] = useState<IntentF>('all');
  const [sort, setSort] = useState<Sort>('gan');
  const [showFar, setShowFar] = useState(false);
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
  const [q, setQ] = useState(search.trim());
  const [map, setMap] = useState(false);
  const [mine, setMine] = useState<CommunityListing[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const ward = area ? await wardFromLabel(area).catch(() => null) : null;
      const prov = !ward && area ? await provinceFromLabel(area).catch(() => null) : null;
      const pt = ward ? { lat: ward.lat, lng: ward.lng } : getAreaPoint();
      if (alive) setPlace({ ward, provCode: ward?.provinceCode || prov?.code || null, provName: shortProvince(ward?.provinceName || prov?.name), pt });
    })().catch(() => alive && setPlace({ ward: null, provCode: null, provName: '', pt: null }));
    return () => { alive = false; };
  }, [area]);
  useEffect(() => { const t = setTimeout(() => setQ(search.trim().length >= 2 ? search.trim() : ''), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { if (user) community.mineRecent(user.id).then(setMine).catch(() => {}); else setMine([]); }, [user?.id]);
  useEffect(() => { setShowFar(false); }, [radius, area, q]);

  const near = !!(place && radius > 0 && place.provCode);
  const mainScope: Scope | null = place ? (near ? { tinh: place.provCode, nhieu: true, q } : { q }) : null;
  useEffect(() => { if (mainScope && !q) rememberScope(mainScope); }, [JSON.stringify(mainScope)]);
  const main = usePaged(mainScope);
  const done = usePaged(place && !q ? (place.provCode ? { tinh: place.provCode, xong: true } : { xong: true }) : null);

  const ok = (x: CommunityListing) => (kind === 'all' || x.communityKind === kind) && (intent === 'all' || x.communityIntent === intent);
  const dist = (x: CommunityListing) => place?.pt && x.lat != null && x.lng != null ? distanceKm(place.pt.lat, place.pt.lng, x.lat as number, x.lng as number) : null;
  const { inR, outR } = useMemo(() => {
    const rows = main.items.filter(ok).map(x => ({ x, d: dist(x) }));
    if (!near) {
      const list = sort === 'gan' && place?.pt ? [...rows].sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9)) : rows;
      return { inR: list, outR: [] as typeof rows };
    }
    const inside = rows.filter(r => r.d != null && r.d <= radius);
    inside.sort((a, b) => sort === 'gan' ? (a.d! - b.d!) : byNew(a.x, b.x));
    const outside = rows.filter(r => !(r.d != null && r.d <= radius)).sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9) || byNew(a.x, b.x));
    return { inR: inside, outR: outside };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [main.items, kind, intent, sort, radius, near, place]);
  const farOpen = near && (showFar || inR.length < 6);
  // Trong tỉnh/thành còn ít tin: thêm tin ở nơi khác cho trang không bao giờ trống
  const needOther = near && !main.loading && !main.next && inR.length + outR.length < 8;
  const other = usePaged(needOther ? { q } : null);
  const otherShown = useMemo(() => {
    const seen = new Set(main.items.map(x => x.id));
    return other.items.filter(x => !seen.has(x.id) && ok(x));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [other.items, main.items, kind, intent]);
  const mapped = useMemo(() => [...inR.map(r => r.x), ...(farOpen ? outR.map(r => r.x) : []), ...otherShown]
    .map(x => ({ ...x, lat: x.lat == null ? null : Math.round(x.lat * 100) / 100, lng: x.lng == null ? null : Math.round(x.lng * 100) / 100 })), [inR, outR, otherShown, farOpen]);

  const ward = place?.ward || null;
  const title = q ? 'Kết quả cho "' + q + '"' : near ? 'Gần bạn' : place?.pt ? 'Cả nước' : 'Mới nhất cả nước';
  const grid = (rows: { x: CommunityListing; d: number | null }[], eager = false) =>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{rows.map((r, i) => <Card item={r.x} area={area} eager={eager && i < 4} extra={kmText(r.d)} key={r.x.id} />)}</div>;
  const divider = (text: string) => <div className="flex items-center gap-3 text-[13px] font-bold text-slate-600 mt-1"><span className="flex-1 h-px bg-line" />{text}<span className="flex-1 h-px bg-line" /></div>;
  const seg = (v: IntentF, label: string) => <button key={v} onClick={() => setIntent(v)} aria-pressed={intent === v}
    className={'min-h-10 rounded-[11px] text-sm ' + (intent === v ? 'bg-white font-extrabold text-ink shadow-sm' : 'font-bold text-slate-600')}>{label}</button>;
  const nothing = !main.loading && !inR.length && !(farOpen && outR.length) && !otherShown.length && !main.next && !other.loading;

  return <PullToRefresh onRefresh={async () => { await Promise.all([main.reload(), done.reload(), other.reload()]); }}><div className="flex flex-col gap-4">
    <label className="relative block">
      <span className="sr-only">Tìm kiếm</span>
      <KIcon name="search" className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
      <input className={inputCls + ' pl-11 !rounded-2xl'} type="search" placeholder="Tìm món đồ hoặc việc cần giúp…" value={search} onChange={e => setSearch(e.target.value)} />
    </label>
    <div className="grid grid-cols-3 p-1 bg-[#F1ECDF] rounded-[14px]" role="group" aria-label="Loại tin">{seg('all', 'Tất cả')}{seg('have', 'Đồ cho tặng')}{seg('need', 'Người đang cần')}</div>
    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-0.5" role="group" aria-label="Lọc theo hoạt động">
      {KINDS.map(k => <button key={k} onClick={() => setKind(kind === k ? 'all' : k)} aria-pressed={kind === k}
        className={'shrink-0 h-10 px-3.5 rounded-full border flex items-center gap-1.5 text-sm font-semibold ' + (kind === k ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-line bg-white text-ink')}>
        <KIcon name={k} className="w-[18px] h-[18px] text-emerald-700" />{kindLabels[k]}</button>)}
    </div>

    {!q && mine.slice(0, 2).map(m => <Link key={m.id} to={tinPath(m)} className={'flex items-center gap-3 p-3 bg-white rounded-2xl border ' + (m.status === 'rejected' ? 'border-rose-200' : 'border-emerald-200')}>
      {thumbOf(m) ? <img src={thumbOf(m)} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0" />
        : <span className={'h-14 w-14 rounded-xl grid place-items-center text-emerald-700 shrink-0 ' + KIND_META[(m.communityKind || 'gift') as CommunityKind].tint}><KIcon name={(m.communityKind || 'gift') as CommunityKind} className="w-7 h-7" /></span>}
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-xs font-bold text-slate-600">Tin của bạn</span>
        <span className="text-[15px] font-bold truncate">{m.title}</span>
        <span className={'text-xs font-bold ' + (m.status === 'approved' ? 'text-emerald-700' : m.status === 'pending' ? 'text-sun-dark' : 'text-rose-700')}>
          {m.status === 'approved' ? '✓ Đang hiện cho hàng xóm' + (near ? ' trong ' + radius + ' km' : '') : m.status === 'pending' ? 'Đang chờ kiểm tra, sẽ hiện sớm' : 'Chưa được đăng · bấm để xem lý do'}</span>
      </span>
    </Link>)}

    {!q && done.items.length > 0 && <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between"><h2 className="text-lg font-extrabold">Vừa trao xong</h2><span className="text-xs text-slate-600">{place?.provName ? 'ở ' + place.provName : 'trên Chợ Của Tui'}</span></div>
      <div className="flex gap-2.5 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-1">{done.items.slice(0, 10).map(x => {
        const k = (x.communityKind || 'gift') as CommunityKind; const img = thumbOf(x);
        return <Link key={x.id} to={tinPath(x)} className="shrink-0 w-[132px] bg-white border border-line rounded-2xl overflow-hidden">
          <span className={'relative h-[76px] grid place-items-center text-emerald-700 ' + KIND_META[k].tint}>
            {img ? <img src={img} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" /> : <KIcon name={k} className="w-8 h-8" />}
            <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-emerald-700 text-white px-2 py-0.5 rounded-full">Đã trao</span>
          </span>
          <span className="block px-2.5 py-2"><span className="block text-[13px] font-bold leading-snug line-clamp-2">{x.title}</span><span className="block text-[11px] text-slate-600 truncate mt-0.5">{(x.location || '').split(',')[0]}</span></span>
        </Link>;
      })}</div>
    </section>}

    {!place?.provCode && !q && place && <button onClick={openAreaSheet} className="text-left p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm"><b className="text-emerald-800">Chọn xã/phường của bạn</b> để thấy tin gần nhất trước.</button>}

    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold truncate">{title}</h2>
        <div className="flex items-center gap-2 shrink-0">
          {place?.pt && !map && <button onClick={() => setSort(sort === 'gan' ? 'moi' : 'gan')} className="h-9 px-3 rounded-full border border-line bg-white text-[13px] font-bold flex items-center gap-1.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" /></svg>
            {sort === 'gan' ? 'Gần nhất' : 'Mới nhất'}</button>}
          {map && <button onClick={() => setMap(false)} className="h-9 px-3 rounded-full border border-line bg-white text-[13px] font-bold flex items-center gap-1.5"><KIcon name="list" className="w-4 h-4" />Danh sách</button>}
        </div>
      </div>
      {map ? <React.Suspense fallback={<div className="h-[440px] md:h-[640px] rounded-2xl bg-[#ECE5D4] animate-pulse" />}>
          <CommunityMap items={mapped as CommunityListing[]} area={area} />
        </React.Suspense>
      : main.loading || !place ? <SkGrid />
      : main.error ? <ErrorMessage message={main.error} />
      : nothing ? <div className="bg-white border border-line rounded-2xl p-8 text-center">
          <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl mx-auto" />
          <h3 className="text-lg font-bold mt-3">{q ? 'Không thấy tin phù hợp' : 'Chưa có tin ở đây'}</h3>
          <p className="text-slate-600 mt-1">{q ? 'Thử từ khác nhé.' : 'Hãy là người chia sẻ đầu tiên quanh bạn.'}</p>
          <Link className={btnPrimary + ' inline-flex items-center mt-4'} to="/cong-dong/dang-tin">Đăng tin</Link>
        </div>
      : <>
          {inR.length > 0 ? grid(inR, true)
            : near && <p className="text-sm text-slate-600 bg-white border border-line rounded-2xl p-4">Chưa có tin trong {radius} km quanh {shortArea(area)}. <Link to="/cong-dong/dang-tin" className="font-bold text-emerald-700 underline">Đăng tin đầu tiên</Link></p>}
          {near && outR.length > 0 && (farOpen ? <>{divider('Xa hơn một chút' + (place?.provName ? ' · ' + place.provName : ''))}{grid(outR)}</>
            : <button onClick={() => setShowFar(true)} className="self-center min-h-11 px-5 rounded-full border border-line bg-white text-sm font-bold">Xem {outR.length} tin xa hơn</button>)}
          {otherShown.length > 0 && <>{divider('Ở nơi khác')}{grid(otherShown.map(x => ({ x, d: dist(x) })))}</>}
          {main.next && <>
            <Sentinel onHit={main.loadMore} active={!main.more} />
            <button onClick={main.loadMore} disabled={main.more} className="self-center min-h-11 px-5 rounded-full border border-line bg-white text-sm font-bold disabled:opacity-60">{main.more ? 'Đang tải thêm…' : 'Xem thêm tin'}</button>
          </>}
          {!main.next && other.next && <>
            <Sentinel onHit={other.loadMore} active={!other.more} />
            <button onClick={other.loadMore} disabled={other.more} className="self-center min-h-11 px-5 rounded-full border border-line bg-white text-sm font-bold disabled:opacity-60">{other.more ? 'Đang tải thêm…' : 'Xem thêm tin'}</button>
          </>}
        </>}
      {!map && !nothing && !main.loading && <button onClick={() => setMap(true)} className="min-h-12 rounded-2xl border border-line bg-white text-[15px] font-bold text-emerald-700 flex items-center justify-center gap-2"><KIcon name="map" className="w-[18px] h-[18px]" />Xem trên bản đồ</button>}
      {ward && !q && <Link to={wardPath(ward)} className="self-center text-sm font-semibold text-emerald-700 underline min-h-10 flex items-center">Góc chia sẻ {ward.name} ›</Link>}
    </section>
  </div></PullToRefresh>;
}

/* ---------------- Trang xã/phường ---------------- */
export const wardPath = (w: { code: string; name: string }) => '/xa/' + w.code + '-' + slugify(w.name);
function WardPage({ user, code }: { user: User | null; code: string; key?: React.Key }) {
  const area = useArea(user);
  const [ward, setWard] = useState<Ward | null | undefined>(undefined);
  const [stats, setStats] = useState<{ active: number; done: number; top: { id: string; name: string; n: number }[] } | null>(null);
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    import('../utils/dvhc').then(m => m.loadDvhc()).then(d => setWard(d.wards.find(w => w.code === code) || null)).catch(() => setWard(null));
    fetch('/api/xa?ma=' + code).then(r => r.json()).then(j => j.ok && setStats(j)).catch(() => {});
  }, [code]);
  useEffect(() => { if (ward) { const p = document.title; document.title = ward.name + ' – Chợ Của Tui'; return () => { document.title = p; }; } }, [ward?.code]);
  const list = usePaged(ward ? { xa: ward.code } : null);
  if (ward === undefined) return <SkGrid />;
  if (!ward) return <ErrorMessage message="Không tìm thấy xã/phường này." />;
  const prov = shortProvince(ward.provinceName);
  return <PullToRefresh onRefresh={list.reload}><div className="flex flex-col gap-5">
    <section className="rounded-3xl bg-emerald-700 text-white p-6 md:p-8 flex flex-col gap-4">
      <div>
        <p className="text-emerald-100 text-sm font-semibold">Góc chia sẻ của</p>
        <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">{ward.name}</h1>
        <p className="text-emerald-100">{prov}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="rounded-2xl bg-white/10 p-3"><div className="text-3xl font-extrabold">{stats ? stats.active : '…'}</div><div className="text-sm text-emerald-100">tin đang chia sẻ</div></div>
        <div className="rounded-2xl bg-white/10 p-3"><div className="text-3xl font-extrabold">{stats ? stats.done : '…'}</div><div className="text-sm text-emerald-100">món đã trao xong</div></div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Link to="/cong-dong/dang-tin" className="min-h-12 px-5 rounded-2xl bg-white text-emerald-900 font-extrabold inline-flex items-center">+ Đăng tin</Link>
        <button onClick={() => setSharing(true)} className="min-h-12 px-5 rounded-2xl bg-sun text-[#2E1F00] font-extrabold">Mời hàng xóm</button>
        {!sameArea(area, ward.label) && <button onClick={() => setArea(ward.label, { lat: ward.lat, lng: ward.lng })} className="min-h-12 px-4 rounded-2xl border border-white/40 font-bold">Đặt làm khu vực của tôi</button>}
      </div>
    </section>
    {stats && stats.top.length > 0 && <section className="bg-white border border-line rounded-3xl p-5">
      <h2 className="font-extrabold mb-2">Hàng xóm chia sẻ nhiều nhất</h2>
      <ol className="flex flex-col gap-1.5">{stats.top.map((t, i) => <li key={t.id}><Link to={'/profile/' + t.id} className="flex items-center justify-between gap-2 min-h-10 hover:underline">
        <span className="font-semibold">{['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} {t.name}</span><span className="text-sm text-slate-600">{t.n} lần</span></Link></li>)}</ol>
    </section>}
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-extrabold">Tin mới ở {ward.name}</h2>
      {list.loading ? <SkGrid /> : !list.items.length
        ? <div className="bg-white border border-line rounded-2xl p-6 text-center text-slate-600">Chưa có tin nào ở đây. <Link to="/cong-dong/dang-tin" className="font-bold text-emerald-700 underline">Đăng tin đầu tiên</Link></div>
        : <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{list.items.map((it, i) => <Card item={it} area={area} eager={i < 4} key={it.id} />)}</div>}
      {list.next && <><Sentinel onHit={list.loadMore} active={!list.more} />
        <button onClick={list.loadMore} disabled={list.more} className="self-center min-h-11 px-5 rounded-full border border-line bg-white text-sm font-bold">{list.more ? 'Đang tải thêm…' : 'Xem thêm tin'}</button></>}
    </section>
    <ShareModal isOpen={sharing} onClose={() => setSharing(false)} url={window.location.origin + wardPath(ward)} title={'Góc chia sẻ ' + ward.name}
      text={'Hàng xóm ' + ward.name + ' ơi! Mình đang cho tặng, cho mượn đồ và giúp nhau miễn phí trên Chợ Của Tui. Vào xem và cùng chia sẻ nhé:'} />
  </div></PullToRefresh>;
}

/* ---------------- Đăng tin nhanh ---------------- */
function Post({ user, editId }: { user: User | null; editId?: string; key?: React.Key }) {
  const nav = useNavigate();
  const editing = !!editId;
  const [keep, setKeep] = useState<{ img: string; thumb: string }[]>([]);
  const [loadingEdit, setLoadingEdit] = useState(editing);
  useEffect(() => {
    if (!editId || !user) return;
    community.detail(editId).then(x => {
      if (!x || x.sellerId !== user.id) { setError('Bạn chỉ sửa được tin của mình.'); return; }
      setIntent((x.communityIntent || 'have') as CommunityIntent); setKind((x.communityKind || 'gift') as CommunityKind);
      setTitle(x.title || ''); setDescription(x.description || ''); setShowDesc(!!x.description);
      setMeetPlace((x as any).meetPlace || ''); setLocation(x.location || ''); setEditLoc(false);
      const imgs = x.images || []; const th = ((x as any).thumbs as string[]) || [];
      setKeep(imgs.map((u, i) => ({ img: u, thumb: th[i] || u })));
    }).catch(() => setError('Không tải được tin.')).finally(() => setLoadingEdit(false));
  }, [editId, user?.id]);
  const [intent, setIntent] = useState<CommunityIntent>(() => new URLSearchParams(window.location.search).get('y') === 'can' ? 'need' : 'have');
  const [kind, setKind] = useState<CommunityKind>('gift');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showDesc, setShowDesc] = useState(false);
  const [location, setLocation] = useState(() => getArea(user?.location || '') || user?.location || '');
  const [editLoc, setEditLoc] = useState(!location);
  const [meetPlace, setMeetPlace] = useState('');
  const [wardPoint, setWardPoint] = useState<{ lat: number; lng: number; code?: string } | null>(() => getAreaPoint());
  // Khu vực lấy từ hồ sơ: tìm tâm xã/phường tương ứng để đặt tin lên bản đồ
  useEffect(() => { if (location && !wardPoint) wardFromLabel(location).then(w => w && setWardPoint({ lat: w.lat, lng: w.lng, code: w.code })); }, []);
  const [photos, setPhotos] = useState<File[]>([]);
  const previews = useMemo(() => photos.map(f => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);
  const [approximateCoords, setApproximateCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [safetyAck, setSafetyAck] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const notes = useMemo(() => safetyNotes(title + ' ' + description), [title, description]);
  const blocked = notes.some(n => n.level === 'block');
  const needAck = notes.some(n => n.level === 'warn');
  if (!user) return <AuthRequired />;

  function askLocation() {
    if (!navigator.geolocation) { setError('Thiết bị chưa hỗ trợ định vị. Bạn vẫn đăng được bằng tên khu vực.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        if ((pos.coords.accuracy || 0) > 1500) { setApproximateCoords(null); setError('Máy đoán vị trí chưa chính xác (lệch vài km), nên tin sẽ hiện ở giữa xã/phường bạn chọn.'); return; }
        setApproximateCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setError('');
      },
      () => { setLocating(false); setError('Chưa lấy được vị trí. Bạn vẫn đăng được bằng tên khu vực.'); },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (blocked) { setError('Việc này không đăng được trên Chợ Của Tui. Nếu nguy cấp, hãy gọi 115.'); return; }
    if (needAck && !safetyAck) { setError('Hãy đọc và đánh dấu đã hiểu lưu ý an toàn.'); return; }
    // Kiểm tra từ cấm ngay trên máy (máy chủ cũng kiểm tra lại)
    const bad = await findBannedWord([title, description, meetPlace].join(' '));
    if (bad) { setError('Tin có nội dung không được phép (' + bad.toLowerCase() + '). Xem Quy tắc cộng đồng.'); return; }
    setError(''); setSaving(true);
    try {
      if (editId) {
        await community.edit(editId, { title, description, meetPlace, keepImages: keep.map(k => k.img), keepThumbs: keep.map(k => k.thumb), photos });
        nav('/cong-dong/da-dang?sua=1');
      } else {
        await community.create(user, { title, description, location, photos, kind, intent, approximateCoords, meetPlace, wardPoint });
        nav('/cong-dong/da-dang');
      }
    } catch (err: any) { setError(err?.message || 'Chưa đăng được tin. Thử lại nhé.'); }
    finally { setSaving(false); }
  }
  const titleHint = intent === 'have'
    ? ({ gift: 'VD: Xe đạp trẻ em', borrow: 'VD: Máy khoan cầm tay', help: 'VD: Chỉ dùng điện thoại cho người lớn tuổi', repair: 'VD: Sửa quần áo, vá xe đạp' } as const)[kind]
    : ({ gift: 'VD: Cần sách giáo khoa lớp 5', borrow: 'VD: Mượn thang nhôm 2 ngày', help: 'VD: Nhờ khuân đồ chuyển nhà', repair: 'VD: Quạt bàn không quay' } as const)[kind];

  return <form onSubmit={submit} className="mx-auto max-w-xl flex flex-col gap-4 pb-28 md:pb-0">
    <div className="flex items-center gap-2">
      <Link to="/" aria-label="Đóng" className="h-11 w-11 grid place-items-center rounded-full hover:bg-white"><KIcon name="x" /></Link>
      <h1 className="text-xl font-extrabold">{editing ? 'Sửa tin' : 'Đăng tin'}</h1>
    </div>
    {loadingEdit && <p className="text-slate-600">Đang tải tin…</p>}
    {editing && <p className="text-[13px] text-slate-600 bg-white border border-line rounded-xl px-3 py-2">Sửa xong, máy kiểm tra lại tin trong vài giây rồi cho hiện. Loại tin và khu vực giữ nguyên.</p>}
    <div role="group" aria-label="Bạn có hay bạn cần" className={'grid grid-cols-2 p-1 bg-[#F1ECDF] rounded-2xl ' + (editing ? 'hidden' : '')}>
      {(['have', 'need'] as const).map(v => <button type="button" key={v} onClick={() => setIntent(v)} aria-pressed={intent === v}
        className={'min-h-12 rounded-xl text-[17px] ' + (intent === v ? (v === 'have' ? 'bg-emerald-700 text-white font-extrabold' : 'bg-sun text-[#2E1F00] font-extrabold') : 'text-ink font-bold')}>
        {v === 'have' ? 'Tôi có' : 'Tôi cần'}</button>)}
    </div>

    {!editing && <div className="flex flex-col items-center gap-1">
      <VoiceButton label="Nói để đăng nhanh" className="h-12 px-5 w-full !rounded-2xl border border-emerald-200" onText={t => {
        const v = parseVoicePost(t);
        if (v.intent) setIntent(v.intent);
        if (v.kind) setKind(v.kind);
        if (v.title) setTitle(v.title);
      }} />
      <span className="text-xs text-slate-500">Ví dụ: "Tôi có xe đạp trẻ em cho tặng" · "Tôi cần mượn thang nhôm"</span>
    </div>}
    <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
      onChange={e => { const files = Array.from(e.target.files || []); setPhotos(p => [...p, ...files].slice(0, Math.max(0, MAX_PHOTOS - keep.length))); e.target.value = ''; }} />
    <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
      onChange={e => { const files = Array.from(e.target.files || []); setPhotos(p => [...p, ...files].slice(0, Math.max(0, MAX_PHOTOS - keep.length))); e.target.value = ''; }} />
    {photos.length + keep.length === 0
      ? <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => camRef.current?.click()} className="h-[150px] rounded-[20px] border-2 border-dashed border-[#B9C9BC] bg-white flex flex-col items-center justify-center gap-2 text-emerald-700">
            <span className="h-14 w-14 rounded-full bg-emerald-50 grid place-items-center"><KIcon name="camera" className="w-7 h-7" /></span>
            <span className="text-[16px] font-extrabold">{intent === 'have' ? 'Chụp ảnh' : 'Chụp ảnh (nếu có)'}</span>
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="h-[150px] rounded-[20px] border-2 border-dashed border-[#B9C9BC] bg-white flex flex-col items-center justify-center gap-2 text-emerald-700">
            <span className="h-14 w-14 rounded-full bg-emerald-50 grid place-items-center"><KIcon name="image" className="w-7 h-7" /></span>
            <span className="text-[16px] font-extrabold">Chọn từ máy</span>
            <span className="text-[12px] text-slate-600">tối đa {MAX_PHOTOS} ảnh</span>
          </button>
        </div>
      : <div className="flex gap-2 flex-wrap">{keep.map((k, i) =>
          <div key={k.img} className="relative"><img src={k.thumb} alt="" className="h-24 w-24 rounded-2xl object-cover border border-line" />
            <button type="button" aria-label="Bỏ ảnh" onClick={() => setKeep(p => p.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white border border-line grid place-items-center"><KIcon name="x" className="w-4 h-4" /></button>
          </div>)}{previews.map((u, i) =>
          <div key={u} className="relative"><img src={u} alt="" className="h-24 w-24 rounded-2xl object-cover border border-line" />
            <button type="button" aria-label="Bỏ ảnh" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white border border-line grid place-items-center"><KIcon name="x" className="w-4 h-4" /></button>
          </div>)}
          {photos.length + keep.length < MAX_PHOTOS && <button type="button" onClick={() => fileRef.current?.click()} aria-label="Thêm ảnh" className="h-24 w-24 rounded-2xl border-2 border-dashed border-[#B9C9BC] bg-white grid place-items-center text-emerald-700"><KIcon name="camera" /></button>}
        </div>}

    <div className={'grid grid-cols-2 gap-2 ' + (editing ? 'hidden' : '')} role="group" aria-label="Loại">
      {KINDS.map(k => <button type="button" key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
        className={'flex items-center gap-2 min-h-[52px] px-3 rounded-[14px] text-[15px] font-bold ' + (kind === k ? 'border-2 border-emerald-700 bg-emerald-50 text-emerald-900' : 'border border-line bg-white')}>
        <KIcon name={k} className="w-[22px] h-[22px] text-emerald-700" />{kindText(k, intent)}</button>)}
    </div>

    <div className="flex flex-col gap-1.5">
      <label htmlFor="post-title" className="text-[15px] font-bold">{intent === 'have' ? (kind === 'help' || kind === 'repair' ? 'Bạn giúp được việc gì?' : 'Món gì?') : 'Bạn cần gì?'}</label>
      <div className="flex items-center min-h-[52px] rounded-[14px] border border-[#C9C1AE] bg-white pl-4 pr-1.5 focus-within:ring-2 focus-within:ring-emerald-600">
        <input id="post-title" required minLength={5} maxLength={90} value={title} onChange={e => setTitle(e.target.value)} placeholder={titleHint}
          className="flex-1 bg-transparent outline-none text-base py-3" />
        <VoiceButton className="h-10 w-10" onText={t => setTitle(v => (v ? v + ' ' : '') + t)} />
      </div>
      {!showDesc ? <button type="button" onClick={() => setShowDesc(true)} className="self-start text-sm font-semibold text-emerald-700 underline min-h-9">+ Thêm mô tả (không bắt buộc)</button>
        : <textarea maxLength={900} rows={3} className={inputCls} placeholder="Tình trạng, thời gian rảnh…" value={description} onChange={e => setDescription(e.target.value)} aria-label="Mô tả thêm" />}
    </div>

    <div className="flex flex-col gap-2">
      <span className="text-[15px] font-bold">Hẹn {intent === 'have' && (kind === 'gift' || kind === 'borrow') ? 'trao' : 'gặp'} ở đâu?</span>
      <div className="flex gap-2 flex-wrap">{MEET_PLACES.map(p => <button type="button" key={p} onClick={() => setMeetPlace(meetPlace === p ? '' : p)} aria-pressed={meetPlace === p}
        className={'min-h-9 px-3 rounded-full border text-[13px] font-semibold ' + (meetPlace === p ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-line bg-white')}>{p}</button>)}</div>
      {editing ? <span className="flex items-center gap-1.5 text-[13px] text-slate-600"><KIcon name="pin" className="w-4 h-4 text-emerald-700" />{location}</span>
      : editLoc
        ? <div><label htmlFor="post-area" className="sr-only">Xã/phường</label>
            <AreaInput id="post-area" value={location} onType={t => { setLocation(t); setWardPoint(null); }} onPick={w => { setLocation(w.label); setWardPoint({ lat: w.lat, lng: w.lng, code: w.code }); setEditLoc(false); }} /></div>
        : <span className="flex items-center gap-1.5 text-[13px] text-slate-600"><KIcon name="pin" className="w-4 h-4 text-emerald-700" />{location} · <button type="button" className="underline text-emerald-700 font-semibold" onClick={() => setEditLoc(true)}>Đổi</button></span>}
      {!editing && <button type="button" onClick={askLocation} disabled={locating} className="self-start text-[13px] font-semibold underline text-emerald-700 min-h-8">
        {locating ? 'Đang xác định…' : approximateCoords ? '✓ Đã gắn vị trí gần đúng lên bản đồ' : 'Thêm vị trí gần đúng lên bản đồ (không bắt buộc)'}</button>}
      <span className="text-xs text-slate-500">Không ghi số nhà. Trên bản đồ, tin được đặt ở giữa xã/phường (hoặc vị trí làm tròn khoảng 1 km nếu bạn cho phép).</span>
    </div>

    <SafetyBox notes={notes} />
    {needAck && !blocked && <label className="flex gap-2 items-start text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={safetyAck} onChange={e => setSafetyAck(e.target.checked)} />Tôi đã đọc lưu ý an toàn ở trên.</label>}
    {error && <ErrorMessage message={error} />}

    <div className="fixed md:static left-0 right-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 bg-white md:bg-transparent border-t md:border-0 border-line px-4 md:px-0 pt-3 pb-5 md:p-0 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] md:shadow-none flex flex-col gap-1">
      <button disabled={saving || blocked} type="submit" className="min-h-14 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-lg font-extrabold disabled:opacity-60">{saving ? (editing ? 'Đang lưu…' : 'Đang đăng…') : editing ? 'Lưu thay đổi' : 'Đăng tin'}</button>
      <span className="text-center text-xs text-slate-600">Miễn phí. Máy tự kiểm tra, tin ổn sẽ hiện sau vài giây.</span>
    </div>
  </form>;
}
function Posted() {
  const edited = new URLSearchParams(window.location.search).get('sua') === '1';
  return <div className="mx-auto max-w-lg rounded-3xl bg-white border border-line p-8 text-center">
    <span className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center mx-auto"><KIcon name="check" className="w-8 h-8" strokeWidth={3} /></span>
    <h1 className="text-2xl font-extrabold mt-4">{edited ? 'Đã lưu thay đổi!' : 'Đã nhận tin của bạn!'}</h1>
    <p className="text-slate-600 mt-2">Máy đang kiểm tra tin, thường xong trong vài giây. Tin ổn sẽ hiện ngay; nếu cần người duyệt xem, bạn sẽ nhận thông báo. Khi có người liên hệ, bạn sẽ thấy ở mục Tin nhắn.</p>
    <div className="flex gap-2 justify-center flex-wrap mt-6">
      <Link className={btnPrimary + ' inline-flex items-center'} to="/profile">Xem tin của tôi</Link>
      <Link className={btnLight + ' inline-flex items-center'} to="/">Về trang chủ</Link>
    </div>
  </div>;
}

/* ---------------- Chi tiết tin ---------------- */
/** Thanh quản trị trên trang tin: ẩn, cho hiện lại, xoá hẳn. */
function AdminBar({ item, onChange }: { item: CommunityListing; onChange: (v: Partial<CommunityListing> | null) => void }) {
  const [mode, setMode] = useState<'' | 'hide' | 'delete'>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function run(fn: () => Promise<void>, v: Partial<CommunityListing> | null, ok: string) {
    setBusy(true); setMsg('');
    try { await fn(); setMode(''); setMsg(ok); onChange(v); }
    catch (e: any) { setMsg('Chưa làm được: ' + (e?.code || e?.message || '')); }
    finally { setBusy(false); }
  }
  const load = () => import('../components/AdminListings');
  return <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-3 flex flex-col gap-2">
    <span className="text-xs font-extrabold text-rose-800">Quản trị</span>
    {mode === '' && <div className="flex gap-2 flex-wrap">
      {item.status === 'approved'
        ? <button disabled={busy} onClick={() => setMode('hide')} className="min-h-10 px-4 rounded-xl bg-rose-600 text-white text-sm font-bold">Ẩn tin</button>
        : <button disabled={busy} onClick={() => run(async () => (await load()).adminShow(item.id), { status: 'approved' } as any, 'Đã cho hiện lại.')} className="min-h-10 px-4 rounded-xl bg-emerald-700 text-white text-sm font-bold">Cho hiện</button>}
      <button disabled={busy} onClick={() => setMode('delete')} className="min-h-10 px-4 rounded-xl border border-rose-300 bg-white text-rose-700 text-sm font-bold">Xoá hẳn</button>
    </div>}
    {mode !== '' && <AdminReason danger={mode === 'delete'} busy={busy} onCancel={() => setMode('')}
      onPick={r => mode === 'hide'
        ? run(async () => (await load()).adminHide(item, r), { status: 'hidden' } as any, 'Đã ẩn tin và báo cho người đăng.')
        : run(async () => (await load()).adminDelete(item, r), null, 'Đã xoá tin.')} />}
    {msg && <p className="text-sm font-semibold">{msg}</p>}
  </div>;
}
const AdminReasonLazy = React.lazy(() => import('../components/AdminListings').then(m => ({ default: m.ReasonPicker })));
function AdminReason(p: { danger: boolean; busy: boolean; onCancel: () => void; onPick: (r: string) => void }) {
  return <React.Suspense fallback={<p className="text-sm">Đang tải…</p>}>
    <AdminReasonLazy label={p.danger ? 'Xoá hẳn (không khôi phục được)' : 'Ẩn tin này'} danger={p.danger} busy={p.busy} onCancel={p.onCancel} onPick={p.onPick} />
  </React.Suspense>;
}

function Detail({ user, id }: { user: User | null; id: string }) {
  const nav = useNavigate();
  const [item, setItem] = useState<CommunityListing | null>(null);
  const [owner, setOwner] = useState<PublicProfile | null>(null);
  const [done, setDone] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [reported, setReported] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [thanks, setThanks] = useState<ThankNote[]>([]);
  const [iBlocked, setIBlocked] = useState(false);
  const area = useArea(user);
  useEffect(() => {
    if (!item) return;
    const prev = document.title;
    document.title = item.title + ' – Chợ Của Tui';
    return () => { document.title = prev; };
  }, [item?.id]);
  useEffect(() => { if (user) community.savedIds(user.id).then(ids => setSaved(ids.includes(id))); }, [user?.id, id]);
  useEffect(() => { if (user && item) community.blockedIds(user.id).then(b => setIBlocked(b.includes(item.sellerId))); }, [user?.id, item?.sellerId]);
  useEffect(() => {
    let alive = true; setLoading(true);
    community.detail(id).then(x => {
      if (!alive) return; setItem(x);
      if (x) {
        db.getPublicProfile(x.sellerId).then(p => alive && setOwner(p)); community.doneCount(x.sellerId).then(n => alive && setDone(n));
        community.thanksFor(x.sellerId, 10).then(t => alive && setThanks(t));
      }
    }).catch(e => alive && setError(e?.message || 'Không tải được tin')).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);
  if (loading) return <div className="max-w-3xl mx-auto"><div className="h-72 rounded-3xl bg-[#ECE5D4] animate-pulse" /><div className="h-8 w-2/3 rounded-xl bg-[#ECE5D4] animate-pulse mt-5" /></div>;
  if (error) return <ErrorMessage message={error} />;
  const mine = !!item && user?.id === item.sellerId;
  const isAdmin = user?.role === 'admin';
  // Tin đã ẩn / bị từ chối / chờ duyệt: chỉ chủ tin và quản trị xem được.
  if (!item || (!mine && !isAdmin && !['approved', 'sold'].includes(String(item.status)))) return <div className="bg-white p-8 rounded-2xl border border-line">Tin không tồn tại hoặc đã đóng. <Link className="underline" to="/">Về trang chủ</Link></div>;
  const kind = (item.communityKind || 'gift') as CommunityKind;
  const need = item.communityIntent === 'need';
  const ownerName = owner?.name || item.sellerName || 'Thành viên';
  const notes = safetyNotes(item.title + ' ' + (item.description || ''));
  const images = item.images || [];

  async function ask() {
    if (!user || !item) return nav('/login');
    setSending(true); setError('');
    try {
      const msg = need ? 'Chào bạn, mình giúp được việc này: ' + item.title : 'Chào bạn, mình xin món này nhé: ' + item.title;
      const room = await community.askAndOpenChat(item, user, msg);
      nav('/chat/' + room);
    } catch (e: any) { setError(e?.message || 'Chưa liên hệ được, thử lại nhé.'); }
    finally { setSending(false); }
  }
  async function toggleSave() {
    if (!user) return nav('/login');
    setSaved(v => !v);
    try { await community.toggleSave(user.id, id); } catch (_) { setSaved(v => !v); setError('Chưa lưu được tin, thử lại nhé.'); }
  }
  async function report() {
    if (!user) return nav('/login');
    const reason = window.prompt('Tin này có vấn đề gì? (ví dụ: đòi tiền, lừa đảo, nội dung xấu)');
    if (!reason || !item) return;
    try { await db.reportListing({ listingId: item.id, targetUserId: item.sellerId, userId: user.id, reason: reason.slice(0, 300) }); setReported(true); }
    catch (_) { setError('Chưa gửi được báo cáo.'); }
  }
  async function unblock() {
    if (!item) return;
    try { await community.setBlocked(item.sellerId, false); setIBlocked(false); } catch (_) { setError('Chưa bỏ chặn được.'); }
  }
  const roundBtn = 'h-11 w-11 rounded-full bg-white/95 grid place-items-center text-ink shadow-sm';

  const ownerBox = <Link to={'/profile/' + item.sellerId} className="flex items-center gap-3 p-3 bg-white border border-line rounded-2xl">
    {owner?.avatar ? <img src={owner.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
      : <span className="h-11 w-11 rounded-full bg-emerald-700 text-white font-extrabold grid place-items-center">{ownerName.charAt(0).toUpperCase()}</span>}
    <span className="flex flex-col flex-1 min-w-0">
      <span className="text-[15px] font-bold truncate">{ownerName}</span>
      <span className="text-xs text-slate-600">{[(owner?.sharedCount || done) > 0 ? 'Đã chia sẻ xong ' + (owner?.sharedCount || done) + ' lần' : 'Thành viên Chợ Của Tui', thanks.length ? thanks.length + ' lời cảm ơn' : ''].filter(Boolean).join(' · ')}</span>
    </span>
    <BadgeRow p={owner} />
  </Link>;
  const actionBox = <div className="fixed md:static left-0 right-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 bg-white md:bg-transparent border-t md:border-0 border-line px-4 md:px-0 pt-3 pb-5 md:p-0 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] md:shadow-none flex flex-col gap-1.5">
    {mine
      ? <div className="flex gap-2">
          <Link to={'/cong-dong/sua/' + item.id} className="min-h-14 px-5 rounded-2xl border border-line bg-white text-base font-extrabold flex items-center justify-center gap-2"><KIcon name="repair" className="w-5 h-5 text-emerald-700" />Sửa tin</Link>
          <Link to="/cong-dong/yeu-cau" className="flex-1 min-h-14 rounded-2xl bg-emerald-700 text-white text-lg font-extrabold flex items-center justify-center gap-2">Xem người liên hệ</Link>
        </div>
      : iBlocked ? <p className="text-center text-sm text-slate-600 py-3">Bạn đã chặn người này. <button onClick={unblock} className="underline font-semibold">Bỏ chặn</button></p>
      : <button disabled={sending} onClick={ask} className="min-h-14 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-lg font-extrabold flex items-center justify-center gap-2 disabled:opacity-60">
          <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
          {sending ? 'Đang mở trò chuyện…' : need ? 'Tôi giúp được' : 'Xin món này'}</button>}
    {!mine && !iBlocked && <span className="text-center text-xs text-slate-600">{user ? 'Bấm là mở trò chuyện với ' + ownerName + ' ngay' : 'Bạn sẽ được mời đăng nhập trước'}</span>}
  </div>;

  return <div className="mx-auto max-w-3xl lg:max-w-6xl pb-32 md:pb-0 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-8 lg:items-start">
    <div className="lg:sticky lg:top-24">
      <div className="relative -mx-4 md:mx-0 md:rounded-3xl overflow-hidden">
        {images.length
          ? <button onClick={() => setViewer(true)} aria-label="Xem ảnh lớn" className="block w-full">
              <img src={images[Math.min(photoIndex, images.length - 1)]} alt={item.title} className="w-full h-[300px] md:h-[420px] lg:h-[520px] object-cover bg-emerald-950" />
            </button>
          : <div className={'h-[300px] lg:h-[420px] grid place-items-center text-emerald-700 ' + KIND_META[kind].tint}><KIcon name={kind} className="w-28 h-28" strokeWidth={1.2} /></div>}
        <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} aria-label="Quay lại" className={roundBtn + ' absolute top-3.5 left-4'}><KIcon name="back" className="w-[22px] h-[22px]" /></button>
        <div className="absolute top-3.5 right-4 flex gap-2">
          <button onClick={() => setSharing(true)} aria-label="Chia sẻ" className={roundBtn}><KIcon name="share" className="w-5 h-5" /></button>
          <button onClick={toggleSave} aria-label={saved ? 'Bỏ lưu' : 'Lưu tin'} aria-pressed={saved} className={roundBtn + (saved ? ' !bg-emerald-700 !text-white' : '')}><KIcon name="bookmark" className="w-5 h-5" /></button>
        </div>
        {images.length > 1 && <div className="lg:hidden absolute bottom-3.5 left-0 right-0 flex justify-center gap-1.5">{images.map((_, i) =>
          <button key={i} onClick={() => setPhotoIndex(i)} aria-label={'Ảnh ' + (i + 1)} className={'h-2.5 rounded-full ' + (i === photoIndex ? 'w-6 bg-white' : 'w-2.5 bg-white/60')} />)}</div>}
        {images.length > 0 && <span className="absolute bottom-3.5 right-4 text-[11px] font-bold bg-black/55 text-white rounded-full px-2.5 py-1 pointer-events-none">Chạm để xem lớn</span>}
      </div>
      {images.length > 1 && <div className="hidden lg:flex gap-2 mt-3">{images.map((u, i) =>
        <button key={u} onClick={() => setPhotoIndex(i)} aria-label={'Ảnh ' + (i + 1)} className={'h-20 w-20 rounded-xl overflow-hidden border-2 ' + (i === photoIndex ? 'border-emerald-700' : 'border-transparent opacity-70 hover:opacity-100')}><img src={u} alt="" className="h-full w-full object-cover" /></button>)}</div>}
    </div>

    <div className="pt-5 lg:pt-0 flex flex-col gap-3.5">
      <div className="flex gap-2 flex-wrap">
        <IntentBadge kind={kind} intent={item.communityIntent} className="!text-xs !px-2.5 !py-1" />
        <span className="text-xs font-bold text-emerald-700 bg-white border border-emerald-700 px-2.5 py-0.5 rounded-full">Miễn phí</span>
        {(mine || isAdmin) && item.status !== 'approved' && <span className="text-xs font-bold text-sun-dark bg-sun-light px-2.5 py-0.5 rounded-full">{item.status === 'pending' ? 'Đang chờ kiểm tra' : item.status === 'rejected' ? 'Chưa được đăng' : 'Đã ẩn'}</span>}
      </div>
      <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">{item.title}</h1>
      {item.description && <p className="text-[15px] leading-relaxed text-[#3B4A40] whitespace-pre-wrap">{item.description}</p>}
      <div className="flex flex-col gap-2.5 text-sm text-slate-600">
        <span className="flex items-center gap-2"><KIcon name="pin" className="w-[18px] h-[18px] text-emerald-700" />{item.location || 'Chưa có khu vực'}{sameArea(item.location, area) ? ' · cùng khu vực với bạn' : ''}</span>
        {item.meetPlace && <span className="flex items-center gap-2"><KIcon name="map" className="w-[18px] h-[18px] text-emerald-700" />Hẹn {need ? 'gặp' : 'trao'} ở: {item.meetPlace}</span>}
        {item.createdAt && <span className="flex items-center gap-2"><KIcon name="clock" className="w-[18px] h-[18px] text-emerald-700" />Đăng {formatTimeAgo(String(item.createdAt))}</span>}
      </div>
      <div className="hidden md:block">{actionBox}</div>
      {ownerBox}
      {thanks.length > 0 && <ThanksList items={thanks.slice(0, 2)} title={'Lời cảm ơn gửi ' + ownerName} more={thanks.length > 2 ? '/profile/' + item.sellerId : ''} />}
      <SafetyBox notes={notes} />
      {isAdmin && !mine && <AdminBar item={item} onChange={v => v ? setItem({ ...item, ...v }) : nav('/admin')} />}
      {!mine && <p className="text-[13px] leading-relaxed text-slate-600">{need ? 'Người đăng sẽ chọn người giúp phù hợp.' : 'Người cho sẽ chọn người nhận.'} Không chuyển khoản hay đặt cọc cho bất kỳ ai. {reported ? 'Đã gửi báo cáo, cảm ơn bạn.' : <button onClick={report} className="underline">Báo cáo tin này</button>}</p>}
      {error && <ErrorMessage message={error} />}
    </div>
    <div className="md:hidden">{actionBox}</div>
    {viewer && images.length > 0 && <PhotoViewer images={images} start={photoIndex} title={item.title} onClose={() => setViewer(false)} />}
    <ShareModal isOpen={sharing} onClose={() => setSharing(false)} url={window.location.origin + tinPath(item)} title={item.title} image={images[0]}
      card={{ title: item.title, image: thumbOf(item) || images[0], badge: (need ? 'Tôi cần' : 'Tôi có') + ' · ' + kindText(kind, item.communityIntent), place: (item.location || '').split(',')[0], need }}
      text={(need ? 'Tôi cần' : 'Tôi có') + ' · ' + kindText(kind, item.communityIntent) + ': ' + item.title + ' — miễn phí trên Chợ Của Tui'} />
  </div>;
}

/* ---------------- Yêu cầu ---------------- */
function Requests({ user }: { user: User | null }) {
  const nav = useNavigate();
  const [items, setItems] = useState<CommunityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState('');
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [people, setPeople] = useState<Record<string, PublicProfile | null>>({});
  const [dist, setDist] = useState<Record<string, number | undefined>>({});
  useEffect(() => {
    if (!user) return;
    const ids: string[] = [...new Set<string>(items.filter(x => x.ownerId === user.id).map(x => x.requesterId as string))].filter(id => !(id in people));
    if (!ids.length) return;
    (async () => {
      const mine = await wardFromLabel(getArea(user.location || '') || user.location || '').catch(() => null);
      const got: Record<string, PublicProfile | null> = {}; const dd: Record<string, number | undefined> = {};
      await Promise.all(ids.map(async id => {
        const p = await db.getPublicProfile(id).catch(() => null); got[id] = p;
        if (p?.location && mine) { const w = await wardFromLabel(p.location).catch(() => null); if (w) dd[id] = distanceKm(mine.lat, mine.lng, w.lat, w.lng); }
      }));
      setPeople(x => ({ ...x, ...got })); setDist(x => ({ ...x, ...dd }));
    })();
  }, [items, user?.id]);
  async function refresh() {
    if (!user) return;
    setError('');
    try { setItems(await community.mine()); } catch (e: any) { setError(e?.message || 'Chưa tải được các yêu cầu'); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (user) void refresh(); else setLoading(false); }, [user?.id]);
  if (!user) return <AuthRequired />;
  const visible = items.filter(x => tab === 'received' ? x.ownerId === user.id : x.requesterId === user.id);
  async function chat(request: CommunityRequest) {
    setWorking(request.id); setError('');
    try {
      const listing = await community.detail(request.listingId);
      if (!listing) throw new Error('Tin đã được ẩn.');
      const requester = request.requesterId === user!.id ? user! : (await db.getPublicProfile(request.requesterId)) as unknown as User | null;
      if (!requester) throw new Error('Không tìm thấy thành viên.');
      nav('/chat/' + await db.createChatRoom(listing, requester));
    } catch (e: any) { setError(e?.message || 'Không thể mở tin nhắn'); }
    finally { setWorking(''); }
  }
  // Người xin trên tin của mình: gộp theo tin, kèm gợi ý ưu tiên công bằng
  const groups: CommunityRequest[][] = (() => {
    if (tab !== 'received') return [];
    const m = new Map<string, CommunityRequest[]>();
    for (const r of visible) m.set(r.listingId, [...(m.get(r.listingId) || []), r]);
    return [...m.values()].map(list => list.sort((a, b) => tsOf(a.createdAt) - tsOf(b.createdAt)));
  })();
  async function onAccepted(r: CommunityRequest) {
    const waiting = items.filter(x => x.listingId === r.listingId && x.id !== r.id && x.status === 'requested').length;
    if (!waiting) return;
    if (!window.confirm('Đã chọn được người. Báo nhẹ nhàng cho ' + waiting + ' người còn lại đang chờ là đã có người nhận nhé?')) return;
    await community.declineOthers(r.listingId, r.id);
    await refresh();
  }
  const card = (r: CommunityRequest, hint?: React.ReactNode) => <article key={r.id} className="rounded-[18px] bg-white border border-line p-4 flex flex-col gap-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        {tab === 'sent' && <Link className="text-[15px] font-bold hover:underline line-clamp-2" to={'/cong-dong/tin/' + r.listingId}>{r.listingTitle}</Link>}
        {tab === 'received' && <span className="text-[15px] font-bold">{people[r.requesterId]?.name || 'Thành viên'}</span>}
        <span className="block text-xs text-slate-600 mt-0.5">{kindText(r.kind, r.intent)} · {statusLabels[r.status]}</span>
      </div>
      {r.status !== 'declined' && r.status !== 'cancelled' && <button disabled={working === r.id} onClick={() => chat(r)} className="shrink-0 min-h-10 px-3 rounded-full border border-line text-sm font-semibold flex items-center gap-1.5"><KIcon name="send" className="w-4 h-4 text-emerald-700" />Trò chuyện</button>}
    </div>
    {hint}
    <p className="text-sm text-slate-600">“{r.message}”</p>
    <Steps r={r} />
    <RequestActions r={r} uid={user.id} onDone={refresh} compact onAccepted={onAccepted} />
    <ThankButton r={r} user={user} />
  </article>;

  return <div className="mx-auto max-w-2xl">
    <h1 className="text-2xl md:text-3xl font-extrabold mb-1">Yêu cầu</h1>
    <p className="text-slate-600 mb-4">Ai đang xin, ai đang giúp, đã tới bước nào.</p>
    <div role="group" className="grid grid-cols-2 p-1 bg-[#F1ECDF] rounded-2xl mb-4">
      {([['received', 'Trên tin của tôi'], ['sent', 'Tôi đã gửi']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
        className={'min-h-11 rounded-xl text-[15px] ' + (tab === k ? 'bg-white font-extrabold shadow-sm' : 'font-semibold text-slate-600')}>{l}</button>)}
    </div>
    {error && <ErrorMessage message={error} />}
    {loading ? <p className="text-slate-600">Đang tải…</p> : !visible.length ? <p className="rounded-2xl bg-white border border-line p-6 text-slate-600">Chưa có yêu cầu nào ở mục này.</p>
      : tab === 'sent' ? <div className="space-y-3">{visible.map(r => card(r))}</div>
      : <div className="space-y-6">{groups.map(list => {
          const open = list.filter(x => x.status === 'requested');
          const near = open.map(x => ({ id: x.id, d: dist[x.requesterId] })).filter(x => x.d != null).sort((a, b) => a.d! - b.d!)[0];
          const firstNew = open.find(x => !(people[x.requesterId]?.receivedCount));
          return <section key={list[0].listingId} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <Link className="text-lg font-extrabold hover:underline line-clamp-1" to={'/cong-dong/tin/' + list[0].listingId}>{list[0].listingTitle}</Link>
              <span className="text-sm text-slate-600 shrink-0">{list.length} người</span>
            </div>
            {open.length > 1 && <p className="text-[13px] text-slate-600 bg-cream border border-line rounded-xl px-3 py-2">Có {open.length} người đang chờ. Gợi ý cho công bằng: ưu tiên người <b>xin trước</b>, <b>ở gần</b> hoặc <b>chưa nhận lần nào</b>.</p>}
            {list.map((r, i) => {
              const tags: string[] = [];
              if (r.status === 'requested') {
                if (open[0]?.id === r.id && open.length > 1) tags.push('⏱ Xin đầu tiên');
                if (near && near.id === r.id && open.length > 1) tags.push('📍 Gần nhất' + (near.d! < 1 ? '' : ' ~' + Math.round(near.d!) + ' km'));
                if (firstNew && firstNew.id === r.id && open.length > 1) tags.push('🌱 Chưa nhận lần nào');
              }
              return card(r, tags.length ? <div className="flex flex-wrap gap-1.5 -mt-1">{tags.map(t => <span key={t} className="text-xs font-bold bg-emerald-50 text-emerald-900 rounded-full px-2.5 py-1">{t}</span>)}</div> : null);
            })}
          </section>;
        })}</div>}
  </div>;
}

function tsOf(x: any): number {
  try { return x?.toMillis ? x.toMillis() : x?.seconds ? x.seconds * 1000 : x ? new Date(x).getTime() : 0; } catch (_) { return 0; }
}

/* ---------------- Đã lưu ---------------- */
function Saved({ user }: { user: User | null }) {
  const [items, setItems] = useState<CommunityListing[]>([]);
  const [loading, setLoading] = useState(true);
  const area = useArea(user);
  useEffect(() => { if (!user) { setLoading(false); return; } community.saved(user.id).then(setItems).finally(() => setLoading(false)); }, [user?.id]);
  if (!user) return <AuthRequired />;
  return <div>
    <h1 className="text-2xl md:text-3xl font-extrabold mb-1">Tin đã lưu</h1>
    <p className="text-slate-600 mb-4">Bấm biểu tượng lưu ở trang chi tiết để xem lại sau.</p>
    {loading ? <p className="text-slate-600">Đang tải…</p> : !items.length
      ? <p className="rounded-2xl bg-white border border-line p-6 text-slate-600">Chưa lưu tin nào. <Link className="underline text-emerald-700" to="/">Khám phá ngay</Link></p>
      : <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{items.map(it => <Card item={it} area={area} key={it.id} />)}</div>}
  </div>;
}

export default function CommunityApp({ user }: { user: User | null }) {
  const route = useLocation().pathname;
  if (route === '/cong-dong/dang-tin') return <Post user={user} />;
  if (route.startsWith('/cong-dong/sua/')) return <Post user={user} editId={route.split('/').pop()} key={route} />;
  if (route === '/cong-dong/yeu-cau') return <Requests user={user} />;
  if (route === '/cong-dong/da-dang') return <Posted />;
  if (route === '/cong-dong/da-luu') return <Saved user={user} />;
  if (route.startsWith('/xa/')) return <WardPage user={user} code={(route.split('/')[2] || '').split('-')[0]} key={route} />;
  if (route.startsWith('/cong-dong/tin/')) return <Detail user={user} id={(decodeURIComponent(route.split('/').pop() || '').split('-').pop()) || ''} />;
  return <Home user={user} />;
}
