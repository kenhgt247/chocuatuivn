/**
 * Khu vực (xã/phường) người dùng đang xem. Lưu trên máy, mặc định lấy từ hồ sơ.
 * Không dùng GPS.
 */
const KEY = 'ccut-area';
const EVENT = 'ccut-area-change';

export function getArea(fallback = ''): string {
  try { return localStorage.getItem(KEY) ?? fallback; } catch (_) { return fallback; }
}
export function setArea(value: string, point?: { lat: number; lng: number } | null) {
  try {
    localStorage.setItem(KEY, value.trim());
    if (point) localStorage.setItem(KEY + '-pt', JSON.stringify(point)); else localStorage.removeItem(KEY + '-pt');
  } catch (_) { /* bỏ qua */ }
  window.dispatchEvent(new Event(EVENT));
}
export function onAreaChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
/** Phần đầu của khu vực, ví dụ "Phường Chí Linh, Hải Phòng" -> "phường chí linh". */
export function areaKey(value?: string): string {
  return (value || '').split(',')[0].trim().toLowerCase();
}
export function sameArea(a?: string, b?: string): boolean {
  const x = areaKey(a), y = areaKey(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}
/** Toạ độ trung tâm xã/phường đang chọn (để căn bản đồ, tính khoảng cách). */
export function getAreaPoint(): { lat: number; lng: number } | null {
  try { const v = localStorage.getItem(KEY + '-pt'); return v ? JSON.parse(v) : null; } catch (_) { return null; }
}
