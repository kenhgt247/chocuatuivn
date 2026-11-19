/**
 * Khu vực (xã/phường) người dùng đang xem. Lưu trên máy, mặc định lấy từ hồ sơ.
 * Không dùng GPS.
 */
const KEY = 'ccut-area';
const EVENT = 'ccut-area-change';

export function getArea(fallback = ''): string {
  try { return localStorage.getItem(KEY) ?? fallback; } catch (_) { return fallback; }
}
export function setArea(value: string) {
  try { localStorage.setItem(KEY, value.trim()); } catch (_) { /* bỏ qua */ }
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
