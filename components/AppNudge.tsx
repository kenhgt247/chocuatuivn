/**
 * Một ô gợi ý duy nhất: "Cài về màn hình chính" hoặc "Bật thông báo".
 *
 * Không làm phiền:
 * - Đã cài / đang mở từ biểu tượng → không mời cài nữa.
 * - Đã cho phép thông báo → không mời bật nữa.
 * - iPhone: Safari và ứng dụng ở màn hình chính không dùng chung bộ nhớ, nên khi mở từ biểu tượng
 *   mình ghi "đã cài" vào tài khoản; vào lại bằng Safari sẽ không bị mời cài nữa.
 * - Lần đầu vào web: không hiện gì. Từ lần sau mới hiện, mỗi ngày tối đa một lần.
 * - Bấm "Để sau": chờ 1 ngày, rồi 3, 7, 30 ngày cho các lần sau.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getFirestore, updateDoc } from 'firebase/firestore';
import { db } from '../services/db';
import type { User } from '../types';

const DAY = 864e5;
const BACKOFF = [1, 3, 7, 30];
const K = { visits: 'ccut-visits', next: 'ccut-nudge-next', level: 'ccut-nudge-level', session: 'ccut-session', shown: 'ccut-nudge-shown' };

function ls(key: string, val?: string) {
  try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (_) { /* bỏ qua */ }
  return null;
}
function ss(key: string, val?: string) {
  try { if (val === undefined) return sessionStorage.getItem(key); sessionStorage.setItem(key, val); } catch (_) { /* bỏ qua */ }
  return null;
}
/** Đếm số lần truy cập (mỗi phiên mở web tính một lần). */
function countVisit(): number {
  let n = Number(ls(K.visits) || 0);
  if (!ss(K.session)) { n += 1; ls(K.visits, String(n)); ss(K.session, '1'); }
  return n;
}
export const isStandalone = () =>
  (navigator as any).standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;
const isAndroid = () => /android/i.test(navigator.userAgent);
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

type Kind = 'ios-install' | 'android-app' | 'install' | 'push' | 'push-denied';

const AppNudge: React.FC<{ user: User | null; hidden?: boolean }> = ({ user, hidden }) => {
  const [kind, setKind] = useState<Kind | null>(null);
  const [deferred, setDeferred] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [tick, setTick] = useState(0);

  // Mở từ biểu tượng khi đã đăng nhập: ghi nhận "đã cài" vào tài khoản (một lần)
  useEffect(() => {
    if (!user || !isStandalone() || (user as any).appInstalled) return;
    updateDoc(doc(getFirestore(), 'users', user.id), { appInstalled: true }).catch(() => {});
  }, [user?.id]);

  // Android/máy tính: trình duyệt chỉ phát sự kiện này khi CHƯA cài
  useEffect(() => {
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e); setTick(t => t + 1); };
    const onInstalled = () => { setDeferred(null); setKind(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  useEffect(() => {
    const visits = countVisit();
    const t = setTimeout(() => {
      const pushSupported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
      const perm = pushSupported ? Notification.permission : 'unsupported';
      const installed = isStandalone() || !!(user as any)?.appInstalled;
      const hasPush = Array.isArray((user as any)?.fcmTokens) && (user as any).fcmTokens.length > 0;

      // Việc nên mời, theo thứ tự quan trọng
      let want: Kind | null = null;
      if (user && perm === 'default') want = 'push';
      else if (isIOS() && !installed && !hasPush) want = 'ios-install';     // iPhone phải cài mới nhận được thông báo
      else if (isAndroid() && !installed) want = 'android-app';           // Android: mời tải ứng dụng
      else if (deferred && !installed) want = 'install';
      else if (user && perm === 'denied' && !hasPush) want = 'push-denied';

      if (!want) { setKind(null); return; }
      // Đã hiện trong phiên này thì giữ nguyên cho đến khi đóng
      if (ss(K.shown) === want) { setKind(want); return; }
      const next = Number(ls(K.next) || 0);
      if (visits < 2 || Date.now() < next) { setKind(null); return; }
      ss(K.shown, want);
      ls(K.next, String(Date.now() + DAY)); // tối đa mỗi ngày một lần
      setKind(want);
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tick]);

  const later = () => {
    const lv = Math.min(Number(ls(K.level) || 0), BACKOFF.length - 1);
    ls(K.level, String(lv + 1));
    ls(K.next, String(Date.now() + BACKOFF[lv] * DAY));
    ss(K.shown, '');
    setKind(null);
  };
  const done = () => { ls(K.level, '0'); ss(K.shown, ''); setTimeout(() => { setKind(null); setMsg(''); }, 2500); };

  async function enablePush() {
    if (!user) return;
    setBusy(true);
    try {
      const token = await db.requestNotificationPermission(user.id);
      if (token) { setMsg('Đã bật thông báo trên thiết bị này.'); done(); }
      else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') setKind('push-denied');
      else setMsg('Chưa bật được. Bạn thử lại sau nhé.');
    } catch (_) { setMsg('Thiết bị này chưa hỗ trợ thông báo.'); }
    finally { setBusy(false); }
  }
  async function install() {
    if (!deferred) return;
    setBusy(true);
    deferred.prompt();
    const { outcome } = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' }));
    setBusy(false); setDeferred(null);
    if (outcome === 'accepted') { setMsg('Đã cài Chợ Của Tui.'); done(); } else later();
  }

  if (!kind || hidden) return null;
  const text: Record<Kind, [string, React.ReactNode]> = {
    'push': ['Biết ngay khi có người nhắn', 'Bật thông báo để không lỡ tin nhắn và yêu cầu mới.'],
    'push-denied': ['Thông báo đang bị chặn', <>Vào <b>Cài đặt</b> của điện thoại hoặc trình duyệt → Thông báo → cho phép <b>chocuatui.vn</b>.</>],
    'ios-install': ['Thêm Chợ Của Tui vào màn hình chính', <>Bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên) ở Safari → <b>Thêm vào Màn hình chính</b>. Mở từ biểu tượng đó để nhận thông báo.</>],
    'install': ['Cài Chợ Của Tui lên máy', 'Mở nhanh như ứng dụng, không tốn dung lượng.'],
    'android-app': ['Có ứng dụng Chợ Của Tui cho Android', 'Nhẹ khoảng 1–2 MB, mở nhanh, nhận thông báo khi có người nhắn.'],
  };
  const [title, body] = text[kind];
  return <div className="max-w-6xl mx-auto px-4 md:px-5 pt-3" role="region" aria-label="Gợi ý">
    <div className="flex gap-3 items-start bg-white border border-line rounded-2xl p-3.5 shadow-sm md:max-w-xl">
      <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-bold">{title}</p>
        {msg ? <p className="text-emerald-800 mt-0.5">{msg}</p> : <p className="text-slate-600 mt-0.5 leading-snug">{body}</p>}
        {!msg && kind === 'android-app' && <div className="flex items-center gap-2 mt-2">
          <Link to="/tai-ung-dung" onClick={() => ss(K.shown, '')} className="h-10 px-4 rounded-full bg-emerald-700 text-white font-bold inline-flex items-center">Tải ứng dụng</Link>
          <button onClick={later} className="h-10 px-3 rounded-full font-semibold text-slate-600">Để sau</button>
        </div>}
        {!msg && (kind === 'push' || kind === 'install') && <div className="flex items-center gap-2 mt-2">
          <button onClick={kind === 'push' ? enablePush : install} disabled={busy} className="h-10 px-4 rounded-full bg-emerald-700 text-white font-bold disabled:opacity-60">
            {busy ? 'Đang xử lý…' : kind === 'push' ? 'Bật thông báo' : 'Cài đặt'}
          </button>
          <button onClick={later} className="h-10 px-3 rounded-full font-semibold text-slate-600">Để sau</button>
        </div>}
      </div>
      <button onClick={later} aria-label="Để sau" className="h-8 w-8 -mr-1 -mt-1 grid place-items-center rounded-full text-slate-500 hover:bg-cream">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  </div>;
};

export default AppNudge;
