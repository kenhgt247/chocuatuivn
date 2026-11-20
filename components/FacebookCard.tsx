/** Trang Facebook của Chợ Của Tui: thẻ (trang chủ) và nút nhỏ (chân trang). */
import React, { useState } from 'react';
import ShareModal from './ShareModal';

export const FB_PAGE = 'https://www.facebook.com/vn.chocuatui';
const F = ({ className = 'h-9 w-9 text-base' }: { className?: string }) =>
  <span className={'rounded-full bg-[#1877F2] text-white grid place-items-center font-extrabold shrink-0 ' + className} aria-hidden="true">f</span>;

export function FacebookPill({ small }: { small?: boolean }) {
  return <a href={FB_PAGE} target="_blank" rel="noopener noreferrer" aria-label="Trang Facebook Chợ Của Tui"
    className={'inline-flex items-center gap-2 rounded-full bg-[#1877F2] text-white font-bold hover:brightness-110 ' + (small ? 'h-9 pl-1 pr-3.5 text-[13px]' : 'h-10 pl-1 pr-4 text-sm')}>
    <F className="h-7 w-7 text-sm !bg-white/20" />Facebook</a>;
}

export function FacebookCard() {
  const [inviting, setInviting] = useState(false);
  return <section className="bg-white border border-line rounded-2xl p-4 flex flex-col gap-2.5">
    <div className="flex items-center gap-3">
      <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-[14px]" />
      <div className="flex flex-col min-w-0"><span className="font-extrabold text-[15px]">Chợ Của Tui trên Facebook</span><span className="text-xs text-slate-600 truncate">facebook.com/vn.chocuatui</span></div>
    </div>
    <p className="text-[13px] text-[#3B4A40]">Mỗi ngày vài món hay được cho, câu chuyện cảm ơn và mẹo cho đồ an toàn.</p>
    <div className="flex gap-2 flex-wrap">
      <a href={FB_PAGE} target="_blank" rel="noopener noreferrer" className="h-10 pl-1 pr-4 rounded-full bg-[#1877F2] text-white text-sm font-bold inline-flex items-center gap-2 hover:brightness-110"><F className="h-8 w-8 text-sm !bg-white/20" />Theo dõi trang</a>
      <button onClick={() => setInviting(true)} className="h-10 px-4 rounded-full border border-line text-sm font-bold">Mời bạn bè</button>
    </div>
    <ShareModal isOpen={inviting} onClose={() => setInviting(false)} url={window.location.origin + '/'} title="Chợ Của Tui"
      text="Cộng đồng cho tặng, cho mượn, giúp nhau miễn phí gần nhà. Vào xem và cùng chia sẻ nhé:" />
  </section>;
}
