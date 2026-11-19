/** Huy hiệu ghi nhận người chia sẻ nhiều (tính từ số lần trao xong, máy chủ cộng). */
import React from 'react';
import type { PublicProfile } from '../types';

export type Badge = { id: string; label: string; icon: string; tip: string };

export function badgesOf(p?: PublicProfile | null): Badge[] {
  if (!p) return [];
  const shared = p.sharedCount || 0;
  const by = (p as any).sharedByKind || {};
  const out: Badge[] = [];
  if (shared >= 1) out.push({ id: 'dau', label: 'Đã chia sẻ', icon: '🌱', tip: 'Đã trao xong ít nhất 1 lần' });
  if (shared >= 5) out.push({ id: 'tot', label: 'Hàng xóm tốt', icon: '🌿', tip: 'Đã chia sẻ xong 5 lần' });
  if (shared >= 20) out.push({ id: 'vang', label: 'Trái tim vàng', icon: '💛', tip: 'Đã chia sẻ xong 20 lần' });
  if ((by.repair || 0) >= 5) out.push({ id: 'sua', label: 'Thợ sửa giỏi', icon: '🛠️', tip: 'Đã sửa giúp 5 lần' });
  if ((by.help || 0) >= 5) out.push({ id: 'giup', label: 'Hay giúp đỡ', icon: '🤝', tip: 'Đã giúp 5 việc' });
  if ((by.borrow || 0) >= 5) out.push({ id: 'muon', label: 'Rộng rãi cho mượn', icon: '🔁', tip: 'Đã cho mượn 5 lần' });
  if ((by.gift || 0) >= 10) out.push({ id: 'tang', label: 'Hào phóng', icon: '🎁', tip: 'Đã cho tặng 10 lần' });
  return out;
}

/** Dãy biểu tượng nhỏ (thẻ người đăng). */
export function BadgeRow({ p }: { p?: PublicProfile | null }) {
  const b = badgesOf(p).filter(x => x.id !== 'dau').slice(-3);
  if (!b.length) return null;
  return <span className="flex gap-0.5 text-lg shrink-0" aria-label={b.map(x => x.label).join(', ')}>{b.map(x => <span key={x.id} title={x.label + ': ' + x.tip}>{x.icon}</span>)}</span>;
}

/** Danh sách đầy đủ (trang hồ sơ). */
export function BadgeList({ p }: { p?: PublicProfile | null }) {
  const b = badgesOf(p);
  if (!b.length) return null;
  return <div className="flex flex-wrap gap-2">{b.map(x =>
    <span key={x.id} title={x.tip} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-900 text-sm font-bold px-3 py-1.5">
      <span aria-hidden="true">{x.icon}</span>{x.label}</span>)}</div>;
}
