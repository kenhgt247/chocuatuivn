/**
 * Tin nhắn dạng khung nổi ở góc màn hình máy tính (giống Facebook):
 * vừa xem tin vừa nhắn. Bên trong là trang Tin nhắn chạy ở chế độ nhúng.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ChatDock({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return <div className="hidden lg:block fixed right-6 bottom-6 z-[70]">
    {loaded && <div className={'absolute right-0 bottom-16 w-[380px] h-[560px] max-h-[calc(100vh-120px)] bg-white rounded-2xl shadow-2xl border border-line overflow-hidden flex flex-col ' + (open ? '' : 'hidden')}>
      <div className="flex items-center justify-between px-4 h-12 border-b border-line bg-cream shrink-0">
        <span className="font-extrabold">Tin nhắn</span>
        <span className="flex items-center gap-1">
          <Link to="/chat" onClick={() => setOpen(false)} className="text-sm font-semibold text-emerald-700 px-2 min-h-9 inline-flex items-center">Mở toàn trang</Link>
          <button onClick={() => setOpen(false)} aria-label="Thu nhỏ" className="h-9 w-9 grid place-items-center rounded-full hover:bg-white">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /></svg>
          </button>
        </span>
      </div>
      <iframe src="/chat?nhung=1" title="Tin nhắn" className="flex-1 w-full border-0" />
    </div>}
    <button onClick={() => { setLoaded(true); setOpen(v => !v); }} aria-expanded={open} aria-label="Tin nhắn"
      className="relative h-14 pl-4 pr-5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white shadow-xl flex items-center gap-2 font-extrabold">
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
      Tin nhắn
      {unread > 0 && <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1.5 rounded-full bg-rose-600 text-white text-xs font-bold grid place-items-center border-2 border-white">{unread > 99 ? '99+' : unread}</span>}
    </button>
  </div>;
}
