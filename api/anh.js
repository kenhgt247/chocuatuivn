// Lấy ảnh tin từ Firebase Storage qua chính tên miền này, để trình duyệt vẽ được "ảnh thẻ tin" khi chia sẻ.
// Chỉ nhận ảnh trong kho của Chợ Của Tui.
const ALLOW = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/chocuatui-3e65c\.(firebasestorage\.app|appspot\.com)\/o\/listings%2F/;

export default async function handler(req, res) {
  const u = String((req.query && req.query.u) || '');
  if (!ALLOW.test(u)) { res.status(400).send('Ảnh không hợp lệ'); return; }
  try {
    const r = await fetch(u);
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !type.startsWith('image/')) { res.status(404).send('Không tìm thấy ảnh'); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 6 * 1024 * 1024) { res.status(413).send('Ảnh quá lớn'); return; }
    res.setHeader('content-type', type);
    res.setHeader('cache-control', 'public, max-age=86400, s-maxage=604800, immutable');
    res.status(200).send(buf);
  } catch (_) { res.status(502).send('Lỗi tải ảnh'); }
}
