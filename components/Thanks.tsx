/** Lời cảm ơn: hiển thị và gửi. */
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { community, receiverOf, type CommunityRequest, type ThankNote } from '../services/community';
import { formatTimeAgo } from '../utils/format';
import type { User } from '../types';

function when(x: any) {
  try { const d = x?.toDate ? x.toDate() : x ? new Date(x) : null; return d ? formatTimeAgo(d.toISOString()) : ''; } catch (_) { return ''; }
}

export function ThanksList({ items, title, more }: { items: ThankNote[]; title?: string; more?: string }) {
  if (!items.length) return null;
  return <section className="flex flex-col gap-2">
    {title && <h2 className="font-extrabold">{title}</h2>}
    {items.map(t => <article key={t.id} className="bg-white border border-line rounded-2xl p-3.5 flex gap-3">
      {t.receiverAvatar ? <img src={t.receiverAvatar} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
        : <span className="h-10 w-10 rounded-full bg-sun-light text-sun-dark font-extrabold grid place-items-center shrink-0">{(t.receiverName || '?').charAt(0).toUpperCase()}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-snug">“{t.message}”</p>
        <p className="text-xs text-slate-600 mt-1">{t.receiverName} · {t.listingTitle} {when(t.createdAt) ? '· ' + when(t.createdAt) : ''}</p>
        {t.photo && <img src={t.photo} alt="" loading="lazy" className="mt-2 h-28 w-28 rounded-xl object-cover" />}
      </div>
    </article>)}
    {more && <Link to={more} className="self-start text-sm font-semibold text-emerald-700 underline min-h-9">Xem tất cả lời cảm ơn</Link>}
  </section>;
}

/** Nút + hộp viết lời cảm ơn (chỉ hiện cho người nhận khi yêu cầu đã hoàn thành). */
export function ThankButton({ r, user, onSent }: { r: CommunityRequest; user: User; onSent?: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<boolean | null>(null);
  const [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (r.status === 'completed' && receiverOf(r) === user.id) community.thankFor(r.id).then(t => setSent(!!t)); }, [r.id, r.status]);
  if (r.status !== 'completed' || receiverOf(r) !== user.id || sent === null) return null;
  if (sent) return <p className="text-sm text-emerald-800 font-semibold">💚 Bạn đã gửi lời cảm ơn.</p>;
  async function send() {
    setBusy(true); setErr('');
    try { await community.sendThanks(r, user, text, photo); setSent(true); setOpen(false); onSent?.(); }
    catch (e: any) { setErr(e?.message || 'Chưa gửi được, thử lại nhé.'); }
    finally { setBusy(false); }
  }
  if (!open) return <button onClick={() => setOpen(true)} className="w-full min-h-12 rounded-[14px] bg-sun text-[#2E1F00] font-extrabold">💛 Gửi lời cảm ơn</button>;
  const quick = ['Cảm ơn bạn nhiều nhé!', 'Món đồ rất hữu ích, cảm ơn bạn!', 'Bạn thật tốt bụng!'];
  return <div className="rounded-2xl border border-line bg-cream p-3 flex flex-col gap-2">
    <p className="text-sm font-bold">Lời cảm ơn sẽ hiện trên hồ sơ của người giúp bạn.</p>
    <div className="flex flex-wrap gap-1.5">{quick.map(q => <button key={q} onClick={() => setText(q)} className="min-h-9 px-3 rounded-full bg-white border border-line text-[13px] font-semibold">{q}</button>)}</div>
    <textarea value={text} onChange={e => setText(e.target.value)} maxLength={300} rows={3} placeholder="Viết vài lời cảm ơn…" className="w-full rounded-xl border border-line bg-white p-3 text-base" />
    <input ref={file} type="file" accept="image/*" className="hidden" onChange={e => setPhoto(e.target.files?.[0] || null)} />
    <button onClick={() => file.current?.click()} className="self-start text-sm font-semibold text-emerald-700 underline min-h-9">{photo ? '✓ Đã chọn ảnh: ' + photo.name.slice(0, 24) : '+ Thêm ảnh món đồ (không bắt buộc)'}</button>
    {err && <p role="alert" className="text-sm text-rose-700">{err}</p>}
    <div className="flex gap-2">
      <button disabled={busy || text.trim().length < 2} onClick={send} className="flex-1 min-h-11 rounded-xl bg-emerald-700 text-white font-bold disabled:opacity-50">{busy ? 'Đang gửi…' : 'Gửi lời cảm ơn'}</button>
      <button onClick={() => setOpen(false)} className="min-h-11 px-4 rounded-xl border border-line bg-white font-semibold">Để sau</button>
    </div>
  </div>;
}

/** Gọi ngay sau khi người nhận bấm xác nhận xong: mở hộp gửi lời cảm ơn. */
export function askThanks(r: CommunityRequest) { window.dispatchEvent(new CustomEvent('ccut-cam-on', { detail: r })); }

/** Hộp "Gửi lời cảm ơn" bật lên toàn màn hình (gắn một lần trong khung trang). */
export function ThanksPrompt({ user }: { user: User | null }) {
  const [r, setR] = useState<CommunityRequest | null>(null);
  const [giver, setGiver] = useState('');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const on = async (e: Event) => {
      const x = (e as CustomEvent).detail as CommunityRequest;
      if (!user || !x || x.status !== 'completed' || receiverOf(x) !== user.id) return;
      if (await community.thankFor(x.id).catch(() => null)) return; // đã cảm ơn rồi
      setText(''); setPhoto(null); setDone(false); setErr(''); setGiver(''); setR(x);
      const { db } = await import('../services/db');
      const gid = x.intent === 'need' ? x.requesterId : x.ownerId;
      db.getPublicProfile(gid).then(p => setGiver(p?.name || '')).catch(() => {});
    };
    window.addEventListener('ccut-cam-on', on);
    return () => window.removeEventListener('ccut-cam-on', on);
  }, [user?.id]);
  if (!r || !user) return null;
  const close = () => setR(null);
  async function send() {
    if (!r || !user) return;
    setBusy(true); setErr('');
    try { await community.sendThanks(r, user, text, photo); setDone(true); }
    catch (e: any) { setErr(e?.message || 'Chưa gửi được, thử lại nhé.'); }
    finally { setBusy(false); }
  }
  const quick = r.kind === 'help' ? ['Cảm ơn bạn đã giúp mình!', 'Bạn thật tốt bụng!', 'Nhờ bạn mà xong việc rồi 💚']
    : r.kind === 'repair' ? ['Cảm ơn bạn đã sửa giúp!', 'Chạy tốt như mới rồi ạ!', 'Bạn khéo tay quá!']
    : r.kind === 'borrow' ? ['Cảm ơn bạn đã cho mượn!', 'Đồ dùng rất tiện, cảm ơn bạn!', 'Lần sau mình giúp lại nhé!']
    : ['Cảm ơn bạn nhiều nhé!', 'Món đồ rất hữu ích, cảm ơn bạn!', 'Bạn thật tốt bụng!'];
  return createPortal(<div className="fixed inset-0 z-[70] bg-ink/50 flex items-end md:items-center justify-center" onClick={close}>
    <div role="dialog" aria-modal="true" aria-label="Gửi lời cảm ơn" onClick={e => e.stopPropagation()}
      className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl p-5 pb-[calc(20px+env(safe-area-inset-bottom))] flex flex-col gap-3 max-h-[92vh] overflow-y-auto">
      {done ? <>
        <div className="text-5xl text-center">💚</div>
        <h2 className="text-xl font-extrabold text-center">Đã gửi lời cảm ơn!</h2>
        <p className="text-center text-slate-600">Lời cảm ơn sẽ hiện trên hồ sơ {giver ? 'của ' + giver : 'người giúp bạn'} và ở trang chủ sau ít phút.</p>
        <button onClick={close} className="min-h-12 rounded-2xl bg-emerald-700 text-white font-extrabold">Xong</button>
      </> : <>
        <div className="text-4xl text-center">🎉</div>
        <h2 className="text-xl font-extrabold text-center leading-snug">Hoàn thành rồi!<br />Gửi lời cảm ơn {giver ? 'tới ' + giver : ''} nhé?</h2>
        <p className="text-sm text-slate-600 text-center">“{r.listingTitle}” · Lời cảm ơn sẽ hiện trên trang chủ để mọi người cùng thấy.</p>
        <div className="flex flex-wrap gap-1.5 justify-center">{quick.map(q => <button key={q} onClick={() => setText(q)} aria-pressed={text === q}
          className={'min-h-9 px-3 rounded-full border text-[13px] font-semibold ' + (text === q ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'bg-white border-line')}>{q}</button>)}</div>
        <textarea value={text} onChange={e => setText(e.target.value)} maxLength={300} rows={3} placeholder="Hoặc tự viết vài lời…" className="w-full rounded-xl border border-line bg-white p-3 text-base" aria-label="Lời cảm ơn" />
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={e => setPhoto(e.target.files?.[0] || null)} />
        <button onClick={() => file.current?.click()} className="self-start text-sm font-semibold text-emerald-700 underline min-h-9">{photo ? '✓ Đã chọn ảnh: ' + photo.name.slice(0, 24) : '+ Thêm ảnh món đồ (không bắt buộc)'}</button>
        {err && <p role="alert" className="text-sm text-rose-700">{err}</p>}
        <button disabled={busy || text.trim().length < 2} onClick={send} className="min-h-[52px] rounded-2xl bg-emerald-700 text-white text-base font-extrabold disabled:opacity-50">{busy ? 'Đang gửi…' : '💚 Gửi lời cảm ơn'}</button>
        <button onClick={close} className="min-h-11 rounded-xl text-slate-600 font-semibold">Để sau</button>
      </>}
    </div>
  </div>, document.body);
}
