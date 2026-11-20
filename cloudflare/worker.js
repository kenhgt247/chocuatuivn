/**
 * Chạy Chợ Của Tui trên Cloudflare Pages (thay Vercel):
 * - /api/<tên>        → các hàm trong thư mục api/ (giữ nguyên code, qua lớp chuyển đổi req/res)
 * - /sitemap.xml      → api/sitemap
 * - /cong-dong/tin/…  → trang xem trước cho Zalo/Facebook (chỉ với trình thu thập link)
 * - còn lại           → tệp tĩnh; đường dẫn lạ trả về index.html (ứng dụng một trang)
 * Phản hồi có s-maxage được lưu đệm ở Cloudflare để đỡ đọc Firestore.
 */
import ROUTES from './routes.js';
import { wardPage } from './xa.js';

const BOT = /(facebookexternalhit|Facebot|facebot|Zalo|zalo|Twitterbot|TelegramBot|Slackbot|Discordbot|WhatsApp|LinkedInBot|SkypeUriPreview|Googlebot|bingbot|coccocbot|Applebot)/;

async function run(handler, request, extraQuery) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams);
  Object.assign(query, extraQuery || {});
  const headers = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  headers.host = url.host;
  let status = 200; let body = '';
  const h = new Headers();
  const res = {
    setHeader(k, v) { h.set(k, String(v)); return res; },
    status(c) { status = c; return res; },
    send(b) { body = b; return res; },
    json(o) { h.set('content-type', 'application/json; charset=utf-8'); body = JSON.stringify(o); return res; },
    end(b) { if (b != null) body = b; return res; },
  };
  await handler({ query, headers, method: request.method, url: url.pathname + url.search }, res);
  return new Response(body, { status, headers: h });
}

async function cached(request, ctx, make) {
  if (request.method !== 'GET') return make();
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  const resp = await make();
  const cc = resp.headers.get('cache-control') || '';
  if (resp.status === 200 && /s-maxage=\d+/.test(cc)) ctx.waitUntil(cache.put(request, resp.clone()));
  return resp;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/sitemap.xml') return cached(request, ctx, () => run(ROUTES.sitemap, request));
      if (path.startsWith('/cong-dong/tin/') && BOT.test(request.headers.get('user-agent') || '')) {
        const p = decodeURIComponent(path.slice('/cong-dong/tin/'.length).split('/')[0]);
        return cached(request, ctx, () => run(ROUTES.og, request, { p }));
      }
      if (path.startsWith('/xa/')) {
        const r = await wardPage(request, env, ctx).catch(() => null);
        if (r) return r;
      }
      if (path.startsWith('/api/')) {
        const name = path.slice(5).replace(/\/+$/, '');
        const handler = ROUTES[name];
        if (!handler) return new Response('Not found', { status: 404 });
        return cached(request, ctx, () => run(handler, request));
      }
    } catch (e) {
      return new Response('Lỗi máy chủ', { status: 500 });
    }
    const resp = await env.ASSETS.fetch(request);
    if (path === '/.well-known/assetlinks.json') {
      const r = new Response(resp.body, resp);
      r.headers.set('content-type', 'application/json');
      r.headers.set('access-control-allow-origin', '*');
      return r;
    }
    return resp;
  },
};
