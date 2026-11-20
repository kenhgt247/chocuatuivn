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
export type HonorData = { ok: boolean; month: number; mode: 'thang' | 'tatca'; thanks: Thank[]; top: Top[]; mau?: boolean };
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
