/** Bản đồ nhỏ trên trang tin: chỉ một vòng tròn mờ (~700 m) quanh vị trí gần đúng. Không kéo, không lộ vị trí thật. */
import React, { useEffect, useRef, useState } from 'react';
import { loadMapLibre, patchBaseStyle, MAP_STYLE } from './CommunityMap';

export default function MiniMap({ lat, lng, label }: { lat: number; lng: number; label?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let map: any = null, alive = true;
    loadMapLibre().then(ml => {
      if (!alive || !box.current) return;
      map = new ml.Map({ container: box.current, style: MAP_STYLE, center: [lng, lat], zoom: 13.3, interactive: false, attributionControl: false });
      map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right');
      map.on('load', () => {
        try { patchBaseStyle(map); } catch (_) { /* bỏ qua */ }
        map.addSource('vung', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } } });
        const r = ['interpolate', ['exponential', 2], ['zoom'], 10, 10, 18, 1280];
        map.addLayer({ id: 'vung', type: 'circle', source: 'vung', paint: { 'circle-radius': r, 'circle-color': '#1F6F43', 'circle-opacity': 0.15, 'circle-stroke-width': 2, 'circle-stroke-color': '#1F6F43', 'circle-stroke-opacity': 0.6 } });
      });
      map.on('error', () => {});
    }).catch(() => alive && setFailed(true));
    return () => { alive = false; try { map && map.remove(); } catch (_) { /* bỏ qua */ } };
  }, [lat, lng]);
  if (failed) return null;
  return <div className="relative h-44 rounded-2xl overflow-hidden border border-line bg-[#E3ECE4]">
    <div ref={box} className="absolute inset-0" aria-hidden="true" />
    {label && <span className="absolute left-3 bottom-3 bg-white rounded-full px-2.5 py-1 text-xs font-bold shadow-sm">{label}</span>}
  </div>;
}
