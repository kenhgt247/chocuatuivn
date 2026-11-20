/**
 * Trang chủ bản 3: hình minh hoạ đầu trang, thẻ tin dạng mới, băng rôn cuối cột phải.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { KIcon, KIND_META, kindText } from './CommunityUI';
import type { CommunityKind, CommunityListing } from '../services/community';
import { formatTimeAgo, tinPath, thumbOf } from '../utils/format';

/** Cảnh xóm nhỏ: nhà, cây, trái tim. Vẽ bằng SVG, không cần ảnh. */
export function HeroScene({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 560 240" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
    <circle cx="470" cy="60" r="34" fill="#F2D06B" opacity="0.6" />
    <path d="M0 200 C120 170 260 190 380 175 S520 160 560 170 V240 H0Z" fill="#CFE5D3" />
    <path d="M200 240 C300 200 420 215 560 200 V240Z" fill="#B7D8BE" />
    <g transform="translate(330 120)"><rect x="0" y="40" width="90" height="70" rx="4" fill="#FFFFFF" /><path d="M-8 44 L45 4 L98 44Z" fill="#E07A5F" /><rect x="34" y="70" width="22" height="40" rx="3" fill="#C9A27A" /><rect x="10" y="56" width="16" height="16" rx="2" fill="#BFDDE6" /><rect x="64" y="56" width="16" height="16" rx="2" fill="#BFDDE6" /></g>
    <g transform="translate(445 135)"><rect x="0" y="30" width="70" height="60" rx="4" fill="#FBF3E4" /><path d="M-6 34 L35 2 L76 34Z" fill="#F2B33D" /><rect x="26" y="56" width="18" height="34" rx="3" fill="#C9A27A" /></g>
    <g fill="#1F6F43"><circle cx="300" cy="170" r="26" /><rect x="297" y="180" width="6" height="40" fill="#8A6A4A" /><circle cx="540" cy="150" r="22" /><rect x="537" y="160" width="6" height="40" fill="#8A6A4A" /></g>
    <path d="M392 104 c0-8 12-10 14-2 c2-8 14-6 14 2 c0 8-14 16-14 16 s-14-8-14-16z" fill="#E5484D" />
  </svg>;
}

/** Băng rôn "Cùng nhau xây dựng…". */
export function CommunityBanner({ tall = false }: { tall?: boolean }) {
  return <section className={'relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#E3EEE6] to-[#CFE5D3] ' + (tall ? 'h-[210px]' : 'h-[118px]')}>
    <HeroScene className="absolute inset-0 w-full h-full" />
    <div className="relative px-5 py-4 flex flex-col gap-2">
      {tall && <KIcon name="gift" className="w-7 h-7 text-emerald-700" />}
      <p className="font-extrabold text-[17px] leading-snug text-[#123524]">Cùng nhau xây dựng<br />một cộng đồng sẻ chia,<br />ấm áp hơn!</p>
    </div>
  </section>;
}

const badgeText = (kind: CommunityKind, intent?: string) => intent === 'need' ? 'ĐANG CẦN' : kindText(kind, 'have').toUpperCase();

/**
 * Thẻ tin trang chủ. Điện thoại: gọn (ảnh, nhãn, tên, khoảng cách, giờ, tim).
 * Máy tính: thêm 2 dòng mô tả, người đăng và nút "Liên hệ".
 */
export function FeedCard({ item, km, eager, saved, onSave }: { item: CommunityListing; km: string; eager?: boolean; saved: boolean; onSave: (id: string) => void; key?: React.Key }) {
  const kind = (item.communityKind || 'gift') as CommunityKind;
  const img = thumbOf(item);
  const need = item.communityIntent === 'need';
  const place = (item.location || '').split(',')[0];
  const who = (item as any).sellerName || '';
  const avatar = (item as any).sellerAvatar || '';
  const to = tinPath(item);
  const heartIcon = (cls: string) => <svg className={cls + ' ' + (saved ? 'text-rose-500' : 'text-ink')} viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" /></svg>;
  // Thẻ là khung; liên kết mở tin và nút lưu tin là hai phần tách riêng (không lồng nút trong liên kết)
  return <article className="group relative flex flex-col bg-white rounded-2xl overflow-hidden border border-line hover:shadow-md transition-shadow">
    <Link to={to} className="flex flex-col flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 rounded-2xl">
    <span className="relative block">
      {img
        ? <img src={img} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" {...(eager ? { fetchpriority: 'high' } as any : {})} width={480} height={360} className="h-[124px] lg:h-[150px] w-full object-cover bg-[#ECE5D4]" />
        : <span className={'h-[124px] lg:h-[150px] grid place-items-center text-emerald-700 ' + KIND_META[kind].tint}><KIcon name={kind} className="w-11 h-11" strokeWidth={1.6} /></span>}
      <span className={'absolute left-2 bottom-2 lg:bottom-auto lg:top-2.5 lg:left-2.5 text-[11px] lg:text-xs font-extrabold px-2 lg:px-2.5 py-1 rounded-full lg:rounded-lg flex items-center gap-1 ' +
        (need ? 'bg-sun text-[#2E1F00]' : 'bg-emerald-700 text-white')}>
        <KIcon name={need ? 'hand' : kind} className="w-3.5 h-3.5 lg:hidden" />{badgeText(kind, item.communityIntent)}
      </span>
      {(item as any)._mau && <span className="absolute top-2 left-2 lg:top-auto lg:bottom-2.5 text-[10px] font-extrabold bg-sun text-[#2E1F00] px-1.5 py-0.5 rounded">MẪU</span>}
    </span>
    <span className="p-3 lg:px-3.5 lg:pb-3.5 flex flex-col gap-1.5 flex-1">
      <span className="text-[15px] lg:text-base font-bold leading-snug line-clamp-2">{item.title}</span>
      {item.description && <span className="hidden lg:block text-[13px] text-[#3B4A40] leading-snug line-clamp-2">{item.description}</span>}
      <span className="text-xs text-slate-600 flex items-center gap-1 min-w-0"><KIcon name="pin" className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{km && <b className="text-emerald-700">{km} · </b>}{place}</span></span>
      <span className="text-xs text-slate-600 flex items-center gap-1 pr-8 lg:pr-0"><KIcon name="clock" className="w-3.5 h-3.5" />{item.createdAt ? formatTimeAgo(String(item.createdAt)) : ''}</span>
      <span className="hidden lg:flex items-center justify-between gap-2 mt-auto pt-1.5">
        <span className="flex items-center gap-2 min-w-0 text-[13px] font-bold">
          {avatar ? <img src={avatar} alt="" loading="lazy" className="h-7 w-7 rounded-full object-cover shrink-0" />
            : <span className="h-7 w-7 rounded-full bg-emerald-50 text-emerald-800 grid place-items-center text-xs font-extrabold shrink-0">{(who || '?').charAt(0).toUpperCase()}</span>}
          <span className="truncate">{who || 'Hàng xóm'}</span>
        </span>
        <span aria-hidden="true"
          className="shrink-0 h-8 px-3 rounded-full border-[1.5px] border-emerald-700 text-emerald-700 text-[13px] font-extrabold flex items-center gap-1.5 group-hover:bg-emerald-50">
          <KIcon name="chat" className="w-3.5 h-3.5" />Liên hệ</span>
      </span>
    </span>
    </Link>
    {/* Nút lưu tin: điện thoại ở góc dưới phải thẻ, máy tính ở góc trên phải ảnh */}
    <button type="button" onClick={() => onSave(item.id)} aria-label={(saved ? 'Bỏ lưu tin: ' : 'Lưu tin: ') + item.title} aria-pressed={saved}
      className="absolute right-1 bottom-1 h-10 w-10 grid place-items-center rounded-full lg:right-2 lg:top-2 lg:bottom-auto lg:h-9 lg:w-9 lg:bg-white/95 lg:shadow-sm lg:hover:scale-105">
      {heartIcon('w-[18px] h-[18px] lg:w-5 lg:h-5')}
    </button>
  </article>;
}
