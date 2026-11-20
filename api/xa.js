// Số liệu công khai của một xã/phường (trang chocuatui.vn/xa/...): số tin đang hiện, số món đã trao xong,
// những người chia sẻ nhiều nhất (chỉ tên hiển thị, như trên tin). Lưu đệm CDN 10 phút.
import { countCommunity, listByArea } from './_firestore.js';

export default async function handler(req, res) {
  const ma = String((req.query && req.query.ma) || '');
  if (!/^\d{5}$/.test(ma)) { res.status(400).json({ ok: false }); return; }
  try {
    const [active, done, sold] = await Promise.all([
      countCommunity({ areaCode: ma, status: 'approved' }),
      countCommunity({ areaCode: ma, status: 'sold' }),
      listByArea(ma, 'sold', 300),
    ]);
    const tally = new Map();
    for (const l of sold) {
      if (!l.sellerId) continue;
      const t = tally.get(l.sellerId) || { id: l.sellerId, name: String(l.sellerName || 'Thành viên').slice(0, 40), n: 0 };
      t.n++; tally.set(l.sellerId, t);
    }
    const top = [...tally.values()].sort((a, b) => b.n - a.n).slice(0, 5);
    res.setHeader('cache-control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=3600');
    res.status(200).json({ ok: true, active, done, top });
  } catch (_) {
    res.setHeader('cache-control', 'no-store');
    res.status(503).json({ ok: false });
  }
}
