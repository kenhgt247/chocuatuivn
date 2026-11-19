/**
 * Đăng ký thành viên cộng đồng — một bước, không hỏi địa chỉ nhà hay vị trí GPS.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { User } from '../types';

const input = 'w-full min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-600';

const Register: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', location: '' });
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.name.trim().length < 2) return setError('Hãy nhập tên của bạn.');
    if (form.password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.');
    if (form.password !== form.confirm) return setError('Mật khẩu nhập lại chưa khớp.');
    if (!agree) return setError('Hãy đồng ý với quy tắc cộng đồng.');
    setLoading(true);
    try {
      const user = await db.register(form.email.trim(), form.password, form.name.trim().slice(0, 60));
      const updated = form.location.trim()
        ? await db.updateUserProfile(user.id, { location: form.location.trim().slice(0, 100) })
        : user;
      onLogin(updated);
      navigate('/');
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') setError('Email này đã được dùng. Hãy đăng nhập.');
      else if (err?.code === 'auth/invalid-email') setError('Email chưa đúng.');
      else setError('Chưa đăng ký được: ' + (err?.message || 'lỗi không rõ'));
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-md mx-auto py-6">
      <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="text-center">
          <img src="/icons/icon-192.png" alt="" className="h-16 w-16 rounded-2xl mx-auto" />
          <h1 className="text-2xl font-black mt-3">Tham gia Chợ Của Tui</h1>
          <p className="text-sm text-slate-500 mt-1">Miễn phí. Không VIP, không ví tiền.</p>
        </div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          <label className="block"><span className="font-semibold block mb-1">Tên hiển thị</span>
            <input className={input} value={form.name} onChange={set('name')} maxLength={60} autoComplete="name" required /></label>
          <label className="block"><span className="font-semibold block mb-1">Email</span>
            <input className={input} type="email" value={form.email} onChange={set('email')} autoComplete="email" required /></label>
          <label className="block"><span className="font-semibold block mb-1">Mật khẩu</span>
            <input className={input} type="password" value={form.password} onChange={set('password')} autoComplete="new-password" required /></label>
          <label className="block"><span className="font-semibold block mb-1">Nhập lại mật khẩu</span>
            <input className={input} type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required /></label>
          <label className="block"><span className="font-semibold block mb-1">Khu vực (không bắt buộc)</span>
            <input className={input} value={form.location} onChange={set('location')} maxLength={100} placeholder="Ví dụ: Phường Chí Linh, Hải Phòng" /></label>
          <label className="flex gap-2 items-start text-sm text-slate-600">
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-1 h-4 w-4" />
            <span>Tôi đồng ý với <Link to="/page/quy-tac" className="underline text-emerald-700">quy tắc cộng đồng</Link>: không mua bán, không đòi tiền.</span>
          </label>
          <button disabled={loading} className="min-h-12 w-full rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold disabled:opacity-60">{loading ? 'Đang tạo tài khoản…' : 'Đăng ký miễn phí'}</button>
        </form>
        <p className="text-center text-sm text-slate-500">Đã có tài khoản? <Link to="/login" className="underline text-emerald-700 font-semibold">Đăng nhập</Link></p>
      </div>
    </div>
  );
};

export default Register;
