// Trang chủ: "Lời cảm ơn mới" và "Hàng xóm nổi bật tháng" (vinh danh người cho).
// Chỉ dùng dữ liệu công khai: lời cảm ơn (thanks) và hồ sơ công khai (tên, ảnh, số lần chia sẻ).
// Lưu đệm CDN 10 phút.
import { queryDocs, getMany } from './_firestore.js';

const clip = (s, n) => String(s || '').slice(0, n);
const vnMonth = () => { const d = new Date(Date.now() + 7 * 3600e3); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, start: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - 7 * 3600e3).toISOString() }; };

export default async function handler(req, res) {
  try {
    const { m, start } = vnMonth();
    const thanks = await queryDocs({ from: [{ collectionId: 'thanks' }], orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }], limit: 200 });
    // Xếp hạng tháng này theo số lời cảm ơn người cho nhận được
    const tally = new Map();
    for (const t of thanks) if (t.giverId && String(t.createdAt || '') >= start) tally.set(t.giverId, (tally.get(t.giverId) || 0) + 1);
    let mode = 'thang';
    let top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => ({ id, n }));
    if (top.length < 2) {
      // Tháng này còn ít: lấy những người đã chia sẻ nhiều nhất từ trước tới nay
      mode = 'tatca';
      const ps = await queryDocs({ from: [{ collectionId: 'publicProfiles' }], orderBy: [{ field: { fieldPath: 'sharedCount' }, direction: 'DESCENDING' }], limit: 4 }).catch(() => []);
      top = ps.filter(p => (p.sharedCount || 0) > 0).map(p => ({ id: p.id, n: p.sharedCount || 0 }));
    }
    const recent = thanks.slice(0, 12);
    const ids = [...new Set([...top.map(x => x.id), ...recent.map(t => t.giverId).filter(Boolean)])];
    const prof = await getMany(ids.map(id => 'publicProfiles/' + id));
    const p = id => prof['publicProfiles/' + id] || {};
    const out = {
      ok: true, month: m, mode,
      thanks: recent.map(t => ({
        id: t.id, giverId: t.giverId, giverName: clip(p(t.giverId).name || 'Thành viên', 40),
        receiverName: clip(t.receiverName || 'Thành viên', 40), receiverAvatar: clip(t.receiverAvatar, 600) || null,
        message: clip(t.message, 300), listingId: t.listingId || null, listingTitle: clip(t.listingTitle, 90),
        kind: t.kind || 'gift', photo: clip(t.photo, 600) || null, createdAt: t.createdAt || null,
      })),
      top: top.filter(x => p(x.id).name).map(x => ({
        id: x.id, n: x.n, name: clip(p(x.id).name, 40), avatar: clip(p(x.id).avatar, 600) || null,
        location: clip(String(p(x.id).location || '').split(',')[0], 40), sharedCount: p(x.id).sharedCount || 0,
        sharedByKind: p(x.id).sharedByKind || {},
      })),
    };
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=3600');
    res.status(200).send(JSON.stringify(out));
  } catch (_) {
    res.setHeader('cache-control', 'public, max-age=10, s-maxage=30');
    res.status(200).json({ ok: false, thanks: [], top: [] });
  }
}
