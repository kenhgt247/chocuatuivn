// Thử nhanh _worker.js sau khi build (chạy trong GitHub Actions, không cần Cloudflare).
import worker from '../dist/_worker.js';
globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
import { readFileSync } from 'node:fs';
const INDEX = '<!doctype html><html><head><title>x</title><meta name="description" content="y" /></head><body><div id="root"><div>sk</div></div>\n<script type="module" src="/a.js"></script>tinh</body></html>';
const env = { ASSETS: { fetch: async (req) => {
  const u = new URL(typeof req === 'string' ? req : req.url);
  if (u.pathname === '/data/dvhc.json') return new Response(readFileSync(new URL('../public/data/dvhc.json', import.meta.url)), { headers: { 'content-type': 'application/json' } });
  return new Response(INDEX, { headers: { 'content-type': 'text/html' } });
} } };
const ctx = { waitUntil() {} };
const call = (p, ua = 'Mozilla/5.0') => worker.fetch(new Request('https://www.chocuatui.vn' + p, { headers: { 'user-agent': ua } }), env, ctx);
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'OK  ' : 'LỖI ') + name); if (!ok) fail++; };
const feed = await call('/api/feed'); const fj = await feed.json().catch(() => null);
check('api/feed trả JSON', feed.status === 200 && fj && Array.isArray(fj.items));
check('api/feed có cache-control', /s-maxage/.test(feed.headers.get('cache-control') || ''));
const page = await call('/cong-dong/yeu-cau'); check('trang thường → tệp tĩnh', (await page.text()).includes('tinh'));
const bot = await call('/cong-dong/tin/thu-abc', 'facebookexternalhit/1.1'); check('bot → trang xem trước', /og:title/.test(await bot.text()));
const sm = await call('/sitemap.xml'); check('sitemap', sm.status === 200 && (await sm.text()).includes('<urlset'));
const xa = await call('/xa/00004-phuong-ba-dinh'); const xt = await xa.text();
check('trang xã/phường có tiêu đề + nội dung cho Google', xa.status === 200 && /<title>Cho tặng đồ cũ[^<]*Ba Đình/.test(xt) && /rel="canonical"/.test(xt) && /<h1[^>]*>Cho tặng/.test(xt) && xt.includes('src="/a.js"'));
const xa2 = await call('/xa/99999-khong-co'); check('xã lạ → trang thường', (await xa2.text()).includes('tinh'));
const nf = await call('/api/khong-co'); check('api lạ → 404', nf.status === 404);
process.exit(fail ? 1 : 0);
