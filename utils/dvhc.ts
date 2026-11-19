/**
 * Danh sách 34 tỉnh/thành và 3.321 xã/phường/đặc khu (từ 01/07/2025), kèm toạ độ trung tâm.
 * Nguồn: thanglequoc/vietnamese-provinces-database (MIT), ranh giới theo sapnhap.bando.com.vn.
 * Tải một lần (≈85 KB nén) từ /data/dvhc.json, dùng hoàn toàn trên máy người dùng.
 */
export type Province = { code: string; name: string; lat: number; lng: number };
export type Ward = {
  code: string; provinceCode: string; name: string; provinceName: string;
  lat: number; lng: number; bbox: [number, number, number, number]; // minLat, minLng, maxLat, maxLng
  label: string;  // "Phường Chí Linh, Thành phố Hải Phòng"
  key: string;    // không dấu để tìm
};
type Data = { provinces: Province[]; wards: Ward[] };

import { wardRings, insideRings } from './ranhgioi';

let cache: Promise<Data> | null = null;
export function plain(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
}
export function loadDvhc(): Promise<Data> {
  if (!cache) {
    cache = fetch('/data/dvhc.json').then(r => r.json()).then((raw: any) => {
      const provinces: Province[] = raw.p.map((p: any[]) => ({ code: p[0], name: p[1], lat: p[2], lng: p[3] }));
      const pname: Record<string, string> = Object.fromEntries(provinces.map(p => [p.code, p.name]));
      const wards: Ward[] = raw.w.map((w: any[]) => {
        const label = w[2] + ', ' + pname[w[1]];
        return { code: w[0], provinceCode: w[1], name: w[2], provinceName: pname[w[1]], lat: w[3], lng: w[4], bbox: [w[5], w[6], w[7], w[8]], label, key: plain(label) };
      });
      return { provinces, wards };
    }).catch(e => { cache = null; throw e; });
  }
  return cache;
}
/** Tìm xã/phường theo chữ gõ (không cần dấu). "chi linh hai phong" vẫn ra. */
export async function searchWards(q: string, max = 8): Promise<Ward[]> {
  const words = plain(q).replace(/^(xa|phuong|dac khu)\s+/, '').split(' ').filter(Boolean);
  if (!words.length) return [];
  const { wards } = await loadDvhc();
  const hits: { w: Ward; score: number }[] = [];
  for (const w of wards) {
    if (!words.every(x => w.key.includes(x))) continue;
    const name = plain(w.name);
    const score = (name.endsWith(' ' + words.join(' ')) || name === words.join(' ') ? 0 : 1) + (name.includes(words[0]) ? 0 : 1);
    hits.push({ w, score });
  }
  return hits.sort((a, b) => a.score - b.score || a.w.label.localeCompare(b.w.label, 'vi')).slice(0, max).map(x => x.w);
}
function dist2(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dx = (lng1 - lng2) * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  const dy = lat1 - lat2;
  return dx * dx + dy * dy;
}
/** Khoảng cách gần đúng (km) giữa hai điểm. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  return Math.sqrt(dist2(lat1, lng1, lat2, lng2)) * 111.32;
}
/** Xã/phường chứa một toạ độ: thử theo ranh giới thật trước, không được thì lấy tâm gần nhất. */
export async function wardAt(lat: number, lng: number): Promise<Ward | null> {
  const { wards } = await loadDvhc();
  const pad = 0.01;
  const cands = wards.filter(w => lat >= w.bbox[0] - pad && lat <= w.bbox[2] + pad && lng >= w.bbox[1] - pad && lng <= w.bbox[3] + pad)
    .sort((a, b) => dist2(lat, lng, a.lat, a.lng) - dist2(lat, lng, b.lat, b.lng));
  for (const w of cands) {
    if (insideRings(lng, lat, await wardRings(w.provinceCode, w.code))) return w;
  }
  let best: Ward | null = null, bestD = Infinity;
  for (const w of (cands.length ? cands : wards)) {
    const d = dist2(lat, lng, w.lat, w.lng);
    if (d < bestD) { bestD = d; best = w; }
  }
  return best;
}
/** Tìm xã/phường khớp một chuỗi khu vực đã lưu (vd "Phường Chí Linh, Thành phố Hải Phòng"). */
export async function wardFromLabel(label?: string): Promise<Ward | null> {
  if (!label) return null;
  const { wards } = await loadDvhc();
  const k = plain(label);
  return wards.find(w => w.key === k) || wards.find(w => k.startsWith(plain(w.name) + ',') && k.includes(plain(w.provinceName))) || null;
}
