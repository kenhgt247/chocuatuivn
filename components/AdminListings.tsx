/**
 * Quản trị: xem mọi tin cộng đồng (mới nhất trước), ẩn / hiện lại / xoá tin.
 * Chỉ dùng chỉ mục một trường (createdAt) nên chạy được ngay, không cần tạo chỉ mục mới.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection, deleteDoc, doc, getDocs, limit, orderBy, query, startAfter, updateDoc,
  type QueryDocumentSnapshot
} from 'firebase/firestore';
import { db, firestore } from '../services/db';
import type { CommunityListing } from '../services/community';
import { formatTimeAgo, thumbOf, tinPath } from '../utils/format';

type Filter = 'approved' | 'pending' | 'hidden' | 'rejected' | 'all';
const FILTERS: [Filter, string][] = [['approved', 'Đang hiện'], ['pending', 'Chờ duyệt'], ['hidden', 'Đã ẩn'], ['rejected', 'Bị từ chối'], ['all', 'Tất cả']];
const STATUS_TEXT: Record<string, [string, string]> = {
  approved: ['Đang hiện', 'bg-emerald-50 text-emerald-800'],
  pending: ['Chờ duyệt', 'bg-sun-light text-sun-dark'],
  hidden: ['Đã ẩn', 'bg-slate-100 text-slate-700'],
  rejected: ['Bị từ chối', 'bg-rose-50 text-rose-800'],
  sold: ['Đã xong', 'bg-slate-100 text-slate-700'],
  expired: ['Hết hạn', 'bg-slate-100 text-slate-700'],
};
export const HIDE_REASONS = ['Có dấu hiệu mua bán, đòi tiền', 'Nội dung không phù hợp', 'Ảnh không phù hợp', 'Lừa đảo hoặc nghi lừa đảo', 'Tin trùng lặp', 'Việc nguy hiểm'];
const PAGE = 100;
const timeOf = (v: any): string => { try { return v ? formatTimeAgo(v?.toDate ? v.toDate().toISOString() : String(v)) : ''; } catch (_) { return ''; } };

/** Ẩn tin (kèm lý do gửi cho người đăng). Dùng chung cho trang quản trị và trang tin. */
export async function adminHide(l: Pick<CommunityListing, 'id' | 'title' | 'sellerId'>, reason: string) {
  await updateDoc(doc(firestore, 'listings', l.id), { status: 'hidden', adminNote: reason.slice(0, 200), hiddenByAdmin: true });
  await db.sendNotification({ userId: l.sellerId, title: 'Tin đã bị ẩn', message: '"' + l.title + '": ' + reason + '. Nếu nhầm, bạn nhắn quản trị nhé.', type: 'error', link: '/profile' }).catch(() => {});
}
export async function adminShow(id: string) {
  await updateDoc(doc(firestore, 'listings', id), { status: 'approved', hiddenByAdmin: false });
}
export async function adminDelete(l: Pick<CommunityListing, 'id' | 'title' | 'sellerId'>, reason: string) {
  await deleteDoc(doc(firestore, 'listings', l.id));
  await db.sendNotification({ userId: l.sellerId, title: 'Tin đã bị xoá', message: '"' + l.title + '"' + (reason ? ': ' + reason : '') + '.', type: 'error', link: '/profile' }).catch(() => {});
}

/** Ô chọn lý do + nút xác nhận, dùng chung. */
export function ReasonPicker({ label, danger, busy, onPick, onCancel }: { label: string; danger?: boolean; busy?: boolean; onPick: (r: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return <div className="flex flex-col gap-2 rounded-xl bg-[#F7F3EA] p-3">
    <span className="text-sm font-bold">Lý do (người đăng sẽ thấy):</span>
    <div className="flex gap-2 flex-wrap">{HIDE_REASONS.map(r => <button key={r} type="button" onClick={() => setReason(r)} aria-pressed={reason === r}
      className={'min-h-9 px-3 rounded-full border text-[13px] font-semibold ' + (reason === r ? 'border-rose-400 bg-rose-50 text-rose-800' : 'border-line bg-white')}>{r}</button>)}</div>
    <input value={reason} onChange={e => setReason(e.target.value)} maxLength={200} placeholder="Hoặc tự ghi lý do…" className="min-h-11 rounded-xl border border-line px-3 bg-white" />
    <div className="flex gap-2">
      <button type="button" disabled={busy || !reason} onClick={() => onPick(reason)} className={'flex-1 min-h-11 rounded-xl text-white font-bold disabled:opacity-50 ' + (danger ? 'bg-rose-700' : 'bg-rose-600')}>{busy ? 'Đang xử lý…' : label}</button>
      <button type="button" onClick={onCancel} className="min-h-11 px-4 rounded-xl border border-line bg-white">Huỷ</button>
    </div>
  </div>;
}

export default function AdminListings() {
  const [items, setItems] = useState<CommunityListing[]>([]);
  const [last, setLast] = useState<QueryDocumentSnapshot | null>(null);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('approved');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  async function load(after: QueryDocumentSnapshot | null) {
    setLoading(true); setErr('');
    try {
      const base = collection(firestore, 'listings');
      const snap = await getDocs(after ? query(base, orderBy('createdAt', 'desc'), startAfter(after), limit(PAGE)) : query(base, orderBy('createdAt', 'desc'), limit(PAGE)));
      const got = snap.docs.map(d => ({ ...d.data(), id: d.id } as CommunityListing)).filter(x => x.isCommunityFree === true);
      setItems(p => after ? [...p, ...got] : got);
      setLast(snap.docs[snap.docs.length - 1] || null);
      setMore(snap.docs.length === PAGE);
    } catch (e: any) { setErr('Chưa tải được tin: ' + (e?.code || e?.message || '')); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(null); }, []);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return items.filter(x => (filter === 'all' || x.status === filter)
      && (!k || [x.title, x.description, x.sellerName, x.location].some(v => String(v || '').toLowerCase().includes(k))));
  }, [items, filter, q]);
  const count = (f: Filter) => f === 'all' ? items.length : items.filter(x => x.status === f).length;
  const patch = (id: string, v: Partial<CommunityListing> | null) => setItems(p => v ? p.map(x => x.id === id ? { ...x, ...v } : x) : p.filter(x => x.id !== id));

  return <div className="flex flex-col gap-3">
    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tiêu đề, người đăng, khu vực…" className="min-h-11 rounded-xl border border-line px-3 bg-white" />
    <div className="flex gap-2 overflow-x-auto">{FILTERS.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
      className={'shrink-0 min-h-9 px-3 rounded-full border text-[13px] font-bold ' + (filter === k ? 'bg-ink text-white border-ink' : 'bg-white border-line')}>{l} · {count(k)}</button>)}</div>
    {err && <p className="rounded-xl bg-rose-50 text-rose-800 p-3 text-sm">{err}</p>}
    {!loading && !shown.length && <p className="bg-white border border-line rounded-2xl p-6 text-slate-600">Không có tin nào ở mục này.</p>}
    {shown.map(l => <Row key={l.id} l={l} onChange={v => patch(l.id, v)} />)}
    {loading ? <p className="text-slate-600">Đang tải…</p>
      : more && <button onClick={() => load(last)} className="self-center min-h-11 px-5 rounded-xl border border-line bg-white font-bold">Tải thêm tin cũ hơn</button>}
    <p className="text-xs text-slate-500">Tin vừa ẩn hoặc xoá có thể còn hiện ở trang chủ thêm 2–3 phút do bộ nhớ đệm.</p>
  </div>;
}

function Row({ l, onChange }: { l: CommunityListing; onChange: (v: Partial<CommunityListing> | null) => void; key?: React.Key }) {
  const [mode, setMode] = useState<'' | 'hide' | 'delete'>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const st = STATUS_TEXT[l.status as string] || [String(l.status || '—'), 'bg-slate-100 text-slate-700'];
  const img = thumbOf(l);
  async function run(fn: () => Promise<void>, v: Partial<CommunityListing> | null) {
    setBusy(true); setErr('');
    try { await fn(); onChange(v); setMode(''); }
    catch (e: any) { setErr('Chưa làm được: ' + (e?.code || e?.message || '')); }
    finally { setBusy(false); }
  }
  return <article className="bg-white border border-line rounded-2xl p-3 flex flex-col gap-2">
    <div className="flex gap-3">
      <Link to={tinPath(l)} className="shrink-0">{img ? <img src={img} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <span className="h-16 w-16 rounded-xl bg-emerald-50 block" />}</Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2"><span className={'text-[11px] font-bold px-2 py-0.5 rounded-full ' + st[1]}>{st[0]}</span>
          <span className="text-xs text-slate-500 truncate">{timeOf(l.createdAt)}</span></div>
        <Link to={tinPath(l)} className="font-bold leading-snug line-clamp-2 mt-0.5 block">{l.title}</Link>
        <div className="text-xs text-slate-600 truncate">{l.sellerName || 'Thành viên'} · {String(l.location || '').split(',')[0]}</div>
        {(l as any).adminNote && l.status === 'hidden' && <div className="text-xs text-rose-700 mt-0.5">Lý do ẩn: {(l as any).adminNote}</div>}
      </div>
    </div>
    {mode === '' && <div className="flex gap-2 flex-wrap">
      {l.status === 'hidden' || l.status === 'rejected' || l.status === 'pending'
        ? <button disabled={busy} onClick={() => run(() => adminShow(l.id), { status: 'approved' } as any)} className="min-h-10 px-4 rounded-xl bg-emerald-700 text-white text-sm font-bold">Cho hiện</button>
        : <button disabled={busy} onClick={() => setMode('hide')} className="min-h-10 px-4 rounded-xl bg-rose-600 text-white text-sm font-bold">Ẩn tin</button>}
      {l.status !== 'hidden' && l.status !== 'approved' && <button disabled={busy} onClick={() => setMode('hide')} className="min-h-10 px-4 rounded-xl border border-rose-300 text-rose-700 text-sm font-bold">Ẩn tin</button>}
      <button disabled={busy} onClick={() => setMode('delete')} className="min-h-10 px-4 rounded-xl border border-line text-rose-700 text-sm font-bold">Xoá hẳn</button>
      <Link to={tinPath(l)} className="min-h-10 px-3 rounded-xl text-sm font-semibold underline flex items-center">Xem</Link>
    </div>}
    {mode === 'hide' && <ReasonPicker label="Ẩn tin này" busy={busy} onCancel={() => setMode('')}
      onPick={r => run(() => adminHide(l, r), { status: 'hidden', adminNote: r } as any)} />}
    {mode === 'delete' && <ReasonPicker label="Xoá hẳn (không khôi phục được)" danger busy={busy} onCancel={() => setMode('')}
      onPick={r => run(() => adminDelete(l, r), null)} />}
    {err && <p className="text-sm text-rose-700">{err}</p>}
  </article>;
}
