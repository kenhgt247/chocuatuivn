/** Kéo xuống ở đầu trang để tải lại (điện thoại). */
import React, { useEffect, useRef, useState } from 'react';

export default function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void> | void; children: React.ReactNode }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);
  const LIMIT = 72;
  useEffect(() => {
    const down = (e: TouchEvent) => { start.current = window.scrollY <= 0 && !busy ? e.touches[0].clientY : null; };
    const move = (e: TouchEvent) => {
      if (start.current == null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) { pullRef.current = 0; setPull(0); return; }
      pullRef.current = Math.min(110, dy * 0.5); setPull(pullRef.current);
    };
    const up = async () => {
      if (start.current == null) return;
      start.current = null;
      if (pullRef.current >= LIMIT) {
        setBusy(true); setPull(LIMIT);
        try { await onRefresh(); } finally { setBusy(false); setPull(0); pullRef.current = 0; }
      } else { setPull(0); pullRef.current = 0; }
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    return () => { window.removeEventListener('touchstart', down); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); };
  }, [busy, onRefresh]);
  return <div>
    <div aria-hidden={!pull} className="flex justify-center overflow-hidden transition-[height] duration-150" style={{ height: pull }}>
      <span className="self-end mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <span className={'h-5 w-5 rounded-full border-2 border-emerald-700 border-t-transparent ' + (busy ? 'animate-spin' : '')} style={busy ? undefined : { transform: 'rotate(' + pull * 4 + 'deg)' }} />
        {busy ? 'Đang tải lại…' : pull >= LIMIT ? 'Thả tay để tải lại' : 'Kéo xuống để tải lại'}
      </span>
    </div>
    {children}
  </div>;
}
