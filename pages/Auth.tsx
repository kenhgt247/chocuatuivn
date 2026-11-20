/** Đăng nhập — gọn: Google một chạm, hoặc email + mật khẩu; có quên mật khẩu. */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../services/db';
import { AuthFrame, PasswordField, Spinner, fieldCls } from '../components/AuthUI';

const Auth: React.FC<{ onLogin: (user: any) => void }> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setError(''); setInfo(''); setBusy(true);
    try {
      onLogin(await db.login(email.trim(), password));
      navigate('/');
    } catch (err: any) {
      const c = err?.code || '';
      if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-email'].includes(c)) setError('Email hoặc mật khẩu chưa đúng.');
      else if (c === 'auth/too-many-requests') setError('Thử sai nhiều lần quá. Chờ ít phút rồi thử lại nhé.');
      else if (c === 'auth/network-request-failed') setError('Mạng đang yếu, thử lại nhé.');
      else setError('Chưa đăng nhập được, thử lại nhé.');
    } finally { setBusy(false); }
  }

  async function handleGoogle() {
    setError(''); setInfo(''); setBusy(true);
    try { onLogin(await db.loginWithGoogle()); navigate('/'); }
    catch (err: any) {
      const c = err?.code || '';
      if (c !== 'auth/popup-closed-by-user' && c !== 'auth/cancelled-popup-request') setError('Chưa đăng nhập Google được' + (c === 'auth/popup-blocked' ? ': trình duyệt chặn cửa sổ, hãy cho phép rồi thử lại.' : ', thử lại nhé.'));
    } finally { setBusy(false); }
  }

  async function forgot() {
    setError(''); setInfo('');
    if (!/\S+@\S+\.\S+/.test(email)) return setError('Nhập email của bạn vào ô trên trước, rồi bấm "Quên mật khẩu".');
    try { await sendPasswordResetEmail(auth, email.trim()); setInfo('Đã gửi thư đặt lại mật khẩu tới ' + email.trim() + '. Xem cả mục Thư rác nhé.'); }
    catch (_) { setError('Chưa gửi được thư, kiểm tra lại email.'); }
  }

  return <AuthFrame mode="login" title="Chào bạn quay lại 👋" sub="Đăng nhập để xin đồ, nhắn tin và đăng tin." error={error} busy={busy} onGoogle={handleGoogle}>
    <form onSubmit={handleLogin} className="flex flex-col gap-3">
      <input type="email" inputMode="email" autoComplete="email" placeholder="Email" aria-label="Email" value={email} onChange={e => setEmail(e.target.value)} required className={fieldCls} />
      <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
      <button type="button" onClick={forgot} className="self-end text-sm font-semibold text-emerald-700 min-h-9">Quên mật khẩu?</button>
      {info && <p role="status" className="rounded-2xl bg-emerald-50 text-emerald-800 px-4 py-3 text-sm">{info}</p>}
      <button type="submit" disabled={busy} className="min-h-[52px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-base font-extrabold flex items-center justify-center active:scale-[0.98] disabled:opacity-60">
        {busy ? <Spinner /> : 'Đăng nhập'}</button>
    </form>
  </AuthFrame>;
};

export default Auth;
