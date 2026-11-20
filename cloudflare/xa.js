/**
 * Trang /xa/<mã>-<tên> cho Google: trả index.html đã gắn sẵn tiêu đề, mô tả, dữ liệu có cấu trúc
 * và nội dung chữ (tin mới, xã/phường lân cận, hỏi đáp) để máy tìm kiếm đọc được ngay.
 * Ứng dụng React tải xong sẽ thay phần nội dung này như bình thường.
 */
import { listCommunity, countCommunity, tinPath, esc } from '../api/_firestore.js';

let DV = null;
const KIND = { gift: ['Cho tặng', 'Xin đồ'], borrow: ['Cho mượn', 'Mượn đồ'], help: ['Giúp một tay', 'Nhờ giúp'], repair: ['Sửa giúp', 'Cần sửa'] };
const plain = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const slug = s => plain(s).replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
const shortProv = s => String(s || '').replace(/^(Thành phố|Tỉnh)\s+/, '');
const km = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
const ago = iso => { const m = (Date.now() - Date.parse(iso)) / 6e4; return !(m >= 0) ? '' : m < 60 ? Math.max(1, Math.round(m)) + ' phút trước' : m < 1440 ? Math.round(m / 60) + ' giờ trước' : Math.round(m / 1440) + ' ngày trước'; };

async function build(request, env) {
  const url = new URL(request.url);
  const code = decodeURIComponent(url.pathname.slice(4)).split('-')[0];
  if (!/^\d{5}$/.test(code)) return null;
  if (!DV) DV = await (await env.ASSETS.fetch(new Request(url.origin + '/data/dvhc.json'))).json();
  const w = DV.w.find(x => x[0] === code);
  if (!w) return null;
  const [, pcode, name, lat, lng] = w;
  const prov = shortProv((DV.p.find(p => p[0] === pcode) || [])[1]);
  const path = '/xa/' + code + '-' + slug(name);
  const site = url.origin;
  const [items, active, done] = await Promise.all([
    listCommunity({ eq: { areaCode: code }, max: 24 }).catch(() => []),
    countCommunity({ areaCode: code, status: 'approved' }).catch(() => 0),
    countCommunity({ areaCode: code, status: 'sold' }).catch(() => 0),
  ]);
  const near = DV.w.filter(x => x[1] === pcode && x[0] !== code).map(x => ({ x, d: km(lat, lng, x[3], x[4]) })).sort((a, b) => a.d - b.d).slice(0, 10).map(o => o.x);

  const title = `Cho tặng đồ cũ, mượn đồ, giúp nhau miễn phí ở ${name}, ${prov} – Chợ Của Tui`;
  const desc = `${active ? active + ' tin đang chia sẻ' : 'Góc chia sẻ'} ở ${name} (${prov})${done ? ', ' + done + ' món đã trao xong' : ''}. Cho tặng đồ cũ, mượn đồ, nhờ giúp, sửa đồ cho hàng xóm. Hoàn toàn miễn phí, không mua bán.`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, url: site + path, inLanguage: 'vi',
      about: { '@type': 'Place', name: name + ', ' + prov, geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Chợ Của Tui', item: site + '/' },
      { '@type': 'ListItem', position: 2, name: prov },
      { '@type': 'ListItem', position: 3, name, item: site + path }] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: `Ở ${name} có chỗ nào cho đồ cũ miễn phí không?`, acceptedAnswer: { '@type': 'Answer', text: `Có. Trên Chợ Của Tui, hàng xóm ở ${name} đăng đồ muốn cho, bạn bấm "Xin món này" để nhắn và hẹn chỗ lấy. Không mất phí, không mua bán.` } },
      { '@type': 'Question', name: 'Cho đồ cũ trên Chợ Của Tui có mất tiền không?', acceptedAnswer: { '@type': 'Answer', text: 'Không. Mọi việc cho tặng, cho mượn, giúp nhau và sửa đồ đều miễn phí. Không chuyển khoản hay đặt cọc cho bất kỳ ai.' } },
    ] },
  ];
  const card = l => {
    const k = KIND[l.communityKind] ? KIND[l.communityKind][l.communityIntent === 'need' ? 1 : 0] : '';
    return `<li style="padding:10px 0;border-top:1px solid #E7E0D0"><a href="${esc(tinPath(l))}" style="font-weight:700;color:#1D2A22">${esc(l.title)}</a>`
      + `<div style="font-size:13px;color:#56645A">${esc((l.communityIntent === 'need' ? 'Tôi cần' : 'Tôi có') + ' · ' + k)} · ${esc(String(l.location || '').split(',')[0])}${l.createdAt ? ' · ' + esc(ago(l.createdAt)) : ''}</div></li>`;
  };
  const body = `<main style="max-width:880px;margin:0 auto;padding:20px 16px;font-family:system-ui,sans-serif;color:#1D2A22;background:#FBF7EE">
<p style="margin:0;font-size:14px"><a href="/" style="color:#1F6F43">Chợ Của Tui</a> › ${esc(prov)} › ${esc(name)}</p>
<h1 style="font-size:26px;line-height:1.25;margin:10px 0">Cho tặng đồ cũ, mượn đồ, giúp nhau miễn phí ở ${esc(name)}</h1>
<p style="color:#3B4A40">${esc(desc)}</p>
<h2 style="font-size:19px;margin-top:20px">Tin mới ở ${esc(name)}</h2>
${items.length ? `<ul style="list-style:none;padding:0;margin:0">${items.map(card).join('')}</ul>` : `<p>Chưa có tin nào. <a href="/cong-dong/dang-tin" style="color:#1F6F43">Đăng tin đầu tiên ở ${esc(name)}</a>.</p>`}
<h2 style="font-size:19px;margin-top:20px">Xã/phường lân cận ở ${esc(prov)}</h2>
<p>${near.map(x => `<a href="/xa/${x[0]}-${slug(x[2])}" style="color:#1F6F43;margin-right:12px">${esc(x[2])}</a>`).join(' ')}</p>
<h2 style="font-size:19px;margin-top:20px">Cách hoạt động</h2>
<ol><li>Đăng món muốn cho, đồ muốn cho mượn, hoặc việc cần giúp ở ${esc(name)}.</li><li>Hàng xóm bấm xin và nhắn tin hẹn chỗ, giờ lấy.</li><li>Trao xong thì gửi lời cảm ơn. Không tiền, không mua bán.</li></ol>
</main>`;

  return { title, desc, ld, body, canonical: site + path };
}

/** Dữ liệu trang (tin, số liệu) lưu đệm 10 phút; khung index.html luôn lấy bản mới nhất để khớp tệp JS sau mỗi lần cập nhật web. */
export async function wardPage(request, env, ctx) {
  const url = new URL(request.url);
  const key = new Request(url.origin + '/__xa-data/' + encodeURIComponent(url.pathname.slice(4)));
  const cache = caches.default;
  let data = null;
  const hit = await cache.match(key);
  if (hit) data = await hit.json();
  else {
    data = await build(request, env);
    if (!data) return null;
    ctx.waitUntil(cache.put(key, new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=600' } })));
  }
  const { title, desc, ld, body, canonical } = data;
  let html = await (await env.ASSETS.fetch(new Request(url.origin + '/'))).text();
  const head = `<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:url" content="${esc(canonical)}" />
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(desc)}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(desc)}" />`)
    .replace('</head>', head + '\n</head>')
    .replace(/<div id="root">[\s\S]*?<\/div>\s*(?=<script type="module")/, `<div id="root">${body}</div>\n    `);
  return new Response(html, { status: 200, headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'public, max-age=0, must-revalidate',
  } });
}
