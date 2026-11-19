/**
 * Trang Cá nhân — cộng đồng chia sẻ miễn phí.
 * Dùng lại: hồ sơ users, ảnh đại diện trên Storage, tin trong listings, tin đã lưu (favorites).
 */
import { tinPath } from '../utils/format';
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { User } from '../types';
import { db } from '../services/db';
import { community, kindLabels, type CommunityListing } from '../services/community';
import { Card } from './CommunityApp';
import { thumbOf } from '../utils/format';
import { compressAndGetBase64 } from '../utils/imageCompression';
import { AreaInput } from '../components/AreaInput';

interface ProfileProps {
  user: User;
  onLogout: () => void;
  onUpdateUser: (user: User) => void;
}

const statusText: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-800' },
  approved: { label: 'Đang hiện', cls: 'bg-emerald-50 text-emerald-800' },
  sold: { label: 'Đã xong', cls: 'bg-slate-100 text-slate-600' },
  hidden: { label: 'Đã ẩn', cls: 'bg-slate-100 text-slate-500' },
  rejected: { label: 'Bị từ chối', cls: 'bg-rose-50 text-rose-700' },
  expired: { label: 'Hết hạn', cls: 'bg-sun-light text-sun-dark' },
};
const btn = 'min-h-10 rounded-xl px-4 text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50';
const input = 'w-full min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-600';

const Profile: React.FC<ProfileProps> = ({ user, onLogout, onUpdateUser }) => {
  const [tab, setTab] = useState<'mine' | 'saved' | 'settings'>('mine');
  const [mine, setMine] = useState<CommunityListing[]>([]);
  const [saved, setSaved] = useState<CommunityListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: user.name || '', phone: user.phone || '', location: user.location || '' });
  const [savingForm, setSavingForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rep, setRep] = useState<{ sharedCount?: number; receivedCount?: number } | null>(null);
  useEffect(() => { db.getPublicProfile(user.id).then(p => setRep(p)); }, [user.id]);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([community.myListings(user.id), community.saved(user.id)])
      .then(([m, s]) => { if (alive) { setMine(m); setSaved(s); } })
      .catch(() => alive && setMessage('Chưa tải được dữ liệu, thử tải lại trang.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [user.id]);

  const done = mine.filter(x => x.status === 'sold').length;
  const active = mine.filter(x => x.status === 'approved').length;

  async function setStatus(item: CommunityListing, status: 'sold' | 'hidden') {
    setWorking(item.id);
    try {
      await community.setMyStatus(item.id, status);
      setMine(list => list.map(x => x.id === item.id ? { ...x, status } as CommunityListing : x));
    } catch (_) { setMessage('Chưa cập nhật được tin.'); }
    finally { setWorking(''); }
  }
  async function renew(item: CommunityListing) {
    setWorking(item.id);
    try { await community.renew(item.id); setMine(list => list.map(x => x.id === item.id ? { ...x, status: 'approved' } as CommunityListing : x)); setMessage('Đã gia hạn, tin hiện thêm 30 ngày.'); }
    catch (_) { setMessage('Chưa gia hạn được. Có thể quy tắc mới chưa được phát hành.'); }
    finally { setWorking(''); }
  }
  async function remove(item: CommunityListing) {
    if (!window.confirm('Xóa hẳn tin "' + item.title + '"?')) return;
    setWorking(item.id);
    try { await community.remove(item.id); setMine(list => list.filter(x => x.id !== item.id)); }
    catch (_) { setMessage('Chưa xóa được tin.'); }
    finally { setWorking(''); }
  }
  async function changeAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await compressAndGetBase64(file);
      // Lưu trong users/<uid>/ — thư mục Storage rules cho phép chủ tài khoản ghi.
      const url = await db.uploadImage(base64, 'users/' + user.id + '/avatar-' + Date.now() + '.jpg');
      onUpdateUser(await db.updateUserProfile(user.id, { avatar: url }));
    } catch (_) { setMessage('Chưa đổi được ảnh đại diện.'); }
    finally { setUploading(false); if (avatarRef.current) avatarRef.current.value = ''; }
  }
  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    setSavingForm(true);
    try {
      onUpdateUser(await db.updateUserProfile(user.id, {
        name: form.name.trim().slice(0, 60) || user.name,
        phone: form.phone.trim().slice(0, 20),
        location: form.location.trim().slice(0, 100),
      }));
      setMessage('Đã lưu thông tin.');
    } catch (_) { setMessage('Chưa lưu được thông tin.'); }
    finally { setSavingForm(false); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <section className="bg-white rounded-3xl border border-slate-100 p-5 md:p-8 flex flex-col sm:flex-row gap-5 sm:items-center">
        <button onClick={() => avatarRef.current?.click()} className="relative shrink-0 self-start" title="Đổi ảnh đại diện">
          {user.avatar ? <img src={user.avatar} alt="" className="h-20 w-20 rounded-full object-cover border" />
            : <span className="grid place-items-center h-20 w-20 rounded-full bg-emerald-50 text-3xl">🌿</span>}
          <span className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-white border grid place-items-center text-xs">{uploading ? '…' : '📷'}</span>
        </button>
        <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={changeAvatar} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black truncate">{user.name}</h1>
          <p className="text-sm text-slate-500 mt-1">📍 {user.location || 'Chưa có khu vực'} · Tham gia {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString('vi-VN') : ''}</p>
          <div className="flex gap-4 mt-3 text-sm">
            <span><b className="text-emerald-700">{active}</b> tin đang hiện</span>
            <span><b className="text-emerald-700">{rep?.sharedCount ?? done}</b> lần đã cho/giúp xong</span>
            {(rep?.receivedCount || 0) > 0 && <span><b className="text-emerald-700">{rep!.receivedCount}</b> lần đã nhận</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/cong-dong/yeu-cau" className={btn + ' inline-flex items-center'}>Yêu cầu</Link>
          <Link to="/chat" className={btn + ' inline-flex items-center'}>Tin nhắn</Link>
          {user.role === 'admin' && <Link to="/admin" className={btn + ' inline-flex items-center text-rose-700'}>Quản trị</Link>}
          <button onClick={onLogout} className={btn}>Đăng xuất</button>
        </div>
      </section>

      {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 text-emerald-800 p-3 text-sm">{message} <button className="underline" onClick={() => setMessage('')}>Đóng</button></p>}

      <div className="flex gap-2 mt-6 mb-4 overflow-x-auto">
        {([['mine', 'Tin của tôi (' + mine.length + ')'], ['saved', 'Đã lưu (' + saved.length + ')'], ['settings', 'Thông tin']] as const).map(([k, label]) =>
          <button key={k} onClick={() => setTab(k)} className={'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold border ' + (tab === k ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-600 border-slate-200')}>{label}</button>)}
      </div>

      {loading && tab !== 'settings' ? <p className="text-slate-500">Đang tải…</p> : null}

      {!loading && tab === 'mine' && (!mine.length
        ? <p className="rounded-2xl bg-white border p-6 text-slate-500">Bạn chưa đăng tin nào. <Link className="underline text-emerald-700" to="/cong-dong/dang-tin">Đăng tin đầu tiên</Link></p>
        : <div className="space-y-3">{mine.map(item => {
            const st = statusText[item.status] || statusText.pending;
            return <article key={item.id} className="bg-white rounded-2xl border p-4 flex gap-4">
              {thumbOf(item) ? <img src={thumbOf(item)} alt="" loading="lazy" className="h-20 w-20 rounded-xl object-cover shrink-0" />
                : <span className="h-20 w-20 rounded-xl bg-emerald-50 grid place-items-center text-3xl shrink-0">🌿</span>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className={'rounded-full px-2 py-1 font-semibold ' + st.cls}>{st.label}</span>
                  {item.communityKind && <span className="text-slate-500">{kindLabels[item.communityKind]}</span>}
                </div>
                <Link to={tinPath(item)} className="block font-bold mt-1 truncate hover:underline">{item.title}</Link>
                <div className="flex gap-2 flex-wrap mt-2">
                  {item.status === 'expired' && <button disabled={working === item.id} onClick={() => renew(item)} className={btn + ' !bg-emerald-700 !text-white !border-emerald-700'}>Gia hạn 30 ngày</button>}
                  {item.status === 'rejected' && (item as any).rejectReason && <span className="text-xs text-rose-700 basis-full">Lý do: {(item as any).rejectReason}</span>}
                  {item.status === 'approved' && <>
                    <button disabled={working === item.id} onClick={() => setStatus(item, 'sold')} className={btn}>✓ Đã xong</button>
                    <button disabled={working === item.id} onClick={() => setStatus(item, 'hidden')} className={btn}>Ẩn tin</button>
                  </>}
                  <button disabled={working === item.id} onClick={() => remove(item)} className={btn + ' text-rose-700'}>Xóa</button>
                </div>
              </div>
            </article>;
          })}</div>)}

      {!loading && tab === 'saved' && (!saved.length
        ? <p className="rounded-2xl bg-white border p-6 text-slate-500">Chưa lưu tin nào. Bấm "Lưu tin" ở trang chi tiết để xem lại sau.</p>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{saved.map(item => <Card item={item} key={item.id} />)}</div>)}

      {tab === 'settings' && (
        <form onSubmit={saveForm} className="bg-white rounded-2xl border p-5 space-y-4 max-w-xl">
          <label className="block"><span className="font-semibold block mb-1">Tên hiển thị</span>
            <input className={input} value={form.name} maxLength={60} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <div><span className="font-semibold block mb-1">Khu vực (xã/phường)</span>
            <AreaInput value={form.location} onType={t => setForm(f => ({ ...f, location: t }))} onPick={w => setForm(f => ({ ...f, location: w.label }))} /></div>
          <label className="block"><span className="font-semibold block mb-1">Số điện thoại (không bắt buộc)</span>
            <input className={input} value={form.phone} maxLength={20} inputMode="tel" onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
          <p className="text-xs text-slate-500">Email: {user.email}. Chỉ chia sẻ số điện thoại trong tin nhắn khi bạn tin tưởng người kia.</p>
          <button disabled={savingForm} className="min-h-12 w-full rounded-2xl bg-emerald-700 text-white font-bold disabled:opacity-60">{savingForm ? 'Đang lưu…' : 'Lưu thông tin'}</button>
        </form>
      )}
    </div>
  );
};

export default Profile;
