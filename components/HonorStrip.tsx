/**
 * Vinh danh trên trang chủ:
 *  - ThanksTicker: một dòng "💚 Lời cảm ơn" chữ chạy ngang (dừng khi rê chuột/chạm).
 *  - NeighborsRow: hàng ảnh tròn nhỏ (điện thoại).
 *  - NeighborsList: bảng xếp hạng dạng danh sách (cột phải trên máy tính).
 * Dữ liệu từ /api/vinhdanh (công khai, lưu đệm), hoặc dữ liệu mẫu khi admin bật xem mẫu.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tinPath } from '../utils/format';

type Thank = { id: string; giverId: string; giverName: string; receiverName: string; receiverAvatar: string | null; message: string;
  listingId: string | null; listingTitle: string; photo: string | null; createdAt: string | null };
type Top = { id: string; n: number; name: string; avatar: string | null; location: string; sharedCount: number; sharedByKind: any };
export type HonorData = { ok: boolean; month: number; mode: 'thang' | 'tatca'; thanks: Thank[]; top: Top[]; mau?: boolean;
  stats?: { dang: number; xong: number; thanhVien: number; camOn: number } };
const KEY = 'ccut-vinhdanh';
const MEDAL = ['🥇', '🥈', '🥉'];
const Mau = () => <span className="ml-1.5 align-middle text-[10px] font-extrabold bg-sun text-[#2E1F00] px-1.5 py-0.5 rounded">MẪU</span>;

export function useHonor(sample: HonorData | null): HonorData | null {
  const [real, setReal] = useState<HonorData | null>(() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } });
  useEffect(() => {
    fetch('/api/vinhdanh').then(r => r.ok ? r.json() : null).then((x: HonorData | null) => {
      if (x && x.ok) { setReal(x); try { localStorage.setItem(KEY, JSON.stringify(x)); } catch (_) { /* đầy */ } }
    }).catch(() => {});
  }, []);
  return sample ? { ...sample, mau: true } : real;
}

const Avatar = ({ src, name, size }: { src: string | null; name: string; size: string }) => src
  ? <img src={src} alt="" loading="lazy" className={size + ' rounded-full object-cover bg-emerald-50 shrink-0'} />
  : <span className={size + ' rounded-full bg-emerald-700 text-white font-extrabold grid place-items-center shrink-0'}>{(name || '?').charAt(0).toUpperCase()}</span>;

export function ThanksTicker({ d }: { d: HonorData | null }) {
  if (!d || !d.thanks.length) return null;
  const one = (t: Thank, k: string) => {
    const text = <><b>{t.receiverName}</b> cảm ơn <b className="text-emerald-800">{t.giverName}</b>: <span className="text-[#3B4A40]">“{t.message}”</span></>;
    return <span key={k} className="shrink-0 flex items-center">
      {t.listingId && !d.mau ? <Link to={tinPath({ id: t.listingId, title: t.listingTitle })} className="hover:underline">{text}</Link> : <span>{text}</span>}
      <span className="text-[#C9C1AE] px-3" aria-hidden="true">•</span>
    </span>;
  };
  const moving = d.thanks.length > 1;
  const secs = Math.max(20, d.thanks.reduce((s, t) => s + t.message.length + 30, 0) / 6);
  return <div className="relative flex items-center h-11 rounded-2xl bg-emerald-50 border border-emerald-200 overflow-hidden" role="region" aria-label="Lời cảm ơn mới">
    <span className="shrink-0 h-full flex items-center pl-3 pr-2 text-[13px] font-extrabold text-emerald-800 bg-emerald-50 z-10">💚 Lời cảm ơn{d.mau && <Mau />}</span>
    <div className="ccut-chay-khung flex-1 h-full flex items-center overflow-hidden text-[13px] whitespace-nowrap" tabIndex={0}>
      {moving
        ? <div className="ccut-chay" style={{ ['--ccut-time' as any]: secs + 's' }}>{d.thanks.map(t => one(t, 'a' + t.id))}<span aria-hidden="true" className="flex">{d.thanks.map(t => one(t, 'b' + t.id))}</span></div>
        : <div className="flex">{one(d.thanks[0], 'x')}</div>}
    </div>
    <span className="pointer-events-none absolute right-0 inset-y-0 w-10 bg-gradient-to-l from-emerald-50" aria-hidden="true" />
  </div>;
}

function title(d: HonorData) { return d.mode === 'thang' ? 'Hàng xóm nổi bật tháng ' + d.month : 'Hàng xóm chia sẻ nhiều nhất'; }
const countText = (d: HonorData, p: Top) => d.mode === 'thang' ? p.n + ' lời cảm ơn' + (d.mau ? '' : ' tháng này') : 'Chia sẻ ' + p.n + ' lần';

export function NeighborsRow({ d }: { d: HonorData | null }) {
  if (!d || !d.top.length) return null;
  return <section className="flex flex-col gap-2">
    <h2 className="text-[15px] font-extrabold">{title(d)} 🏅{d.mau && <Mau />}</h2>
    <div className="flex gap-3 overflow-x-auto -mx-4 px-4 py-1">
      {d.top.map((p, i) => <Link key={p.id} to={d.mau ? '#' : '/profile/' + p.id} className="shrink-0 w-16 flex flex-col items-center gap-1 text-center">
        <span className="relative rounded-full ring-2 ring-sun ring-offset-2 ring-offset-cream">
          <Avatar src={p.avatar} name={p.name} size="h-[52px] w-[52px]" />
          {i < 3 && <span className="absolute -right-1.5 -bottom-1.5 text-[15px] leading-none">{MEDAL[i]}</span>}
        </span>
        <span className="text-[11px] font-bold leading-tight line-clamp-2 mt-1">{p.name}</span>
        <span className="text-[10px] text-slate-600">💚 {p.n}</span>
      </Link>)}
    </div>
  </section>;
}

export function NeighborsList({ d }: { d: HonorData | null }) {
  if (!d || !d.top.length) return null;
  return <section className="bg-white border border-line rounded-2xl px-4 py-3.5 flex flex-col">
    <h2 className="font-extrabold mb-1">{title(d)} 🏅{d.mau && <Mau />}</h2>
    {d.top.map((p, i) => <Link key={p.id} to={d.mau ? '#' : '/profile/' + p.id} className={'flex items-center gap-2.5 py-2 hover:bg-cream rounded-lg ' + (i ? 'border-t border-[#F1ECDF]' : '')}>
      <span className="w-6 text-center text-[15px]">{MEDAL[i] || i + 1}</span>
      <Avatar src={p.avatar} name={p.name} size="h-9 w-9" />
      <span className="flex-1 min-w-0 flex flex-col"><span className="text-sm font-bold truncate">{p.name}</span><span className="text-xs text-slate-600 truncate">💚 {countText(d, p)}{p.location ? ' · ' + p.location : ''}</span></span>
    </Link>)}
  </section>;
}

/* ---------- Trang chủ bản 3 ---------- */

/** 🏆 Vinh danh người cho đi: hàng ảnh tròn (cuối cột chính trên máy tính, gần cuối trang trên điện thoại). */
export function HonorCircles({ d }: { d: HonorData | null }) {
  if (!d || !d.top.length) return null;
  return <section className="rounded-3xl bg-emerald-50 px-4 py-4 lg:px-6 lg:py-5 flex flex-col gap-3" aria-label="Vinh danh người cho đi">
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <h2 className="text-lg lg:text-xl font-extrabold">🏆 Vinh danh người cho đi{d.mau && <Mau />}</h2>
      <span className="text-xs lg:text-[13px] text-slate-600">{d.mode === 'thang' ? 'Được cảm ơn nhiều nhất tháng ' + d.month : 'Chia sẻ nhiều nhất từ trước tới nay'}</span>
    </div>
    <div className="flex gap-2 lg:gap-3 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 py-1.5 lg:justify-between">
      {d.top.slice(0, 7).map((p, i) => <Link key={p.id} to={d.mau ? '#' : '/profile/' + p.id} className="shrink-0 w-[76px] lg:w-[92px] flex flex-col items-center gap-1.5 text-center">
        <span className={'relative rounded-full ring-[3px] ring-offset-2 ring-offset-emerald-50 ' + (i < 3 ? 'ring-sun' : 'ring-emerald-200')}>
          <Avatar src={p.avatar} name={p.name} size="h-[58px] w-[58px] lg:h-[72px] lg:w-[72px] text-xl lg:text-2xl" />
          {i < 3 && <span className="absolute -right-1.5 -bottom-1.5 text-lg lg:text-xl leading-none">{MEDAL[i]}</span>}
        </span>
        <span className="text-[13px] font-bold leading-tight line-clamp-2 mt-1">{p.name}</span>
        <span className="text-[11px] lg:text-xs text-slate-600">{d.mode === 'thang' ? '💚 ' + p.n + ' lời cảm ơn' : p.n + ' lần cho'}</span>
      </Link>)}
    </div>
  </section>;
}

/** 💚 Lời cảm ơn mới: người nhận → người cho (cột phải trên máy tính, dưới vinh danh trên điện thoại). */
export function ThanksBox({ d, max = 4 }: { d: HonorData | null; max?: number }) {
  if (!d || !d.thanks.length) return null;
  return <section className="rounded-2xl bg-[#FBF3E4] border border-[#F2DDB0] px-4 py-3.5 flex flex-col" aria-label="Lời cảm ơn mới">
    <h2 className="font-extrabold text-[17px] mb-1">💚 Lời cảm ơn mới{d.mau && <Mau />}</h2>
    {d.thanks.slice(0, max).map((t, i) => {
      const body = <>
        <Avatar src={t.receiverAvatar} name={t.receiverName} size="h-10 w-10 !bg-[#FCEFD2] !text-[#7A4B00]" />
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-sm font-bold truncate">{t.receiverName} → <span className="text-emerald-800">{t.giverName}</span></span>
          <span className="text-[13px] text-[#3B4A40] line-clamp-2">“{t.message}”</span>
        </span>
        <span className="text-rose-500 shrink-0" aria-hidden="true">♥</span></>;
      const cls = 'flex items-center gap-3 py-2.5 ' + (i ? 'border-t border-[#F1E3C4]' : '');
      return t.listingId && !d.mau ? <Link key={t.id} to={tinPath({ id: t.listingId, title: t.listingTitle })} className={cls + ' hover:opacity-90'}>{body}</Link> : <div key={t.id} className={cls}>{body}</div>;
    })}
  </section>;
}

/** Cộng đồng Chợ Của Tui: chỉ hiện số thật, số nào bằng 0 thì ẩn. */
export function StatsBox({ d }: { d: HonorData | null }) {
  const s = d?.stats;
  const rows = s ? ([[s.thanhVien, 'thành viên', 'text-emerald-700'], [s.dang, 'tin đang chia sẻ', 'text-emerald-700'], [s.xong, 'lần đã trao', 'text-orange-700']] as [number, string, string][]).filter(r => r[0] > 0) : [];
  if (!rows.length) return null;
  return <section className="bg-white border border-line rounded-2xl px-4 py-3.5 flex flex-col gap-3">
    <h2 className="font-extrabold text-[17px]">Cộng đồng Chợ Của Tui{d?.mau && <Mau />}</h2>
    <div className="grid text-center" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
      {rows.map(([n, l, c], i) => <div key={l} className={'flex flex-col gap-0.5 px-1 ' + (i ? 'border-l border-[#F1ECDF]' : '')}>
        <b className={'text-xl ' + c}>{n.toLocaleString('vi-VN')}</b><span className="text-xs text-slate-600 leading-tight">{l}</span></div>)}
    </div>
  </section>;
}
