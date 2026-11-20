/**
 * Đăng ký thành viên cộng đồng — một bước, gọn: tên, email, mật khẩu (có nút Hiện),
 * xã/phường không bắt buộc. Không hỏi địa chỉ nhà hay vị trí GPS.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { User } from '../types';
import { AreaInput } from '../components/AreaInput';
import { AuthFrame, PasswordField, Spinner, fieldCls } from '../components/AuthUI';

const Register: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', location: '' });
  const [showArea, setShowArea] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.name.trim().length < 2) return setError('Hãy nhập tên của bạn.');
    if (form.password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.');
    setBusy(true);
    try {
      const user = await db.register(form.email.trim(), form.password, form.name.trim().slice(0, 60));
      const updated = form.location.trim() ? await db.updateUserProfile(user.id, { location: form.location.trim().slice(0, 100) }) : user;
      onLogin(updated);
      navigate('/');
    } catch (err: any) {
      const c = err?.code || '';
      if (c === 'auth/email-already-in-use') setError('Email này đã có tài khoản. Bấm "Đăng nhập" ở trên nhé.');
      else if (c === 'auth/invalid-email') setError('Email chưa đúng.');
      else if (c === 'auth/weak-password') setError('Mật khẩu yếu quá, thêm vài ký tự nhé.');
      else setError('Chưa đăng ký được, thử lại nhé.');
    } finally { setBusy(false); }
  }

  async function google() {
    setError(''); setBusy(true);
    try { onLogin(await db.loginWithGoogle()); navigate('/'); }
    catch (err: any) { const c = err?.code || ''; if (c !== 'auth/popup-closed-by-user' && c !== 'auth/cancelled-popup-request') setError('Chưa đăng ký bằng Google được, thử lại nhé.'); }
    finally { setBusy(false); }
  }

  return <AuthFrame mode="register" title="Tham gia Chợ Của Tui" sub="Miễn phí hoàn toàn. Cho, mượn, giúp nhau với hàng xóm." error={error} busy={busy} onGoogle={google}
    footer={<p className="text-center text-xs leading-relaxed text-slate-500">Khi đăng ký, bạn đồng ý với <Link to="/page/quy-tac" className="underline">quy tắc cộng đồng</Link>, <Link to="/page/dieu-khoan" className="underline">điều khoản</Link> và <Link to="/page/chinh-sach-bao-mat" className="underline">chính sách bảo mật</Link>.</p>}>
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input value={form.name} onChange={e => set('name')(e.target.value)} maxLength={60} autoComplete="name" placeholder="Tên hiển thị (ví dụ: Chị Lan)" aria-label="Tên hiển thị" required className={fieldCls} />
      <input type="email" inputMode="email" value={form.email} onChange={e => set('email')(e.target.value)} autoComplete="email" placeholder="Email" aria-label="Email" required className={fieldCls} />
      <PasswordField value={form.password} onChange={set('password')} autoComplete="new-password" placeholder="Mật khẩu (ít nhất 6 ký tự)" />
      {showArea
        ? <div><span className="text-sm font-semibold block mb-1">Xã/phường của bạn</span>
            <AreaInput value={form.location} onType={t => set('location')(t)} onPick={w => set('location')(w.label)} /></div>
        : <button type="button" onClick={() => setShowArea(true)} className="self-start text-sm font-semibold text-emerald-700 min-h-9">+ Thêm xã/phường để thấy tin gần bạn</button>}
      <button type="submit" disabled={busy} className="min-h-[52px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-base font-extrabold flex items-center justify-center active:scale-[0.98] disabled:opacity-60">
        {busy ? <Spinner /> : 'Tạo tài khoản'}</button>
    </form>
  </AuthFrame>;
};

export default Register;
