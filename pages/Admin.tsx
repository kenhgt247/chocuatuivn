/**
 * Quản trị — Chợ Của Tui (cộng đồng). Gọn cho một người duyệt:
 * Duyệt tin (xem ảnh, nhắc an toàn, Duyệt / Từ chối có lý do), Báo cáo, Thành viên, Công cụ.
 * Trang quản trị rao vặt cũ được lưu ở nhánh luu-tru-rao-vat-2026-11.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection, doc, getDocs, getCountFromServer, limit, orderBy, query, updateDoc, where
} from 'firebase/firestore';
import { db, firestore } from '../services/db';
import { safetyNotes, type CommunityListing } from '../services/community';
import { KIcon, KIND_META, IntentBadge, SafetyBox } from '../components/CommunityUI';
import { formatTimeAgo, tinPath } from '../utils/format';
const AdminStats = React.lazy(() => import('../components/AdminStats'));
const AdminListings = React.lazy(() => import('../components/AdminListings'));
import type { Report, User } from '../types';

type Tab = 'duyet' | 'tatca' | 'baocao' | 'solieu' | 'thanhvien' | 'congcu';
const REJECT_REASONS = ['Có dấu hiệu mua bán, đòi tiền', 'Nội dung không rõ ràng', 'Ảnh không phù hợp', 'Việc nguy hiểm, không nhận qua ứng dụng', 'Tin trùng lặp'];
const card = 'bg-white border border-line rounded-2xl';

const Admin: React.FC<{ user: User }> = ({ user }) => {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('duyet');
  const [pending, setPending] = useState<CommunityListing[]>([]);
  const [reports, setReports] = useState<(Report & { status: string })[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [syncText, setSyncText] = useState('');
  const [areaText, setAreaText] = useState('');

  useEffect(() => { if (user.role !== 'admin') nav('/'); }, [user.role]);

  async function loadPending() {
    const snap = await getDocs(query(collection(firestore, 'listings'), where('isCommunityFree', '==', true), where('status', '==', 'pending'), limit(100)));
    setPending(snap.docs.map(d => ({ ...d.data(), id: d.id } as CommunityListing)).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))));
  }
  async function loadReports() {
    const all = (await db.getAllReports()) as any[];
    setReports(all.filter(r => r.status === 'pending').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
  }
  async function loadUsers() {
    const snap = await getDocs(query(collection(firestore, 'users'), orderBy('joinedAt', 'desc'), limit(50)));
    setUsers(snap.docs.map(d => ({ ...d.data(), id: d.id } as User)));
  }
  async function loadStats() {
    const c = async (q: any) => { try { return (await getCountFromServer(q)).data().count; } catch (_) { return -1; } };
    const L = collection(firestore, 'listings');
    const [live, users, done] = await Promise.all([
      c(query(L, where('isCommunityFree', '==', true), where('status', '==', 'approved'))),
      c(collection(firestore, 'users')),
      c(query(collection(firestore, 'communityRequests'), where('status', '==', 'completed'))),
    ]);
    setStats({ live, users, done });
  }
  useEffect(() => {
    setLoading(true);
    Promise.all([loadPending(), loadReports(), loadStats()]).catch(e => setNote('Chưa tải được: ' + (e?.message || ''))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (tab === 'thanhvien' && !users.length) loadUsers().catch(() => setNote('Chưa tải được thành viên.')); }, [tab]);

  async function approve(l: CommunityListing) {
    setBusy(l.id);
    try { await db.updateListingStatus(l.id, 'approved'); setPending(p => p.filter(x => x.id !== l.id)); }
    catch (e: any) { setNote('Chưa duyệt được: ' + (e?.message || '')); }
    finally { setBusy(''); }
  }
  async function reject(l: CommunityListing, reason: string) {
    if (!reason) return;
    setBusy(l.id);
    try {
      await updateDoc(doc(firestore, 'listings', l.id), { status: 'rejected', rejectReason: reason.slice(0, 200) });
      await db.sendNotification({ userId: l.sellerId, title: 'Tin chưa được duyệt', message: '"' + l.title + '": ' + reason + '. Bạn có thể đăng lại cho phù hợp.', type: 'error', link: '/profile' });
      setPending(p => p.filter(x => x.id !== l.id));
    } catch (e: any) { setNote('Chưa từ chối được: ' + (e?.message || '')); }
    finally { setBusy(''); }
  }
  async function hideListing(r: Report) {
    if (!r.listingId || !window.confirm('Ẩn tin bị báo cáo?')) return;
    setBusy(r.id);
    try { await updateDoc(doc(firestore, 'listings', r.listingId), { status: 'hidden' }); await db.resolveReport(r.id); setReports(x => x.filter(y => y.id !== r.id)); }
    catch (e: any) { setNote('Chưa ẩn được: ' + (e?.message || '')); }
    finally { setBusy(''); }
  }
  async function resolve(r: Report) {
    setBusy(r.id);
    try { await db.resolveReport(r.id); setReports(x => x.filter(y => y.id !== r.id)); } finally { setBusy(''); }
  }
  async function setBan(uid: string, banned: boolean) {
    if (!window.confirm(banned ? 'Khoá tài khoản này? Họ sẽ không đăng tin hay gửi yêu cầu được nữa.' : 'Mở khoá tài khoản này?')) return;
    setBusy(uid);
    try {
      await updateDoc(doc(firestore, 'users', uid), { status: banned ? 'banned' : 'active' });
      setUsers(u => u.map(x => x.id === uid ? { ...x, status: banned ? 'banned' : 'active' } as User : x));
      setNote(banned ? 'Đã khoá tài khoản.' : 'Đã mở khoá.');
    } catch (e: any) { setNote('Chưa đổi được: ' + (e?.message || '')); }
    finally { setBusy(''); }
  }

  const tabs: [Tab, string, number][] = [['duyet', 'Duyệt tin', pending.length], ['tatca', 'Quản lý tin', 0], ['baocao', 'Báo cáo', reports.length], ['solieu', 'Số liệu', 0], ['thanhvien', 'Thành viên', 0], ['congcu', 'Công cụ', 0]];
  return <div className="max-w-4xl mx-auto flex flex-col gap-5">
    <div>
      <h1 className="text-2xl md:text-3xl font-extrabold">Quản trị</h1>
      <p className="text-slate-600 mt-1">Máy tự duyệt tin; ở đây là tin máy giữ lại, quản lý mọi tin (ẩn, xoá), báo cáo và số liệu.</p>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {([['Chờ duyệt', pending.length, 'duyet'], ['Báo cáo mới', reports.length, 'baocao'], ['Tin đang hiện', stats.live, 'tatca'], ['Đã chia sẻ xong', stats.done, 'solieu']] as [string, number, Tab][]).map(([l, v, t]) =>
        <button key={l} onClick={() => setTab(t)} className={card + ' p-4 text-left'}><div className="text-xs font-semibold text-slate-600">{l}</div><div className="text-2xl font-extrabold mt-1">{v == null || v === -1 ? '—' : v}</div></button>)}
    </div>
    <div role="tablist" className="flex gap-2 overflow-x-auto">
      {tabs.map(([k, l, n]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
        className={'shrink-0 min-h-10 px-4 rounded-full border text-sm font-bold flex items-center gap-2 ' + (tab === k ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white border-line')}>
        {l}{n > 0 && <span className={'min-w-5 h-5 px-1 rounded-full text-xs grid place-items-center ' + (tab === k ? 'bg-white text-emerald-800' : 'bg-sun text-[#2E1F00]')}>{n}</span>}</button>)}
    </div>
    {note && <p role="status" className="rounded-xl bg-emerald-50 text-emerald-800 p-3 text-sm">{note} <button className="underline" onClick={() => setNote('')}>Đóng</button></p>}
    {loading && <p className="text-slate-600">Đang tải…</p>}

    {!loading && tab === 'duyet' && (pending.length === 0
      ? <p className={card + ' p-6 text-slate-600'}>Không còn tin nào chờ duyệt.</p>
      : <div className="flex flex-col gap-4">{pending.map(l => <PendingCard key={l.id} l={l} busy={busy === l.id} onApprove={() => approve(l)} onReject={r => reject(l, r)} />)}</div>)}

    {!loading && tab === 'baocao' && (reports.length === 0
      ? <p className={card + ' p-6 text-slate-600'}>Không có báo cáo mới.</p>
      : <div className="flex flex-col gap-3">{reports.map(r => <article key={r.id} className={card + ' p-4 flex flex-col gap-2'}>
          <div className="flex items-center gap-2 text-xs text-slate-600"><KIcon name="alert" className="w-4 h-4 text-rose-600" />{r.createdAt ? formatTimeAgo(r.createdAt) : ''}</div>
          <p className="font-semibold">{r.reason}</p>
          {r.listingId && <Link to={'/cong-dong/tin/' + r.listingId} className="text-sm text-emerald-700 underline self-start">Xem tin bị báo cáo</Link>}
          <div className="flex gap-2 flex-wrap">
            {r.listingId && <button disabled={busy === r.id} onClick={() => hideListing(r)} className="min-h-10 px-4 rounded-xl bg-rose-600 text-white text-sm font-bold">Ẩn tin</button>}
            {r.targetUserId && <button disabled={busy === r.id} onClick={() => setBan(r.targetUserId!, true)} className="min-h-10 px-4 rounded-xl border border-rose-300 text-rose-700 text-sm font-bold">Khoá người bị báo cáo</button>}
            <button disabled={busy === r.id} onClick={() => resolve(r)} className="min-h-10 px-4 rounded-xl border border-line text-sm font-semibold">Không vi phạm · đóng</button>
          </div>
        </article>)}</div>)}

    {tab === 'thanhvien' && <div className={card + ' divide-y divide-line'}>{users.map(u => <div key={u.id} className="flex items-center gap-3 p-3">
      {u.avatar ? <img src={u.avatar} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="h-10 w-10 rounded-full bg-emerald-50 grid place-items-center">{(u.name || '?').charAt(0)}</span>}
      <div className="flex-1 min-w-0"><div className="font-bold truncate">{u.name} {u.role === 'admin' && <span className="text-xs text-emerald-700">· admin</span>}</div><div className="text-xs text-slate-600 truncate">{u.email} · {u.location || 'chưa có khu vực'}</div></div>
      <Link to={'/profile/' + u.id} className="text-sm underline text-emerald-700">Hồ sơ</Link>
      {u.role !== 'admin' && <button disabled={busy === u.id} onClick={() => setBan(u.id, u.status !== 'banned')} className={'min-h-9 px-3 rounded-xl text-sm font-bold ' + (u.status === 'banned' ? 'border border-line' : 'border border-rose-300 text-rose-700')}>{u.status === 'banned' ? 'Mở khoá' : 'Khoá'}</button>}
    </div>)}{!users.length && <p className="p-6 text-slate-600">Đang tải…</p>}</div>}

    {tab === 'tatca' && <React.Suspense fallback={<p>Đang tải…</p>}><AdminListings /></React.Suspense>}
    {tab === 'solieu' && <React.Suspense fallback={<p>Đang tải…</p>}><AdminStats /></React.Suspense>}
    {tab === 'congcu' && <div className={card + ' p-5 flex flex-col gap-3'}>
      <h2 className="font-extrabold">Đồng bộ hồ sơ công khai</h2>
      <p className="text-sm text-slate-600">Tạo hồ sơ công khai (tên, ảnh, khu vực) cho tài khoản cũ để người khác thấy tên họ. Chạy một lần là đủ.</p>
      <button onClick={async () => {
        setSyncText('Đang đồng bộ…');
        try { const r = await db.backfillPublicProfiles((d, t) => setSyncText('Đang đồng bộ ' + d + '/' + t + '…')); setSyncText(r.failed ? '⚠️ Xong ' + r.ok + '/' + r.total + ', lỗi ' + r.failed + ' (' + r.firstError + ')' : '✅ Đã đồng bộ ' + r.ok + '/' + r.total + ' hồ sơ.'); }
        catch (e: any) { setSyncText('❌ ' + (e?.code || e?.message || 'Lỗi')); }
      }} className="self-start min-h-11 px-5 rounded-xl bg-emerald-700 text-white font-bold">Đồng bộ ngay</button>
      {syncText && <p className="text-sm font-semibold">{syncText}</p>}
      <hr className="border-line my-2" />
      <h2 className="font-extrabold">Gắn khu vực cho tin cũ</h2>
      <p className="text-sm text-slate-600">Tin đăng trước khi có lọc theo khu vực chưa có mã tỉnh/xã nên chưa hiện ở mục "Gần bạn". Chạy một lần là đủ.</p>
      <button onClick={async () => {
        setAreaText('Đang xử lý…');
        try {
          const { loadDvhc, wardFromLabel, provinceFromLabel } = await import('../utils/dvhc');
          const { wards } = await loadDvhc();
          const snap = await getDocs(query(collection(firestore, 'listings'), where('isCommunityFree', '==', true), limit(1000)));
          let done = 0, skip = 0;
          for (const d of snap.docs) {
            const x: any = d.data();
            if (x.provinceCode) continue;
            const w = (x.areaCode && wards.find(v => v.code === x.areaCode)) || await wardFromLabel(x.location);
            if (!w) {
              const p = await provinceFromLabel(x.location);
              if (!p) { skip++; continue; }
              await updateDoc(d.ref, { provinceCode: p.code });
              done++; setAreaText('Đang xử lý… ' + done); continue;
            }
            await updateDoc(d.ref, { provinceCode: w.provinceCode, areaCode: x.areaCode || w.code });
            done++; setAreaText('Đang xử lý… ' + done);
          }
          setAreaText('✅ Đã gắn khu vực cho ' + done + ' tin' + (skip ? ', ' + skip + ' tin không rõ xã/phường' : '') + '.');
        } catch (e: any) { setAreaText('❌ ' + (e?.code || e?.message || 'Lỗi')); }
      }} className="self-start min-h-11 px-5 rounded-xl bg-emerald-700 text-white font-bold">Gắn khu vực</button>
      {areaText && <p className="text-sm font-semibold">{areaText}</p>}
      <p className="text-xs text-slate-500">Tổng thành viên: {stats.users == null || stats.users === -1 ? '—' : stats.users}</p>
    </div>}
  </div>;
};

function PendingCard({ l, busy, onApprove, onReject }: { l: CommunityListing; busy: boolean; onApprove: () => void; onReject: (r: string) => void; key?: React.Key }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const kind = l.communityKind || 'gift';
  const notes = safetyNotes(l.title + ' ' + (l.description || ''));
  return <article className={card + ' p-4 flex flex-col gap-3'}>
    <div className="flex gap-3 overflow-x-auto">
      {(l.images || []).length ? l.images.map(u => <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="" className="h-28 w-28 rounded-xl object-cover shrink-0" /></a>)
        : <span className={'h-28 w-28 rounded-xl grid place-items-center text-emerald-700 ' + KIND_META[kind].tint}><KIcon name={kind} className="w-10 h-10" /></span>}
    </div>
    <div className="flex items-center gap-2 flex-wrap"><IntentBadge kind={kind} intent={l.communityIntent} /><span className="text-xs text-slate-600">{l.sellerName} · {l.location} · {l.createdAt ? formatTimeAgo(String(l.createdAt)) : ''}</span></div>
    <h3 className="text-lg font-extrabold">{l.title}</h3>
    {l.description && <p className="text-sm text-slate-700 whitespace-pre-wrap">{l.description}</p>}
    {l.meetPlace && <p className="text-sm text-slate-600">Hẹn ở: {l.meetPlace}</p>}
    {(l as any).kiemDuyet?.lyDo && <p className="text-sm rounded-xl bg-sun-light text-sun-dark px-3 py-2"><b>Máy giữ lại vì:</b> {(l as any).kiemDuyet.lyDo}</p>}
    <SafetyBox notes={notes} />
    {!rejecting ? <div className="flex gap-2">
      <button disabled={busy} onClick={onApprove} className="flex-1 min-h-12 rounded-xl bg-emerald-700 text-white font-extrabold disabled:opacity-60">Duyệt</button>
      <button disabled={busy} onClick={() => setRejecting(true)} className="min-h-12 px-5 rounded-xl border border-line font-bold">Từ chối</button>
    </div> : <div className="flex flex-col gap-2">
      <span className="text-sm font-bold">Lý do (người đăng sẽ thấy):</span>
      <div className="flex gap-2 flex-wrap">{REJECT_REASONS.map(r => <button key={r} onClick={() => setReason(r)} aria-pressed={reason === r} className={'min-h-9 px-3 rounded-full border text-[13px] font-semibold ' + (reason === r ? 'border-rose-400 bg-rose-50 text-rose-800' : 'border-line bg-white')}>{r}</button>)}</div>
      <input value={reason} onChange={e => setReason(e.target.value)} maxLength={200} placeholder="Hoặc tự ghi lý do…" className="min-h-11 rounded-xl border border-line px-3" />
      <div className="flex gap-2"><button disabled={busy || !reason} onClick={() => onReject(reason)} className="flex-1 min-h-11 rounded-xl bg-rose-600 text-white font-bold disabled:opacity-50">Từ chối tin</button><button onClick={() => setRejecting(false)} className="min-h-11 px-4 rounded-xl border border-line">Huỷ</button></div>
    </div>}
    <Link to={tinPath(l)} className="text-xs text-slate-500 underline self-start">Mở trang tin</Link>
  </article>;
}

export default Admin;
