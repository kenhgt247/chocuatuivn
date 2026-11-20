/** Trang chủ: "Lời cảm ơn mới" (trượt ngang) và "Hàng xóm nổi bật" (vinh danh người cho). */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTimeAgo, tinPath } from '../utils/format';

type Thank = { id: string; giverId: string; giverName: string; receiverName: string; receiverAvatar: string | null; message: string;
  listingId: string | null; listingTitle: string; photo: string | null; createdAt: string | null };
type Top = { id: string; n: number; name: string; avatar: string | null; location: string; sharedCount: number; sharedByKind: any };
type Data = { ok: boolean; month: number; mode: 'thang' | 'tatca'; thanks: Thank[]; top: Top[] };
const KEY = 'ccut-vinhdanh';

const Avatar = ({ src, name, size }: { src: string | null; name: string; size: string }) => src
  ? <img src={src} alt="" loading="lazy" className={size + ' rounded-full object-cover bg-emerald-50 shrink-0'} />
  : <span className={size + ' rounded-full bg-emerald-700 text-white font-extrabold grid place-items-center shrink-0'}>{(name || '?').charAt(0).toUpperCase()}</span>;

export default function HonorStrip() {
  const [d, setD] = useState<Data | null>(() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } });
  useEffect(() => {
    fetch('/api/vinhdanh').then(r => r.ok ? r.json() : null).then((x: Data | null) => {
      if (x && x.ok) { setD(x); try { localStorage.setItem(KEY, JSON.stringify(x)); } catch (_) { /* đầy */ } }
    }).catch(() => {});
  }, []);
  if (!d || (!d.thanks.length && !d.top.length)) return null;
  return <div className="flex flex-col gap-4 my-2">
    {d.thanks.length > 0 && <section className="flex flex-col gap-2.5">
      <h2 className="text-lg font-extrabold">Lời cảm ơn mới 💚</h2>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 pb-1">
        {d.thanks.map(t => <article key={t.id} className="snap-start shrink-0 w-[min(300px,82vw)] bg-white border-2 border-emerald-200 rounded-2xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <Avatar src={t.receiverAvatar} name={t.receiverName} size="h-9 w-9" />
            <p className="text-[13px] leading-snug min-w-0"><b>{t.receiverName}</b> cảm ơn <Link to={'/profile/' + t.giverId} className="font-bold text-emerald-800">{t.giverName}</Link>
              {t.createdAt && <span className="block text-[11px] text-slate-500">{formatTimeAgo(t.createdAt)}</span>}</p>
          </div>
          <div className="h-px bg-emerald-100" />
          <div className="flex gap-2.5">
            <p className="flex-1 text-[15px] leading-snug line-clamp-3">“{t.message}”</p>
            {t.photo && <img src={t.photo} alt="" loading="lazy" className="h-16 w-16 rounded-xl object-cover shrink-0" />}
          </div>
          {t.listingId && <Link to={tinPath({ id: t.listingId, title: t.listingTitle })} className="text-xs text-slate-600 truncate underline-offset-2 hover:underline">Món: {t.listingTitle}</Link>}
        </article>)}
      </div>
    </section>}
    {d.top.length > 0 && <section className="flex flex-col gap-2.5">
      <h2 className="text-lg font-extrabold">{d.mode === 'thang' ? 'Hàng xóm nổi bật tháng ' + d.month : 'Hàng xóm chia sẻ nhiều nhất'} 🏅</h2>
      <div className="flex gap-2.5 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-1">
        {d.top.map((p, i) => <Link key={p.id} to={'/profile/' + p.id} className="shrink-0 w-[148px] bg-white border border-line rounded-2xl p-3 flex flex-col items-center text-center gap-1 hover:shadow-md">
          <span className="relative">
            <Avatar src={p.avatar} name={p.name} size="h-14 w-14" />
            {i < 3 && <span className="absolute -bottom-1 -right-1 text-base leading-none" aria-label={'Hạng ' + (i + 1)}>{['🥇', '🥈', '🥉'][i]}</span>}
          </span>
          <span className="font-extrabold text-sm leading-tight truncate max-w-full mt-1">{p.name}</span>
          <span className="text-[11px] text-emerald-800 font-bold">{d.mode === 'thang' ? p.n + ' lời cảm ơn' : 'Chia sẻ ' + p.n + ' lần'}</span>
          {p.location && <span className="text-[11px] text-slate-500 truncate max-w-full">{p.location}</span>}
        </Link>)}
      </div>
    </section>}
  </div>;
}
