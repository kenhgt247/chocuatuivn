/**
 * Danh sách tin trang chủ, lấy nhanh và rẻ:
 * 1. Có bản đã lưu trên máy → hiện ngay (lần vào sau gần như tức thì).
 * 2. Lấy bản mới từ /api/feed (CDN lưu đệm 2 phút, không cần tải Firebase).
 *    index.html đã bắt đầu tải sẵn từ trước khi mã JavaScript chạy (window.__feed).
 * 3. /api/feed lỗi → đọc thẳng Firestore như trước.
 */
import type { CommunityListing } from '../services/community';

const KEY = 'ccut-feed-v1';
type Raw = { id: string; title: string; description?: string; location?: string; communityKind: string; communityIntent: string;
  createdAt?: string | null; areaCode?: string | null; lat?: number | null; lng?: number | null; thumb?: string | null };

function toListing(r: Raw): CommunityListing {
  return {
    id: r.id, title: r.title, description: r.description || '', location: r.location || '',
    communityKind: r.communityKind as any, communityIntent: r.communityIntent as any,
    createdAt: r.createdAt || '', lat: r.lat ?? null, lng: r.lng ?? null, areaCode: r.areaCode || null,
    images: r.thumb ? [r.thumb] : [], price: 0, isCommunityFree: true, status: 'approved',
  } as any;
}

/** Bản đã lưu lần trước (nếu có). */
export function cachedFeed(): CommunityListing[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && Array.isArray(v.items) ? v.items.map(toListing) : null;
  } catch (_) { return null; }
}

/** Bản mới nhất từ máy chủ. */
export async function freshFeed(): Promise<CommunityListing[]> {
  let data: any = null;
  const pre = (window as any).__feed as Promise<any> | undefined;
  if (pre) { (window as any).__feed = undefined; data = await pre.catch(() => null); }
  if (!data) {
    const r = await fetch('/api/feed').catch(() => null);
    data = r && r.ok ? await r.json().catch(() => null) : null;
  }
  if (data && data.ok !== false && Array.isArray(data.items)) {
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), items: data.items })); } catch (_) { /* đầy bộ nhớ: bỏ qua */ }
    return data.items.map(toListing);
  }
  // Dự phòng: đọc Firestore trực tiếp (tải Firebase lúc cần)
  const { community } = await import('../services/community');
  return community.list();
}
