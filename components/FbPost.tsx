/**
 * Quản trị · "Soạn bài Facebook hôm nay": chọn 3–4 tin mới có ảnh, máy ghép thành một ảnh 1080×1350
 * và viết sẵn đoạn chữ. Quản trị tải ảnh, chép chữ rồi tự đăng lên trang (không đăng tự động).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { loadPage } from '../utils/feed';
import { thumbOf, tinPath } from '../utils/format';
import type { CommunityListing } from '../services/community';
import { FB_PAGE } from './FacebookCard';

const KIND: Record<string, [string, string]> = { gift: ['Cho tặng', 'Xin đồ'], borrow: ['Cho mượn', 'Mượn đồ'], help: ['Giúp một tay', 'Nhờ giúp'], repair: ['Sửa giúp', 'Cần sửa'] };
const label = (l: CommunityListing) => (l.communityIntent === 'need' ? 'Tôi cần · ' : 'Tôi có · ') + (KIND[l.communityKind || 'gift'] || KIND.gift)[l.communityIntent === 'need' ? 1 : 0];
const place = (l: CommunityListing) => String(l.location || '').split(',')[0].replace(/^(Phường|Xã|Đặc khu)\s+/, '');

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise(res => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}
const proxied = (u: string) => u.startsWith('https://firebasestorage') ? '/api/anh?u=' + encodeURIComponent(u) : u;
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function fit(c: CanvasRenderingContext2D, t: string, max: number) {
  if (c.measureText(t).width <= max) return t;
  while (t.length > 1 && c.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

async function makeCollage(items: CommunityListing[]): Promise<Blob | null> {
  await (document as any).fonts?.load?.('800 60px "Be Vietnam Pro"').catch(() => {});
  const W = 1080, H = 1350, F = '"Be Vietnam Pro", system-ui, sans-serif';
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'); if (!c) return null;
  c.fillStyle = '#FBF7EE'; c.fillRect(0, 0, W, H);
  // Đầu
  c.fillStyle = '#1F6F43'; c.fillRect(0, 0, W, 190);
  c.fillStyle = '#fff'; c.font = '800 60px ' + F; c.fillText('Hôm nay có gì cho nhau?', 56, 100);
  c.font = '500 34px ' + F; c.fillStyle = '#DCEFE2';
  c.fillText(new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' }) + ' · Miễn phí, không mua bán', 56, 155);
  // Lưới 2×2
  const n = items.length, cols = n === 1 ? 1 : 2, rows = n <= 2 ? 1 : 2;
  const gx = 40, top = 220, gap = 24, bottomH = 150;
  const cw = (W - gx * 2 - gap * (cols - 1)) / cols, ch = (H - top - bottomH - 30 - gap * (rows - 1)) / rows;
  for (let i = 0; i < n; i++) {
    const l = items[i], x = gx + (i % cols) * (cw + gap), y = top + Math.floor(i / cols) * (ch + gap);
    c.save(); rr(c, x, y, cw, ch, 28); c.clip();
    c.fillStyle = '#E3EEE6'; c.fillRect(x, y, cw, ch);
    const src = thumbOf(l) || (l.images || [])[0];
    const img = src ? await loadImg(proxied(src)) : null;
    const ih = ch - 120;
    if (img) { const k = Math.max(cw / img.width, ih / img.height); const w = img.width * k, h = img.height * k; c.drawImage(img, x + (cw - w) / 2, y + (ih - h) / 2, w, h); }
    c.fillStyle = '#fff'; c.fillRect(x, y + ih, cw, 120);
    c.restore();
    // nhãn loại
    c.font = '700 26px ' + F; const lb = label(l); const bw = c.measureText(lb).width + 32;
    c.fillStyle = l.communityIntent === 'need' ? '#FCEFD2' : '#E3EEE6'; rr(c, x + 18, y + 18, bw, 48, 24); c.fill();
    c.fillStyle = l.communityIntent === 'need' ? '#7A4B00' : '#123524'; c.fillText(lb, x + 34, y + 51);
    c.fillStyle = '#1D2A22'; c.font = '800 34px ' + F; c.fillText(fit(c, l.title, cw - 40), x + 20, y + ih + 50);
    c.fillStyle = '#56645A'; c.font = '500 28px ' + F; c.fillText(fit(c, '📍 ' + place(l), cw - 40), x + 20, y + ih + 92);
  }
  // Chân
  c.fillStyle = '#1F6F43'; c.fillRect(0, H - bottomH, W, bottomH);
  const logo = await loadImg('/icons/icon-192.png');
  if (logo) { c.save(); rr(c, 56, H - 118, 86, 86, 22); c.clip(); c.drawImage(logo, 56, H - 118, 86, 86); c.restore(); }
  c.fillStyle = '#fff'; c.font = '800 46px ' + F; c.fillText('Chợ Của Tui', 165, H - 60);
  c.font = '600 36px ' + F; c.textAlign = 'right'; c.fillText('chocuatui.vn', W - 56, H - 60); c.textAlign = 'left';
  return new Promise(r => cv.toBlob(b => r(b), 'image/jpeg', 0.9));
}

function caption(items: CommunityListing[]) {
  const site = window.location.origin;
  const lines = items.map(l => '• ' + (l.communityIntent === 'need' ? '🙋 ' : '🎁 ') + l.title + ' (' + place(l) + ')');
  const openers = ['🌱 Hôm nay hàng xóm có gì cho nhau?', '💚 Vài món đang chờ người cần:', '🏡 Đồ còn tốt, cho nhau dùng tiếp:'];
  return [openers[new Date().getDate() % openers.length], '', ...lines, '',
    'Tất cả đều MIỄN PHÍ, không mua bán. Ai cần thì vào xin, ai có đồ chưa dùng tới thì đăng cho hàng xóm nhé.',
    '', '👉 Xem và xin: ' + site, '', '#ChoCuaTui #ChoTangDoCu #GiupNhau'].join('\n');
}

export default function FbPost() {
  const [all, setAll] = useState<CommunityListing[]>([]);
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState<string>('');
  const [note, setNote] = useState('');
  useEffect(() => {
    loadPage({}).then(p => {
      const withImg = p.items.filter(l => thumbOf(l));
      setAll(p.items); setPick((withImg.length ? withImg : p.items).slice(0, 4).map(l => l.id));
    }).catch(() => setNote('Chưa tải được tin.'));
  }, []);
  const chosen = useMemo(() => pick.map(id => all.find(l => l.id === id)).filter(Boolean) as CommunityListing[], [pick, all]);
  const text = useMemo(() => caption(chosen), [chosen]);
  const toggle = (id: string) => setPick(p => p.includes(id) ? p.filter(x => x !== id) : p.length >= 4 ? p : [...p, id]);
  async function build() {
    if (!chosen.length) return;
    setBusy(true); setNote('');
    const b = await makeCollage(chosen).catch(() => null);
    setBusy(false);
    if (!b) { setNote('Chưa tạo được ảnh, thử lại nhé.'); return; }
    if (img) URL.revokeObjectURL(img);
    setImg(URL.createObjectURL(b));
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text); setNote('Đã chép đoạn chữ. Dán vào bài đăng trên trang Facebook nhé.'); }
    catch (_) { setNote('Máy không cho chép tự động: bôi đen đoạn chữ rồi chép tay.'); }
  }
  return <div className="flex flex-col gap-3">
    <p className="text-sm text-slate-600">Chọn 1–4 tin (nên có ảnh). Máy ghép ảnh và viết sẵn chữ; bạn tải ảnh, chép chữ rồi đăng lên trang. Mỗi ngày 1–3 bài, đừng đăng dồn.</p>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-80 overflow-y-auto">
      {all.slice(0, 24).map(l => { const on = pick.includes(l.id); const t = thumbOf(l);
        return <button key={l.id} onClick={() => toggle(l.id)} aria-pressed={on}
          className={'relative text-left rounded-xl border-2 overflow-hidden bg-white ' + (on ? 'border-emerald-700' : 'border-line')}>
          {t ? <img src={t} alt="" className="h-20 w-full object-cover" /> : <span className="h-20 grid place-items-center bg-emerald-50 text-xs text-slate-500">Không ảnh</span>}
          <span className="block p-1.5 text-xs font-semibold line-clamp-2">{l.title}</span>
          {on && <span className="absolute top-1 right-1 h-6 w-6 rounded-full bg-emerald-700 text-white text-xs font-extrabold grid place-items-center">{pick.indexOf(l.id) + 1}</span>}
        </button>; })}
    </div>
    <div className="flex gap-2 flex-wrap">
      <button onClick={build} disabled={busy || !chosen.length} className="min-h-11 px-5 rounded-xl bg-emerald-700 text-white font-bold disabled:opacity-50">{busy ? 'Đang ghép ảnh…' : 'Tạo ảnh ghép (' + chosen.length + ' món)'}</button>
      <a href={FB_PAGE} target="_blank" rel="noopener noreferrer" className="min-h-11 px-4 rounded-xl border border-line font-bold flex items-center">Mở trang Facebook</a>
    </div>
    {img && <div className="flex flex-col gap-2">
      <img src={img} alt="Ảnh ghép để đăng Facebook" className="w-full max-w-sm rounded-xl border border-line" />
      <a href={img} download={'cho-cua-tui-' + new Date().toISOString().slice(0, 10) + '.jpg'} className="self-start min-h-11 px-5 rounded-xl bg-sun text-[#2E1F00] font-bold flex items-center">Tải ảnh về</a>
    </div>}
    <label className="text-sm font-bold" htmlFor="fb-text">Đoạn chữ (sửa thoải mái trước khi đăng)</label>
    <textarea id="fb-text" readOnly value={text} rows={10} className="w-full rounded-xl border border-line bg-white p-3 text-sm" />
    <button onClick={copy} className="self-start min-h-11 px-5 rounded-xl border border-line font-bold">Chép đoạn chữ</button>
    {chosen.length > 0 && <p className="text-xs text-slate-500">Mẹo: dán link từng tin vào bình luận đầu tiên, ví dụ {window.location.origin + tinPath(chosen[0])}</p>}
    {note && <p className="text-sm font-semibold text-emerald-800">{note}</p>}
  </div>;
}
