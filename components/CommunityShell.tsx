/**
 * Khung giao diện chung của Chợ Của Tui (cộng đồng chia sẻ miễn phí).
 * Mọi trang (khám phá, chat, cá nhân, admin...) đều dùng khung này.
 * Tận dụng lại: phòng chat cũ (đếm tin chưa đọc), menu thông báo cũ, lời mời cài app.
 */
import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import NotificationMenu from './NotificationMenu';
import UniversalInstallPrompt from './UniversalInstallPrompt';
import { db } from '../services/db';
import type { ChatRoom, User } from '../types';

const Icon = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  inbox: <><path d="M4 4h16v12H5.2L4 17.5z" /><path d="M8 9h8M8 12h5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chat: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  bookmark: <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
};
const Svg: React.FC<{ name: keyof typeof Icon; className?: string }> = ({ name, className }) => (
  <svg className={className || 'w-6 h-6'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{Icon[name]}</svg>
);

function useUnreadChats(user: User | null) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  useEffect(() => {
    if (!user?.id) { setRooms([]); return; }
    let unsub: (() => void) | undefined;
    try {
      // @ts-ignore - getChatRooms trả về hàm hủy lắng nghe
      unsub = db.getChatRooms(user.id, (r: ChatRoom[]) => setRooms(r || []));
    } catch (e) { console.warn('Không lắng nghe được chat', e); }
    return () => { if (unsub) unsub(); };
  }, [user?.id]);
  const count = user ? rooms.filter(r => r.messages?.length > 0 && !r.seenBy?.includes(user.id)).length : 0;
  useEffect(() => {
    // Hiện số tin chưa đọc trên icon app (nếu thiết bị hỗ trợ)
    try {
      // @ts-ignore
      if ('setAppBadge' in navigator) count ? navigator.setAppBadge(count) : navigator.clearAppBadge?.();
    } catch (_) { /* bỏ qua */ }
  }, [count]);
  return count;
}

const Badge = ({ n }: { n: number }) => n > 0
  ? <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center border-2 border-white">{n > 9 ? '9+' : n}</span>
  : null;

const CommunityShell: React.FC<{ user: User | null; children: React.ReactNode }> = ({ user, children }) => {
  const { pathname } = useLocation();
  const unread = useUnreadChats(user);
  const [pushNotice, setPushNotice] = useState('');
  const [askingPush, setAskingPush] = useState(false);
  const pushGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';

  async function enablePush() {
    if (!user) return;
    setAskingPush(true);
    try {
      await db.requestNotificationPermission(user.id);
      setPushNotice('Đã bật thông báo trên thiết bị này.');
    } catch (_) {
      setPushNotice('Thiết bị hoặc trình duyệt chưa hỗ trợ thông báo.');
    } finally { setAskingPush(false); }
  }

  const tab = (to: string, label: string, icon: keyof typeof Icon, active: boolean, badge = 0) => (
    <Link to={to} className={'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold ' + (active ? 'text-emerald-700' : 'text-slate-500')} aria-current={active ? 'page' : undefined}>
      <span className="relative"><Svg name={icon} /><Badge n={badge} /></span>{label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#f7faf8] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Chợ Của Tui - Trang chủ">
            <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-2xl" />
            <span className="text-lg md:text-xl leading-none font-black text-emerald-900">Chợ Của Tui
              <span className="hidden sm:block text-xs mt-1 font-medium text-slate-500">Có gì chia sẻ, cần gì có nhau</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-6 text-sm font-semibold text-slate-600">
            <NavLink to="/" end className={({ isActive }) => 'px-3 py-2 rounded-xl ' + (isActive ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50')}>Khám phá</NavLink>
            <NavLink to="/cong-dong/yeu-cau" className={({ isActive }) => 'px-3 py-2 rounded-xl ' + (isActive ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50')}>Yêu cầu</NavLink>
            <NavLink to="/cong-dong/da-luu" className={({ isActive }) => 'px-3 py-2 rounded-xl ' + (isActive ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50')}>Đã lưu</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link to="/cong-dong/dang-tin" className="hidden sm:flex items-center justify-center rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 h-10">＋ Đăng tin</Link>
            {user ? <>
              {!pushGranted && <button onClick={enablePush} disabled={askingPush} className="hidden sm:block text-xs font-semibold text-emerald-800 border border-emerald-200 rounded-xl px-3 h-10">Bật thông báo</button>}
              <NotificationMenu userId={user.id} />
              <Link to="/chat" className="relative hidden md:grid place-items-center h-10 w-10 rounded-xl text-slate-600 hover:bg-slate-50" title="Tin nhắn">
                <span className="relative"><Svg name="chat" /><Badge n={unread} /></span>
              </Link>
              <Link to="/profile" className="hidden md:block" title="Cá nhân">
                {user.avatar ? <img src={user.avatar} alt="" className="h-10 w-10 rounded-full object-cover border border-slate-200" /> : <span className="grid place-items-center h-10 w-10 rounded-full bg-emerald-50 text-emerald-800"><Svg name="user" className="w-5 h-5" /></span>}
              </Link>
            </> : <Link to="/login" className="rounded-xl border border-emerald-700 text-emerald-800 px-4 py-2 text-sm font-bold">Đăng nhập</Link>}
          </div>
        </div>
        {pushNotice && <p role="status" className="text-center text-xs bg-emerald-50 text-emerald-800 py-2">{pushNotice} <button className="underline" onClick={() => setPushNotice('')}>Đóng</button></p>}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-9 pb-28 md:pb-10">{children}</main>

      <footer className="border-t bg-white p-6 mb-16 md:mb-0 text-center text-sm text-slate-500">
        <img src="/icons/icon-192.png" alt="" className="inline h-6 w-6 rounded-lg align-middle mr-2" />
        Chợ Của Tui · Mọi người cùng chia sẻ · Hoàn toàn miễn phí
        <div className="mt-2 space-x-4">
          <Link className="underline" to="/page/gioi-thieu">Giới thiệu</Link>
          <Link className="underline" to="/page/quy-tac">Quy tắc cộng đồng</Link>
          <Link className="underline" to="/page/an-toan">An toàn khi trao đồ</Link>
        </div>
      </footer>

      <nav aria-label="Điều hướng nhanh" className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-end bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        {tab('/', 'Khám phá', 'home', pathname === '/' || pathname === '/cong-dong' || pathname.startsWith('/cong-dong/tin'))}
        {tab('/cong-dong/yeu-cau', 'Yêu cầu', 'inbox', pathname.startsWith('/cong-dong/yeu-cau'))}
        <Link to="/cong-dong/dang-tin" className="flex-1 flex flex-col items-center pb-2 text-[11px] font-bold text-emerald-800" aria-label="Đăng tin">
          <span className="-mt-5 mb-0.5 grid place-items-center h-12 w-12 rounded-full bg-emerald-700 text-white shadow-lg border-4 border-white"><Svg name="plus" /></span>Đăng tin
        </Link>
        {tab('/chat', 'Tin nhắn', 'chat', pathname.startsWith('/chat'), unread)}
        {tab('/profile', 'Cá nhân', 'user', pathname.startsWith('/profile') || pathname.startsWith('/cong-dong/da-luu'))}
      </nav>

      <UniversalInstallPrompt />
    </div>
  );
};

export default CommunityShell;
