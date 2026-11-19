/**
 * Máy chủ web cho Firebase Hosting (thay cho Vercel):
 *   /api/<tên>       → hàm trong thư mục api/ (được chép vào web-api/ lúc đưa lên)
 *   /sitemap.xml     → api/sitemap
 *   /cong-dong/tin/… → trình thu thập link (Zalo, Facebook…) nhận trang xem trước; người thật nhận index.html
 * Firebase Hosting lưu đệm phản hồi theo s-maxage, nên Firestore ít bị đọc.
 */
const { onRequest } = require('firebase-functions/v2/https');
const path = require('path');
const fs = require('fs');

const BOT = /(facebookexternalhit|Facebot|facebot|Zalo|zalo|Twitterbot|TelegramBot|Slackbot|Discordbot|WhatsApp|LinkedInBot|SkypeUriPreview|Googlebot|bingbot|coccocbot|Applebot)/;
let NAMES = [];
try { NAMES = JSON.parse(fs.readFileSync(path.join(__dirname, 'web-api', 'danh-sach.json'), 'utf8')); } catch (_) { NAMES = []; }
const mods = {};
async function handlerOf(name) {
  if (!NAMES.includes(name)) return null;
  if (!mods[name]) mods[name] = (await import('./web-api/' + name + '.js')).default;
  return mods[name];
}
let shell = { html: '', at: 0 };
async function indexHtml(host) {
  if (shell.html && Date.now() - shell.at < 60000) return shell.html;
  const r = await fetch('https://' + host + '/index.html');
  if (r.ok) shell = { html: await r.text(), at: Date.now() };
  return shell.html;
}

exports.web = onRequest({ region: 'asia-southeast1', memory: '256MiB', maxInstances: 10, concurrency: 80 }, async (req, res) => {
  const p = req.path || '/';
  req.headers.host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    if (p === '/sitemap.xml') return (await handlerOf('sitemap'))(req, res);
    if (p.startsWith('/cong-dong/tin/')) {
      if (BOT.test(req.headers['user-agent'] || '')) {
        const r2 = Object.create(req);
        Object.defineProperty(r2, 'query', { value: { ...req.query, p: decodeURIComponent(p.slice('/cong-dong/tin/'.length).split('/')[0]) } });
        Object.defineProperty(r2, 'headers', { value: req.headers });
        return (await handlerOf('og'))(r2, res);
      }
      const html = await indexHtml(req.headers.host);
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.setHeader('cache-control', 'public, max-age=0, s-maxage=60');
      return res.status(200).send(html);
    }
    if (p.startsWith('/api/')) {
      const h = await handlerOf(p.slice(5).replace(/\/+$/, ''));
      if (!h) return res.status(404).send('Không có');
      return h(req, res);
    }
    res.status(404).send('Không có');
  } catch (e) {
    console.error(e);
    res.status(500).send('Lỗi máy chủ');
  }
});
