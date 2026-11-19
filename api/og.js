// Trang xem trước cho Zalo, Facebook, Google...: trả tiêu đề, mô tả, ảnh của tin.
// Người dùng thật không đi qua đây (vercel.json chỉ chuyển các trình thu thập link).
import { getListing, tinPath, esc, origin } from './_firestore.js';

const KIND = {
  gift: ['Cho tặng', 'Xin đồ'], borrow: ['Cho mượn', 'Mượn đồ'],
  help: ['Giúp một tay', 'Nhờ giúp'], repair: ['Sửa giúp', 'Cần sửa'],
};

export default async function handler(req, res) {
  const p = String(req.query.p || '');
  const id = p.split('-').pop();
  const site = origin(req);
  let l = null;
  try { l = await getListing(id); } catch (_) { l = null; }
  const ok = l && l.isCommunityFree === true && l.status === 'approved';
  const need = ok && l.communityIntent === 'need';
  const kind = ok && KIND[l.communityKind] ? KIND[l.communityKind][need ? 1 : 0] : '';
  const title = ok ? `${need ? 'Tôi cần' : 'Tôi có'} · ${kind}: ${l.title}` : 'Chợ Của Tui – Cộng đồng chia sẻ miễn phí';
  const desc = ok
    ? [l.location, (l.description || '').slice(0, 160), 'Miễn phí trên Chợ Của Tui.'].filter(Boolean).join(' · ')
    : 'Có gì chia sẻ, cần gì có nhau. Cho tặng, mượn đồ, giúp nhau và sửa đồ gần nhà, hoàn toàn miễn phí.';
  const image = ok && Array.isArray(l.images) && l.images[0] ? l.images[0] : `${site}/og-image.png`;
  const url = ok ? site + tinPath(l) : site + '/';
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Chợ Của Tui">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:locale" content="vi_VN">
<meta name="twitter:card" content="summary_large_image">
</head><body>
<h1>${esc(title)}</h1><p>${esc(desc)}</p><p><a href="${esc(url)}">Xem tin trên Chợ Của Tui</a></p>
</body></html>`;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'public, s-maxage=600, stale-while-revalidate=3600');
  res.status(ok ? 200 : 404).send(html);
}
