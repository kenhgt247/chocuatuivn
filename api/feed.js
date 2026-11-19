// Danh sách tin cho trang chủ, phục vụ qua bộ nhớ đệm CDN của Vercel:
// nhiều người xem cùng khu vực chỉ tốn một lượt đọc Firestore mỗi 2 phút.
// Chỉ trả các trường cần cho thẻ tin (không có SĐT, email, địa chỉ).
//   /api/feed                 : mới nhất cả nước
//   /api/feed?tinh=31         : trong tỉnh/thành
//   /api/feed?xa=10537        : trong xã/phường
//   &q=xe dap                 : tìm theo chữ
//   &truoc=<createdAt>        : trang tiếp theo
import { listCommunity } from './_firestore.js';

const KINDS = ['gift', 'borrow', 'help', 'repair'];
const round2 = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const plain = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const one = v => (Array.isArray(v) ? v[0] : v);

export default async function handler(req, res) {
  const q = req.query || {};
  const tinh = /^\d{2}$/.test(one(q.tinh) || '') ? one(q.tinh) : null;
  const xa = /^\d{5}$/.test(one(q.xa) || '') ? one(q.xa) : null;
  const truoc = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(one(q.truoc) || '') ? one(q.truoc) : null;
  const words = plain(one(q.q)).split(' ').filter(w => w.length >= 2).slice(0, 5);
  const size = words.length ? 40 : 24;

  let rows = [], ok = true;
  try {
    rows = await listCommunity({
      eq: xa ? { areaCode: xa } : tinh ? { provinceCode: tinh } : {},
      // Tìm từ dài nhất trên máy chủ, các từ còn lại lọc ở đây
      contains: words.length ? [...words].sort((a, b) => b.length - a.length)[0] : null,
      before: truoc, max: size,
    });
  } catch (_) { ok = false; }

  const next = rows.length >= size ? String(rows[rows.length - 1].createdAt || '') || null : null;
  const items = rows
    .filter(l => l.price === 0 && KINDS.includes(l.communityKind))
    .filter(l => !words.length || words.every(w => plain([l.title, l.description, l.location].join(' ')).includes(w)))
    .map(l => ({
      id: l.id,
      title: String(l.title || '').slice(0, 120),
      description: String(l.description || '').slice(0, 160),
      location: String(l.location || '').slice(0, 120),
      communityKind: l.communityKind,
      communityIntent: l.communityIntent === 'need' ? 'need' : 'have',
      createdAt: l.createdAt || null,
      areaCode: l.areaCode || null,
      provinceCode: l.provinceCode || null,
      lat: round2(l.lat), lng: round2(l.lng),
      thumb: (Array.isArray(l.thumbs) && l.thumbs[0]) || (Array.isArray(l.images) && l.images[0]) || null,
    }));

  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', !ok ? 'public, max-age=10, s-maxage=20'
    : words.length ? 'public, max-age=60, s-maxage=120, stale-while-revalidate=600'
    : truoc ? 'public, max-age=120, s-maxage=600, stale-while-revalidate=3600'
    : 'public, max-age=30, s-maxage=120, stale-while-revalidate=600');
  res.status(200).send(JSON.stringify({ ok, t: Date.now(), next, items }));
}
