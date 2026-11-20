/**
 * Khung giao diện chung của Chợ Của Tui (cộng đồng chia sẻ miễn phí).
 * Mọi trang dùng khung này: header có khu vực, thanh dưới 5 nút, chân trang.
 * Tận dụng lại: phòng chat cũ (đếm tin chưa đọc), menu thông báo cũ, lời mời cài app.
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import NotificationMenu from './NotificationMenu';
import AppNudge from './AppNudge';
import ChatDock from './ChatDock';
import { ThanksPrompt } from './Thanks';
import { FB_PAGE } from './FacebookCard';
import { setBigText } from '../utils/textSize';
import { db } from '../services/db';
import { getArea, setArea, onAreaChange, getRadius, setRadius, RADII, radiusText, shortArea } from '../utils/area';
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
  x: <path d="M18 6 6 18M6 6l12 12" />,
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

/** Dòng "📍 Tân Hưng · 5 km" trên header; bấm mở bảng chọn khu vực + bán kính. */
function AreaPicker({ user }: { user: User | null }) {
  const [area, setAreaState] = useState(() => getArea(user?.location || ''));
  const [radius, setRadiusState] = useState(getRadius);
  const [open, setOpen] = useState(false);
  useEffect(() => onAreaChange(() => { setAreaState(getArea(user?.location || '')); setRadiusState(getRadius()); }), [user?.location]);
  useEffect(() => { if (!getArea('') && user?.location) setAreaState(user.location); }, [user?.location]);
  useEffect(() => { const o = () => setOpen(true); window.addEventListener('ccut-open-area', o); return () => window.removeEventListener('ccut-open-area', o); }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open]);
  const pickR = (r: number) => { setRadius(r); setRadiusState(r); };
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-[14px] font-bold text-emerald-700 min-h-7 max-w-full" aria-haspopup="dialog">
        <Svg name="pin" className="w-4 h-4 shrink-0" />
        <span className="truncate max-w-[52vw] md:max-w-[260px]">{area ? shortArea(area) + ' · ' + radiusText(radius) : 'Chọn khu vực'}</span>
        <Svg name="down" className="w-4 h-4 shrink-0" />
      </button>
      {open && createPortal(<div className="fixed inset-0 z-[60] bg-ink/45 flex items-end md:items-center justify-center" onClick={() => setOpen(false)}>
        <div role="dialog" aria-modal="true" aria-label="Chọn khu vực xem tin" onClick={e => e.stopPropagation()}
          className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl px-4 pt-2.5 pb-[calc(20px+env(safe-area-inset-bottom))] flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
          <span className="self-center w-10 h-1.5 rounded-full bg-line md:hidden" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold">Xem tin quanh đâu?</h2>
            <button onClick={() => setOpen(false)} aria-label="Đóng" className="h-10 w-10 rounded-full grid place-items-center text-slate-600 text-xl">×</button>
          </div>
          <div className="relative h-36 rounded-2xl bg-[#E3ECE4] overflow-hidden" aria-hidden="true">
            <svg viewBox="0 0 358 144" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice"><path d="M0 40 C80 25 140 60 220 45 S320 20 358 32" stroke="#fff" strokeWidth="9" fill="none" /><path d="M60 0 C70 55 50 100 90 144" stroke="#fff" strokeWidth="7" fill="none" /><path d="M250 0 C240 60 280 105 260 144" stroke="#fff" strokeWidth="5" fill="none" />
              <circle cx="179" cy="72" r={({ 2: 24, 5: 40, 10: 54, 20: 66 } as Record<number, number>)[radius] || 0} fill="#1F6F43" fillOpacity="0.12" stroke="#1F6F43" strokeWidth="2" strokeDasharray="6 5" /><circle cx="179" cy="72" r="8" fill="#1F6F43" stroke="#fff" strokeWidth="3" /></svg>
            <span className="absolute left-3 bottom-3 bg-white rounded-full px-2.5 py-1 text-xs font-bold">{radius ? 'Vòng tròn = ' + radius + ' km' : 'Cả nước'}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="area-input" className="text-sm font-bold">Xã/phường của bạn</label>
            <AreaInput id="area-input" value={area} onPick={w => { setArea(w.label, { lat: w.lat, lng: w.lng }); setAreaState(w.label); }} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold">Bán kính</span>
            <div className="grid grid-cols-5 gap-1.5">{RADII.map(r => <button key={r} onClick={() => pickR(r)} aria-pressed={radius === r}
              className={'min-h-11 rounded-xl text-sm font-bold border ' + (radius === r ? 'border-2 border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-line bg-white')}>{radiusText(r)}</button>)}</div>
            <span className="text-xs text-slate-600">Ít tin trong vòng này thì tự hiện thêm tin xa hơn một chút.</span>
          </div>
          <button onClick={() => setOpen(false)} className="min-h-[52px] rounded-2xl bg-emerald-700 text-white text-base font-extrabold">{radius ? 'Xem tin trong ' + radius + ' km' : 'Xem tin cả nước'}</button>
        </div>
      </div>, document.body)}
    </>
  );
}

// Đang chạy bên trong khung tin nhắn nổi (ChatDock): chỉ hiện nội dung, không đầu trang/chân trang
export const isEmbedded = () => { try { return window.self !== window.top; } catch (_) { return true; } };

const CommunityShell: React.FC<{ user: User | null; children: React.ReactNode }> = ({ user, children }) => {
  if (isEmbedded()) return <div className="bg-cream min-h-screen text-ink px-4 pt-3 overflow-x-hidden">{children}<ThanksPrompt user={user} /></div>;
  return <ShellInner user={user}>{children}</ShellInner>;
};
const ShellInner: React.FC<{ user: User | null; children: React.ReactNode }> = ({ user, children }) => {
  const { pathname } = useLocation();
  const unread = useUnreadChats(user);
  // Trang chat cần chiều cao cố định, ẩn chân trang cho gọn
  const isChat = pathname.startsWith('/chat');
  // Trang có thanh nút cố định ở đáy (đăng tin, xem tin) trên điện thoại
  const hasActionBar = pathname.startsWith('/cong-dong/dang-tin') || pathname.startsWith('/cong-dong/tin/');


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
              <div className="h-11 w-11 rounded-full bg-white border border-line grid place-items-center"><NotificationMenu userId={user.id} /></div>
              <Link to="/chat" className="relative hidden md:grid place-items-center h-11 w-11 rounded-full bg-white border border-line text-slate-700" title="Tin nhắn">
                <span className="relative flex"><Svg name="chat" className="w-5 h-5" /><Badge n={unread} /></span>
              </Link>
              <Link to="/profile" className="hidden md:block" title="Cá nhân">
                {user.avatar ? <img src={user.avatar} alt="" className="h-11 w-11 rounded-full object-cover border border-line" /> : <span className="grid place-items-center h-11 w-11 rounded-full bg-emerald-50 text-emerald-800"><Svg name="user" className="w-5 h-5" /></span>}
              </Link>
            </> : pathname === '/login' || pathname === '/register' ? null : <Link to="/login" className="rounded-xl border border-emerald-700 text-emerald-800 bg-white px-4 h-11 flex items-center text-sm font-bold">Đăng nhập</Link>}
          </div>
        </div>
      </header>

      {user && !isChat && <ChatDock unread={unread} />}
      <AppNudge user={user} hidden={isChat || pathname === '/tai-ung-dung'} />
      <ThanksPrompt user={user} />

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
              ['/page/chinh-sach-bao-mat', 'Bảo mật'], ['/page/dieu-khoan', 'Điều khoản'], ['/tai-ung-dung', 'Tải ứng dụng']].map(([to, label]) =>
              <Link key={to} to={to} className="min-h-9 md:min-h-11 flex items-center hover:text-emerald-700">{label}</Link>)}
            <a href={FB_PAGE} target="_blank" rel="noopener noreferrer" className="min-h-9 md:min-h-11 flex items-center hover:text-emerald-700">Facebook</a>
            <button onClick={() => { const on = !document.documentElement.classList.contains('chu-to'); setBigText(on); }} className="min-h-9 md:min-h-11 flex items-center hover:text-emerald-700" aria-label="Bật/tắt chữ to">Aa Chữ to</button>
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

    </div>
  );
};

export default CommunityShell;
