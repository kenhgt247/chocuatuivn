/**
 * Bảng chia sẻ tin: ưu tiên bảng chia sẻ của điện thoại (chọn Zalo, Messenger...),
 * kèm Facebook, chép link và chép lời giới thiệu để dán vào nhóm Zalo khu phố.
 * Ảnh xem trước khi dán link do /api/og trả cho Zalo/Facebook.
 */
import React, { useState } from 'react';
import { makeShareCard, type CardInfo } from '../utils/shareCard';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
  text?: string;   // lời giới thiệu ngắn
  image?: string;  // ảnh minh hoạ trong bảng
  card?: CardInfo; // có thì cho gửi kèm "ảnh thẻ tin"
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, url, title, text, image, card }) => {
  const [notice, setNotice] = useState('');
  const [making, setMaking] = useState(false);
  if (!isOpen) return null;
  const fullUrl = url.startsWith('http') ? url : window.location.origin + url;
  const message = (text || title) + '\n' + fullUrl;
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  async function copy(value: string, done: string) {
    try { await navigator.clipboard.writeText(value); setNotice(done); }
    catch (_) { window.prompt('Chép nội dung dưới đây:', value); }
  }
  async function nativeShare() {
    try { await navigator.share({ title, text: text || title, url: fullUrl }); onClose(); }
    catch (_) { /* người dùng đóng bảng chia sẻ */ }
  }
  async function shareCard() {
    if (!card) return;
    setMaking(true); setNotice('');
    const file = await makeShareCard(card);
    setMaking(false);
    if (!file) { setNotice('Chưa tạo được ảnh, bạn dùng cách chia sẻ link nhé.'); return; }
    const nav: any = navigator;
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try { await nav.share({ files: [file], title, text: (text || title) + '\n' + fullUrl }); onClose(); return; } catch (_) { return; }
    }
    // Máy tính / trình duyệt không gửi được tệp: tải ảnh về để tự đăng
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = 'cho-cua-tui.jpg'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    await copy(message, 'Đã tải ảnh thẻ tin về máy và chép lời giới thiệu. Đăng ảnh kèm lời giới thiệu lên nhóm nhé!');
  }
  const row = 'w-full flex items-center gap-3 min-h-14 px-4 rounded-2xl border border-line bg-white text-left text-[15px] font-bold hover:bg-cream';

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Chia sẻ tin">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-cream rounded-t-3xl sm:rounded-3xl p-5 pb-8 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold">Chia sẻ tin</h3>
          <button onClick={onClose} aria-label="Đóng" className="h-10 w-10 grid place-items-center rounded-full hover:bg-white">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex gap-3 items-center bg-white border border-line rounded-2xl p-3">
          {image ? <img src={image} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <img src="/icons/icon-192.png" alt="" className="h-14 w-14 rounded-xl" />}
          <span className="text-sm font-semibold line-clamp-2">{title}</span>
        </div>
        {canNativeShare && <button onClick={nativeShare} className={row + ' !bg-emerald-700 !text-white !border-emerald-700'}>
          <span className="h-9 w-9 rounded-full bg-white/20 grid place-items-center font-extrabold">Z</span>Gửi qua Zalo, Messenger…</button>}
        {card && <button onClick={shareCard} disabled={making} className={row + ' disabled:opacity-60'}>
          <span className="h-9 w-9 rounded-full bg-sun text-[#2E1F00] grid place-items-center"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg></span>
          {making ? 'Đang tạo ảnh…' : 'Gửi ảnh thẻ tin (đẹp hơn trên Zalo)'}</button>}
        <a href={'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(fullUrl)} target="_blank" rel="noopener noreferrer" className={row}>
          <span className="h-9 w-9 rounded-full bg-[#1877F2] text-white grid place-items-center font-extrabold">f</span>Chia sẻ lên Facebook</a>
        <button onClick={() => copy(message, 'Đã chép lời giới thiệu và link. Dán vào nhóm Zalo khu phố nhé!')} className={row}>
          <span className="h-9 w-9 rounded-full bg-sun-light text-sun-dark grid place-items-center font-extrabold">“</span>Chép lời giới thiệu để dán vào nhóm</button>
        <button onClick={() => copy(fullUrl, 'Đã chép link.')} className={row}>
          <span className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center font-extrabold">⧉</span>Chép link</button>
        {notice && <p role="status" className="text-sm text-emerald-800 bg-emerald-50 rounded-xl p-3">{notice}</p>}
      </div>
    </div>
  );
};

export default ShareModal;
