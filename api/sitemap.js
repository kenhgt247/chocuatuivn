// Sitemap tự cập nhật: trang chủ, trang thông tin và mọi tin cộng đồng đang hiện.
import { listApproved, tinPath, esc, origin } from './_firestore.js';

export default async function handler(req, res) {
  const site = origin(req);
  let items = [];
  try { items = await listApproved(1000); } catch (_) { items = []; }
  const pages = ['/', '/cong-dong/dang-tin', '/page/gioi-thieu', '/page/quy-tac', '/page/an-toan'];
  const urls = pages.map(p => `<url><loc>${esc(site + p)}</loc><changefreq>${p === '/' ? 'hourly' : 'monthly'}</changefreq></url>`)
    .concat(items.map(l => {
      const d = String(l.updatedAt || l.createdAt || '').slice(0, 10);
      return `<url><loc>${esc(site + tinPath(l))}</loc>${/^\d{4}-\d{2}-\d{2}$/.test(d) ? `<lastmod>${d}</lastmod>` : ''}<changefreq>daily</changefreq></url>`;
    }));
  res.setHeader('content-type', 'application/xml; charset=utf-8');
  res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
}
