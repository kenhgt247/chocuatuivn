/** Khung chung cho Đăng nhập / Đăng ký: gọn, Google trước, email sau. */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export const fieldCls = 'w-full min-h-[52px] rounded-2xl border border-line bg-white px-4 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20';

export function GoogleIcon() {
  return <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>;
}

export function PasswordField({ value, onChange, autoComplete, placeholder }: { value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return <div className="relative">
    <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} autoComplete={autoComplete}
      placeholder={placeholder || 'Mật khẩu'} aria-label="Mật khẩu" required className={fieldCls + ' pr-20'} />
    <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 min-h-10 px-3 rounded-xl text-sm font-bold text-emerald-700">
      {show ? 'Ẩn' : 'Hiện'}</button>
  </div>;
}

export function AuthFrame({ mode, title, sub, error, busy, onGoogle, children, footer }: {
  mode: 'login' | 'register'; title: string; sub: string; error?: string; busy?: boolean;
  onGoogle: () => void; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const tab = (to: string, label: string, on: boolean) => <Link to={to} replace aria-current={on ? 'page' : undefined}
    className={'flex-1 min-h-11 rounded-xl grid place-items-center text-[15px] font-extrabold ' + (on ? 'bg-white text-ink shadow-sm' : 'text-slate-600')}>{label}</Link>;
  return <div className="max-w-sm mx-auto pt-4 pb-8 flex flex-col gap-5">
    <div className="flex p-1 bg-[#F1ECDF] rounded-2xl">{tab('/login', 'Đăng nhập', mode === 'login')}{tab('/register', 'Đăng ký', mode === 'register')}</div>
    <div>
      <h1 className="text-[26px] leading-tight font-extrabold">{title}</h1>
      <p className="text-[15px] text-slate-600 mt-1">{sub}</p>
    </div>
    {error && <p role="alert" className="rounded-2xl bg-rose-50 text-rose-800 px-4 py-3 text-sm font-semibold">{error}</p>}
    <button type="button" onClick={onGoogle} disabled={busy}
      className="min-h-[52px] rounded-2xl bg-white border border-line flex items-center justify-center gap-3 text-base font-bold active:scale-[0.98] disabled:opacity-60">
      <GoogleIcon />Tiếp tục với Google</button>
    <div className="flex items-center gap-3 text-xs font-semibold text-slate-500"><span className="flex-1 h-px bg-line" />hoặc dùng email<span className="flex-1 h-px bg-line" /></div>
    {children}
    {footer}
  </div>;
}

export function Spinner() {
  return <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />;
}
