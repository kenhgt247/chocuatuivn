/**
 * Chạy Chợ Của Tui trên Cloudflare Pages (thay Vercel):
 * - /api/<tên>        → các hàm trong thư mục api/ (giữ nguyên code, qua lớp chuyển đổi req/res)
 * - /sitemap.xml      → api/sitemap
 * - /cong-dong/tin/…  → trang xem trước cho Zalo/Facebook (chỉ với trình thu thập link)
 * - còn lại           → tệp tĩnh; đường dẫn lạ trả về index.html (ứng dụng một trang)
 * Phản hồi có s-maxage được lưu đệm ở Cloudflare để đỡ đọc Firestore.
 */
import ROUTES from './routes.js';
import { API_KEY } from '../api/_firestore.js';
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

// Số phiên dữ liệu tin (system/feed.v, do Cloud Function moiTin tăng mỗi khi tin đổi).
// Đọc lại tối đa mỗi 10 giây; khoá lưu đệm gắn số phiên nên tin mới/xoá hiện ra gần như ngay.
let VER = { v: 0, at: 0 };
async function feedVersion() {
  if (Date.now() - VER.at < 10000) return VER.v;
  try {
    const r = await fetch('https://firestore.googleapis.com/v1/projects/chocuatui-3e65c/databases/(default)/documents/system/feed?key=' + FB_KEY);
    const j = r.ok ? await r.json() : null;
    const v = Number(j && j.fields && j.fields.v && (j.fields.v.integerValue || j.fields.v.doubleValue)) || 0;
    VER = { v, at: Date.now() };
  } catch (_) { VER = { v: VER.v, at: Date.now() }; }
  return VER.v;
}

async function cached(request, ctx, make, versioned = false) {
  if (request.method !== 'GET') return make();
  const cache = caches.default;
  const v = versioned ? await feedVersion() : 0;
  let key = request;
  if (versioned) { const u = new URL(request.url); u.searchParams.set('__v', String(v)); u.searchParams.set('__k', '2'); key = new Request(u.toString()); }
  const hit = await cache.match(key);
  if (hit) return hit;
  let resp = await make();
  const cc = resp.headers.get('cache-control') || '';
  if (versioned && resp.status === 200 && /s-maxage=\d+/.test(cc)) {
    // Trình duyệt không giữ bản cũ; máy chủ giữ lâu hơn khi đã có số phiên (đổi tin là đổi khoá)
    resp = new Response(resp.body, resp);
    resp.headers.set('cache-control', v ? 'public, max-age=0, s-maxage=900' : 'public, max-age=0, s-maxage=45');
  }
  const cc2 = resp.headers.get('cache-control') || '';
  if (resp.status === 200 && /s-maxage=\d+/.test(cc2)) {
    // Bộ nhớ đệm của Worker không có "nguồn" để làm mới ngầm: bỏ stale-while-revalidate,
    // nếu không bản cũ (vd. tin đã xoá) có thể còn bị trả về thêm nhiều phút.
    const toStore = new Response(resp.clone().body, resp);
    toStore.headers.set('cache-control', cc2.replace(/,?\s*stale-while-revalidate=\d+/g, '').replace(/,?\s*stale-if-error=\d+/g, ''));
    ctx.waitUntil(cache.put(key, toStore));
  }
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
        const r = await wardPage(request, env, ctx, await feedVersion()).catch(() => null);
        if (r) return r;
      }
      if (path.startsWith('/api/')) {
        const name = path.slice(5).replace(/\/+$/, '');
        const handler = ROUTES[name];
        if (!handler) return new Response('Not found', { status: 404 });
        return cached(request, ctx, () => run(handler, request), name === 'feed' || name === 'xa');
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
