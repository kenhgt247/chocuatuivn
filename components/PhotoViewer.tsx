/**
 * Xem ảnh toàn màn hình: vuốt ngang để đổi ảnh, chạm hai lần (hoặc bấm nút) để phóng to,
 * phím ← → Esc trên máy tính.
 */
import React, { useEffect, useRef, useState } from 'react';

export default function PhotoViewer({ images, start = 0, onClose, title }: { images: string[]; start?: number; onClose: () => void; title?: string }) {
  const [i, setI] = useState(start);
  const [zoom, setZoom] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);

  useEffect(() => {
    const el = track.current;
    if (el) el.scrollTo({ left: start * el.clientWidth, behavior: 'auto' });
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  function go(n: number) {
    const k = Math.max(0, Math.min(images.length - 1, n));
    setZoom(false); setI(k);
    track.current?.scrollTo({ left: k * (track.current?.clientWidth || 0), behavior: 'smooth' });
  }
  const onScroll = () => {
    const el = track.current; if (!el || zoom) return;
    const k = Math.round(el.scrollLeft / el.clientWidth);
    if (k !== i) setI(k);
  };
  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) setZoom(z => !z);
    lastTap.current = now;
  };

  return <div className="fixed inset-0 z-[80] bg-black/95 flex flex-col" role="dialog" aria-modal="true" aria-label={'Ảnh ' + (i + 1) + '/' + images.length}>
    <div className="flex items-center justify-between px-3 py-2 text-white pt-[max(8px,env(safe-area-inset-top))]">
      <span className="text-sm font-semibold truncate pr-3">{title ? title + ' · ' : ''}{i + 1}/{images.length}</span>
      <div className="flex gap-1">
        <button onClick={() => setZoom(z => !z)} aria-label={zoom ? 'Thu nhỏ' : 'Phóng to'} className="h-11 w-11 grid place-items-center rounded-full hover:bg-white/10">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />{zoom ? <path d="M8 11h6" /> : <path d="M8 11h6M11 8v6" />}</svg>
        </button>
        <button onClick={onClose} aria-label="Đóng" className="h-11 w-11 grid place-items-center rounded-full hover:bg-white/10">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
    <div ref={track} onScroll={onScroll}
      className={'flex-1 flex overflow-y-hidden ' + (zoom ? 'overflow-x-hidden' : 'overflow-x-auto snap-x snap-mandatory')} style={{ scrollbarWidth: 'none' }}>
      {images.map((u, k) => <div key={u + k} className="w-full h-full shrink-0 snap-center relative">
        <div className={'absolute inset-0 ' + (zoom && k === i ? 'overflow-auto' : 'overflow-hidden grid place-items-center')} onClick={tap}>
          <img src={u} alt="" draggable={false}
            className={zoom && k === i ? 'max-w-none w-[220%] md:w-[160%] h-auto' : 'max-h-full max-w-full object-contain select-none'} />
        </div>
      </div>)}
    </div>
    {images.length > 1 && <>
      <button onClick={() => go(i - 1)} disabled={i === 0} aria-label="Ảnh trước" className="hidden md:grid absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/15 text-white place-items-center disabled:opacity-30">‹</button>
      <button onClick={() => go(i + 1)} disabled={i === images.length - 1} aria-label="Ảnh sau" className="hidden md:grid absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/15 text-white place-items-center disabled:opacity-30">›</button>
      <div className="flex justify-center gap-2 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {images.map((u, k) => <button key={k} onClick={() => go(k)} aria-label={'Ảnh ' + (k + 1)}
          className={'h-14 w-14 rounded-lg overflow-hidden border-2 ' + (k === i ? 'border-white' : 'border-transparent opacity-60')}><img src={u} alt="" className="h-full w-full object-cover" /></button>)}
      </div>
    </>}
    <p className="text-center text-xs text-white/60 pb-2 md:hidden">Vuốt để xem ảnh khác · chạm hai lần để phóng to</p>
  </div>;
}
