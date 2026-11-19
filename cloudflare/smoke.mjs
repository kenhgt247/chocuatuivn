// Thử nhanh _worker.js sau khi build (chạy trong GitHub Actions, không cần Cloudflare).
import worker from '../dist/_worker.js';
globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
const env = { ASSETS: { fetch: async () => new Response('<!doctype html>tinh', { headers: { 'content-type': 'text/html' } }) } };
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
const nf = await call('/api/khong-co'); check('api lạ → 404', nf.status === 404);
process.exit(fail ? 1 : 0);
