/** Chế độ chữ to: lưu trên máy, áp dụng ngay khi mở web (index.html cũng đọc trước để khỏi nháy). */
const KEY = 'ccut-chu-to';
export function isBigText(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; }
}
export function setBigText(on: boolean) {
  try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch (_) { /* bỏ qua */ }
  document.documentElement.classList.toggle('chu-to', on);
}
