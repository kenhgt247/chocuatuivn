/**
 * Khung giao diện chung của Chợ Của Tui (cộng đồng chia sẻ miễn phí).
 * Mọi trang dùng khung này: header có khu vực, thanh dưới 5 nút, chân trang.
 * Tận dụng lại: phòng chat cũ (đếm tin chưa đọc), menu thông báo cũ, lời mời cài app.
 */
import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import NotificationMenu from './NotificationMenu';
import UniversalInstallPrompt from './UniversalInstallPrompt';
import { db } from '../services/db';
import { getArea, setArea, onAreaChange } from '../utils/area';
import { AreaInput } from './AreaInput';
import type { ChatRoom, User } from '../types';

export const Icon = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  inbox: <><path d="M4 4h16v12H5.2L4 17.5z" /><path d="M8 9h8M8 12h5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chat: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  down: <path d="m6 9 6 6 6-6" />,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
};
export const Svg: React.FC<{ name: keyof typeof Icon; className?: string; strokeWidth?: number }> = ({ name, className, strokeWidth = 2 }) => (
  <svg className={className || 'w-6 h-6'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{Icon[name]}</svg>
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
    try {
      // @ts-ignore - hiện số tin chưa đọc trên icon app nếu thiết bị hỗ trợ
      if ('setAppBadge' in navigator) count ? navigator.setAppBadge(count) : navigator.clearAppBadge?.();
    } catch (_) { /* bỏ qua */ }
  }, [count]);
  return count;
}

const Badge = ({ n }: { n: number }) => n > 0
  ? <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-700 text-white text-[11px] font-bold grid place-items-center border-2 border-white">{n > 9 ? '9+' : n}</span>
  : null;

/** Ô chọn khu vực (xã/phường) trên header. */
function AreaPicker({ user }: { user: User | null }) {
  const [area, setAreaState] = useState(() => getArea(user?.location || ''));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(area);
  useEffect(() => onAreaChange(() => setAreaState(getArea(user?.location || ''))), [user?.location]);
  useEffect(() => { if (!getArea('') && user?.location) setAreaState(user.location); }, [user?.location]);
  const save = (v: string) => { setArea(v); setAreaState(v); setOpen(false); };
  return (
    <div className="relative">
      <button onClick={() => { setDraft(area); setOpen(o => !o); }} className="flex items-center gap-1 text-[13px] font-semibold text-emerald-700 min-h-6" aria-expanded={open}>
        <Svg name="pin" className="w-4 h-4" />
        <span className="max-w-[160px] truncate">{area ? area.split(',')[0] : 'Chọn khu vực'}</span>
        <Svg name="down" className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-50 w-80 bg-white border border-line rounded-2xl shadow-xl p-4 space-y-3">
          <label htmlFor="area-input" className="block text-sm font-bold">Bạn ở xã/phường nào?</label>
          <AreaInput id="area-input" autoFocus value={draft} onPick={w => { setArea(w.label, { lat: w.lat, lng: w.lng }); setAreaState(w.label); setOpen(false); }} />
          <p className="text-xs text-slate-500">Tin cùng xã/phường hiện lên trước. Danh sách theo đơn vị hành chính mới (từ 01/07/2025).</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => save('')} className="flex-1 min-h-11 rounded-xl border border-line text-sm font-semibold">Xem tất cả khu vực</button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-4 rounded-xl text-sm font-semibold">Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
}

const CommunityShell: React.FC<{ user: User | null; children: React.ReactNode }> = ({ user, children }) => {
  const { pathname } = useLocation();
  const unread = useUnreadChats(user);
  const [pushNotice, setPushNotice] = useState('');
  const [askingPush, setAskingPush] = useState(false);
  const pushGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
  // Trang chat cần chiều cao cố định, ẩn chân trang cho gọn
  const isChat = pathname.startsWith('/chat');
  // Trang có thanh nút cố định ở đáy (đăng tin, xem tin) trên điện thoại
  const hasActionBar = pathname.startsWith('/cong-dong/dang-tin') || pathname.startsWith('/cong-dong/tin/');

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
    <Link to={to} className={'flex-1 flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-xs ' + (active ? 'text-emerald-700 font-bold' : 'text-slate-500 font-semibold')} aria-current={active ? 'page' : undefined}>
      <span className="relative flex"><Svg name={icon} /><Badge n={badge} /></span>{label}
    </Link>
  );
  const navCls = ({ isActive }: { isActive: boolean }) => 'px-3 py-2 rounded-xl ' + (isActive ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-white');

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-6xl px-4 md:px-5 h-[68px] flex items-center gap-3">
          <Link to="/" aria-label="Chợ Của Tui - Trang chủ" className="shrink-0">
            <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
          </Link>
          <div className="flex flex-col min-w-0">
            <Link to="/" className="text-lg font-extrabold leading-tight text-emerald-900">Chợ Của Tui</Link>
            <AreaPicker user={user} />
          </div>
          <nav className="hidden md:flex items-center gap-1 ml-6 text-sm font-semibold text-slate-600">
            <NavLink to="/" end className={navCls}>Khám phá</NavLink>
            <NavLink to="/cong-dong/yeu-cau" className={navCls}>Yêu cầu</NavLink>
            <NavLink to="/cong-dong/da-luu" className={navCls}>Đã lưu</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Link to="/cong-dong/dang-tin" className="hidden md:flex items-center justify-center rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 h-11">＋ Đăng tin</Link>
            {user ? <>
              {!pushGranted && <button onClick={enablePush} disabled={askingPush} className="hidden lg:block text-xs font-semibold text-emerald-800 border border-emerald-200 rounded-xl px-3 h-11 bg-white">Bật thông báo</button>}
              <div className="h-11 w-11 rounded-full bg-white border border-line grid place-items-center"><NotificationMenu userId={user.id} /></div>
              <Link to="/chat" className="relative hidden md:grid place-items-center h-11 w-11 rounded-full bg-white border border-line text-slate-700" title="Tin nhắn">
                <span className="relative flex"><Svg name="chat" className="w-5 h-5" /><Badge n={unread} /></span>
              </Link>
              <Link to="/profile" className="hidden md:block" title="Cá nhân">
                {user.avatar ? <img src={user.avatar} alt="" className="h-11 w-11 rounded-full object-cover border border-line" /> : <span className="grid place-items-center h-11 w-11 rounded-full bg-emerald-50 text-emerald-800"><Svg name="user" className="w-5 h-5" /></span>}
              </Link>
            </> : <Link to="/login" className="rounded-xl border border-emerald-700 text-emerald-800 bg-white px-4 h-11 flex items-center text-sm font-bold">Đăng nhập</Link>}
          </div>
        </div>
        {pushNotice && <p role="status" className="text-center text-xs bg-emerald-50 text-emerald-800 py-2">{pushNotice} <button className="underline" onClick={() => setPushNotice('')}>Đóng</button></p>}
      </header>

      <main className={'max-w-6xl mx-auto px-4 md:px-5 ' + (isChat ? 'py-3 md:py-6 pb-24 md:pb-6' : 'pt-5 md:pt-8 ' + (hasActionBar ? 'pb-36 md:pb-10' : 'pb-8 md:pb-10'))}>{children}</main>

      {!isChat && <footer className="border-t border-line bg-white">
        <div className={'max-w-6xl mx-auto px-4 md:px-5 pt-4 md:py-6 md:flex md:items-center md:justify-between md:gap-6 ' +
          (hasActionBar ? 'pb-[calc(176px+env(safe-area-inset-bottom))]' : 'pb-[calc(92px+env(safe-area-inset-bottom))]') + ' md:pb-6'}>
          <div className="flex items-center justify-center md:justify-start gap-2 md:gap-3">
            <img src="/icons/icon-192.png" alt="" className="h-6 w-6 md:h-10 md:w-10 rounded-lg md:rounded-xl shrink-0" />
            <p className="text-[13px] md:text-base text-slate-600">
              <span className="font-extrabold text-emerald-900">Chợ Của Tui</span>
              <span className="md:hidden"> · Miễn phí</span>
              <span className="hidden md:block text-[13px]">Mọi người cùng chia sẻ · Hoàn toàn miễn phí</span>
            </p>
          </div>
          <nav aria-label="Thông tin" className="mt-1 md:mt-0 flex flex-wrap justify-center md:justify-end gap-x-3 md:gap-x-5 text-xs md:text-sm font-semibold text-slate-600">
            {[['/page/gioi-thieu', 'Giới thiệu'], ['/page/quy-tac', 'Quy tắc'], ['/page/an-toan', 'An toàn'],
              ['/page/chinh-sach-bao-mat', 'Bảo mật'], ['/page/dieu-khoan', 'Điều khoản']].map(([to, label]) =>
              <Link key={to} to={to} className="min-h-9 md:min-h-11 flex items-center hover:text-emerald-700">{label}</Link>)}
          </nav>
        </div>
      </footer>}

      <nav aria-label="Điều hướng nhanh" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-line pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(0,0,0,0.05)]">
        <div className="h-16 flex items-start">
        {tab('/', 'Khám phá', 'home', pathname === '/' || pathname === '/cong-dong' || pathname.startsWith('/cong-dong/tin'))}
        {tab('/cong-dong/yeu-cau', 'Yêu cầu', 'inbox', pathname.startsWith('/cong-dong/yeu-cau'))}
        <Link to="/cong-dong/dang-tin" className="flex-1 flex flex-col items-center pb-2 text-xs font-bold text-emerald-700" aria-label="Đăng tin">
          <span className="-mt-[18px] mb-0.5 grid place-items-center h-[54px] w-[54px] rounded-full bg-emerald-700 text-white border-4 border-white shadow-[0_6px_16px_rgba(18,53,36,.25)]"><Svg name="plus" className="w-7 h-7" strokeWidth={2.5} /></span>Đăng tin
        </Link>
        {tab('/chat', 'Tin nhắn', 'chat', pathname.startsWith('/chat'), unread)}
        {tab('/profile', 'Cá nhân', 'user', pathname.startsWith('/profile') || pathname.startsWith('/cong-dong/da-luu'))}
        </div>
      </nav>

      <UniversalInstallPrompt />
    </div>
  );
};

export default CommunityShell;
