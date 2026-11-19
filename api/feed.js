// Danh sách tin cho trang chủ, phục vụ qua bộ nhớ đệm CDN của Vercel:
// nhiều người xem cùng lúc chỉ tốn một lượt đọc Firestore mỗi 2 phút.
// Chỉ trả các trường cần cho thẻ tin (không có SĐT, email, địa chỉ).
import { listNewest } from './_firestore.js';

const KINDS = ['gift', 'borrow', 'help', 'repair'];
const round2 = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

export default async function handler(req, res) {
  let rows = [], ok = true;
  try { rows = await listNewest(200); } catch (_) { rows = []; ok = false; }
  const items = rows
    .filter(l => l.isCommunityFree === true && l.status === 'approved' && l.price === 0 && KINDS.includes(l.communityKind))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .map(l => ({
      id: l.id,
      title: String(l.title || '').slice(0, 120),
      description: String(l.description || '').slice(0, 160),
      location: String(l.location || '').slice(0, 120),
      communityKind: l.communityKind,
      communityIntent: l.communityIntent === 'need' ? 'need' : 'have',
      createdAt: l.createdAt || null,
      areaCode: l.areaCode || null,
      lat: round2(l.lat), lng: round2(l.lng),
      thumb: (Array.isArray(l.thumbs) && l.thumbs[0]) || (Array.isArray(l.images) && l.images[0]) || null,
    }));
  res.setHeader('content-type', 'application/json; charset=utf-8');
  // Lỗi đọc dữ liệu: không lưu đệm lâu để lần sau thử lại
  res.setHeader('cache-control', ok
    ? 'public, max-age=30, s-maxage=120, stale-while-revalidate=600'
    : 'public, max-age=10, s-maxage=20');
  res.status(200).send(JSON.stringify({ ok, t: Date.now(), items }));
}
