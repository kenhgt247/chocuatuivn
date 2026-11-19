/**
 * Vẽ "ảnh thẻ tin" 1080×1350 để gửi kèm khi chia sẻ lên Zalo/Facebook:
 * ảnh món đồ, nhãn Tôi có/Tôi cần, tên tin, khu vực, chữ MIỄN PHÍ và địa chỉ web.
 */
export type CardInfo = { title: string; image?: string; badge: string; place: string; need?: boolean };

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width <= maxW) cur = t;
    else { if (cur) lines.push(cur); cur = w; if (lines.length === maxLines) break; }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  return lines;
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export async function makeShareCard(c: CardInfo): Promise<File | null> {
  try {
    await (document as any).fonts?.load?.('800 60px "Be Vietnam Pro"').catch(() => {});
    const W = 1080, H = 1350;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); if (!ctx) return null;
    const F = '"Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillStyle = '#FBF7EE'; ctx.fillRect(0, 0, W, H);
    // Ảnh
    const src = c.image ? (c.image.startsWith('https://firebasestorage') ? '/api/anh?u=' + encodeURIComponent(c.image) : c.image) : '';
    const img = src ? await loadImg(src) : null;
    const PH = 800;
    if (img) {
      const k = Math.max(W / img.width, PH / img.height); const w = img.width * k, h = img.height * k;
      ctx.save(); rr(ctx, 0, 0, W, PH, 0); ctx.clip(); ctx.drawImage(img, (W - w) / 2, (PH - h) / 2, w, h); ctx.restore();
    } else {
      ctx.fillStyle = c.need ? '#FCEFD2' : '#E3EEE6'; ctx.fillRect(0, 0, W, PH);
      const logo = await loadImg('/icons/icon-512.png'); if (logo) ctx.drawImage(logo, W / 2 - 160, PH / 2 - 160, 320, 320);
    }
    // Nhãn MIỄN PHÍ trên ảnh
    ctx.font = '800 44px ' + F; const fw = ctx.measureText('MIỄN PHÍ').width + 64;
    ctx.fillStyle = '#1F6F43'; rr(ctx, 48, 48, fw, 84, 42); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText('MIỄN PHÍ', 80, 106);
    // Nhãn loại
    ctx.font = '700 36px ' + F; const bw = ctx.measureText(c.badge).width + 48;
    ctx.fillStyle = c.need ? '#FCEFD2' : '#E3EEE6'; rr(ctx, 60, PH + 48, bw, 64, 32); ctx.fill();
    ctx.fillStyle = c.need ? '#7A4B00' : '#123524'; ctx.fillText(c.badge, 84, PH + 92);
    // Tiêu đề
    ctx.fillStyle = '#1D2A22'; ctx.font = '800 64px ' + F;
    wrap(ctx, c.title, W - 120, 2).forEach((l, i) => ctx.fillText(l, 60, PH + 200 + i * 80));
    // Khu vực
    if (c.place) { ctx.fillStyle = '#56645A'; ctx.font = '500 38px ' + F; ctx.fillText('📍 ' + c.place, 60, PH + 380); }
    // Chân thẻ
    ctx.fillStyle = '#1F6F43'; ctx.fillRect(0, H - 130, W, 130);
    const logo = await loadImg('/icons/icon-192.png'); if (logo) { ctx.save(); rr(ctx, 60, H - 105, 80, 80, 20); ctx.clip(); ctx.drawImage(logo, 60, H - 105, 80, 80); ctx.restore(); }
    ctx.fillStyle = '#fff'; ctx.font = '800 44px ' + F; ctx.fillText('Chợ Của Tui', 165, H - 55);
    ctx.font = '600 34px ' + F; ctx.textAlign = 'right'; ctx.fillText('chocuatui.vn', W - 60, H - 55); ctx.textAlign = 'left';
    const blob: Blob | null = await new Promise(r => cv.toBlob(b => r(b), 'image/jpeg', 0.88));
    return blob ? new File([blob], 'cho-cua-tui.jpg', { type: 'image/jpeg' }) : null;
  } catch (_) { return null; }
}
