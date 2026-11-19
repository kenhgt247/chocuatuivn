/**
 * Ô chọn xã/phường: gõ vài chữ → gợi ý từ danh sách chính thức (sau sáp nhập 2025),
 * hoặc bấm "Dùng vị trí hiện tại" để tìm xã/phường của mình (vị trí chỉ dùng trên máy, không lưu).
 */
import React, { useEffect, useRef, useState } from 'react';
import { searchWards, wardAt, type Ward } from '../utils/dvhc';

export function AreaInput({ value, onPick, onType, placeholder = 'Gõ tên xã/phường, ví dụ: Chí Linh', autoFocus, id }: {
  value: string; onPick: (w: Ward) => void; onType?: (text: string) => void; placeholder?: string; autoFocus?: boolean; id?: string;
}) {
  const [text, setText] = useState(value);
  const [items, setItems] = useState<Ward[]>([]);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState('');
  const [active, setActive] = useState(0);
  const seq = useRef(0);
  useEffect(() => { setText(value); }, [value]);
  useEffect(() => {
    const n = ++seq.current;
    if (text.trim().length < 2) { setItems([]); return; }
    const t = setTimeout(() => searchWards(text).then(r => { if (n === seq.current) { setItems(r); setActive(0); } }).catch(() => setErr('Chưa tải được danh sách xã/phường.')), 120);
    return () => clearTimeout(t);
  }, [text]);
  function pick(w: Ward) { setText(w.label); setOpen(false); setErr(''); onPick(w); }
  function useMyLocation() {
    if (!navigator.geolocation) { setErr('Thiết bị chưa hỗ trợ định vị.'); return; }
    setLocating(true); setErr('');
    navigator.geolocation.getCurrentPosition(async pos => {
      try { const w = await wardAt(pos.coords.latitude, pos.coords.longitude); if (w) pick(w); else setErr('Chưa tìm được xã/phường.'); }
      finally { setLocating(false); }
    }, () => { setLocating(false); setErr('Chưa lấy được vị trí. Bạn gõ tên xã/phường nhé.'); }, { timeout: 10000, enableHighAccuracy: false, maximumAge: 600000 });
  }
  const listId = (id || 'area') + '-list';
  return <div className="relative">
    <input id={id} autoFocus={autoFocus} value={text} placeholder={placeholder} autoComplete="off"
      role="combobox" aria-expanded={open && items.length > 0} aria-controls={listId} aria-autocomplete="list"
      onChange={e => { setText(e.target.value); setOpen(true); onType?.(e.target.value); }}
      onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
      onKeyDown={e => {
        if (!items.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, items.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
        if (e.key === 'Enter' && open) { e.preventDefault(); pick(items[active]); }
      }}
      className="w-full min-h-12 rounded-[14px] border border-[#C9C1AE] bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-600" />
    {open && items.length > 0 && <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-line rounded-2xl shadow-xl py-1 max-h-72 overflow-y-auto">
      {items.map((w, i) => <li key={w.code} role="option" aria-selected={i === active}>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick(w)}
          className={'w-full text-left px-4 py-2.5 ' + (i === active ? 'bg-emerald-50' : 'hover:bg-cream')}>
          <span className="block text-[15px] font-semibold">{w.name}</span>
          <span className="block text-xs text-slate-600">{w.provinceName}</span>
        </button>
      </li>)}
    </ul>}
    <button type="button" onClick={useMyLocation} disabled={locating} className="mt-2 text-[13px] font-semibold text-emerald-700 underline min-h-8">
      {locating ? 'Đang tìm xã/phường của bạn…' : 'Dùng vị trí hiện tại để chọn'}</button>
    {err && <p className="text-xs text-rose-700">{err}</p>}
  </div>;
}
export default AreaInput;
