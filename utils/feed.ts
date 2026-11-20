/**
 * Lấy tin cho trang chủ qua /api/feed (CDN lưu đệm, không cần tải Firebase).
 * - Trang đầu của mỗi khu vực được lưu trên máy: lần sau hiện ngay rồi cập nhật.
 * - index.html đã bắt đầu tải sẵn trang đầu (window.__feed) trước khi JavaScript chạy.
 * - /api/feed lỗi → đọc thẳng Firestore (chỉ khi xem cả nước, trang đầu).
 */
import type { CommunityListing } from '../services/community';

export type Scope = { xa?: string | null; tinh?: string | null; q?: string; nhieu?: boolean; xong?: boolean };
export type Page = { items: CommunityListing[]; next: string | null };
type Raw = { id: string; title: string; description?: string; location?: string; communityKind: string; communityIntent: string;
  createdAt?: string | null; areaCode?: string | null; provinceCode?: string | null; lat?: number | null; lng?: number | null; thumb?: string | null };

const CACHE = 'ccut-feed2-';
function toListing(r: Raw): CommunityListing {
  return {
    id: r.id, title: r.title, description: r.description || '', location: r.location || '',
    communityKind: r.communityKind as any, communityIntent: r.communityIntent as any,
    createdAt: r.createdAt || '', lat: r.lat ?? null, lng: r.lng ?? null, areaCode: r.areaCode || null, provinceCode: r.provinceCode || null,
    images: r.thumb ? [r.thumb] : [], price: 0, isCommunityFree: true, status: 'approved',
  } as any;
}
export function feedUrl(s: Scope, truoc?: string | null) {
  const p = new URLSearchParams();
  if (s.xa) p.set('xa', s.xa); else if (s.tinh) p.set('tinh', s.tinh);
  if (s.q && s.q.trim()) p.set('q', s.q.trim().toLowerCase());
  if (s.nhieu) p.set('nhieu', '1');
  if (s.xong) p.set('xong', '1');
  if (truoc) p.set('truoc', truoc);
  const qs = p.toString();
  return '/api/feed' + (qs ? '?' + qs : '');
}
const key = (s: Scope) => CACHE + (s.xa ? 'x' + s.xa : s.tinh ? 't' + s.tinh : 'vn') + (s.nhieu ? '-n' : '') + (s.xong ? '-d' : '');

/** Trang đầu đã lưu trên máy (không áp dụng cho tìm kiếm). */
export function cachedPage(s: Scope): Page | null {
  if (s.q) return null;
  try {
    const v = JSON.parse(localStorage.getItem(key(s)) || 'null');
    return v && Array.isArray(v.items) ? { items: v.items.map(toListing), next: v.next || null } : null;
  } catch (_) { return null; }
}

export async function loadPage(s: Scope, truoc?: string | null, fresh = false): Promise<Page> {
  const url = feedUrl(s, truoc) + (fresh ? (feedUrl(s, truoc).includes('?') ? '&' : '?') + 'm=' + Math.floor(Date.now() / 30000) : '');
  let data: any = null;
  const pre = (window as any).__feed as { url: string; p: Promise<any> } | undefined;
  if (!fresh && pre && pre.url === url) { (window as any).__feed = undefined; data = await pre.p.catch(() => null); }
  if (!data) {
    const r = await fetch(url).catch(() => null);
    data = r && r.ok ? await r.json().catch(() => null) : null;
  }
  if (data && data.ok !== false && Array.isArray(data.items)) {
    if (!truoc && !s.q) {
      try { localStorage.setItem(key(s), JSON.stringify({ t: Date.now(), next: data.next || null, items: data.items.slice(0, s.nhieu ? 60 : 24) })); } catch (_) { /* đầy: bỏ qua */ }
    }
    return { items: data.items.map(toListing), next: data.next || null };
  }
  if (!truoc && !s.xa && !s.tinh && !s.q) {
    const { community } = await import('../services/community');
    return { items: await community.list(), next: null };
  }
  throw new Error('Chưa tải được tin. Kiểm tra mạng rồi thử lại.');
}

/** Ghi nhớ khu vực đang xem để index.html tải sẵn đúng trang đầu ở lần mở sau. */
export function rememberScope(s: Scope) {
  try { localStorage.setItem('ccut-feed-scope', feedUrl({ xa: s.xa, tinh: s.tinh, nhieu: s.nhieu })); } catch (_) { /* bỏ qua */ }
}

/** Xoá danh sách tin đã lưu trên máy (sau khi mình đăng, sửa, ẩn hoặc xoá tin) để lần xem sau tải bản mới. */
export function clearFeedCache() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(CACHE)) localStorage.removeItem(k); }
  } catch (_) { /* bỏ qua */ }
}
