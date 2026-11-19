/** Bảng số liệu cho quản trị: tin mới, lần trao xong theo tuần; xã/phường sôi nổi nhất. */
import React, { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { firestore } from '../services/db';

const WEEKS = 8;
function weekStart(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function toDate(v: any): Date | null {
  try { const d = v?.toDate ? v.toDate() : v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d : null; } catch (_) { return null; }
}

export default function AdminStats() {
  const [rows, setRows] = useState<{ label: string; posts: number; done: number }[]>([]);
  const [wards, setWards] = useState<{ name: string; n: number }[]>([]);
  const [kinds, setKinds] = useState<Record<string, number>>({});
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const [ls, rq] = await Promise.all([
          // Chỉ sắp theo một trường rồi lọc tại máy → không cần tạo chỉ mục ghép.
          getDocs(query(collection(firestore, 'listings'), orderBy('createdAt', 'desc'), limit(1500))),
          getDocs(query(collection(firestore, 'communityRequests'), orderBy('updatedAt', 'desc'), limit(1500))),
        ]);
        const lsDocs = ls.docs.filter(d => (d.data() as any).isCommunityFree === true);
        const rqDocs = rq.docs.filter(d => (d.data() as any).status === 'completed');
        const now = weekStart(new Date());
        const buckets = Array.from({ length: WEEKS }, (_, i) => { const s = new Date(now); s.setDate(s.getDate() - 7 * (WEEKS - 1 - i)); return { s, posts: 0, done: 0 }; });
        const put = (d: Date | null, k: 'posts' | 'done') => {
          if (!d) return;
          for (let i = WEEKS - 1; i >= 0; i--) if (d >= buckets[i].s) { buckets[i][k]++; return; }
        };
        const byWard = new Map<string, number>();
        const month = Date.now() - 30 * 864e5;
        lsDocs.forEach(d => {
          const x: any = d.data(); const t = toDate(x.createdAt); put(t, 'posts');
          if (t && t.getTime() >= month) { const w = String(x.location || '').split(',')[0].trim(); if (w) byWard.set(w, (byWard.get(w) || 0) + 1); }
        });
        const kc: Record<string, number> = {};
        rqDocs.forEach(d => { const x: any = d.data(); put(toDate(x.updatedAt), 'done'); kc[x.kind] = (kc[x.kind] || 0) + 1; });
        setRows(buckets.map(b => ({ label: b.s.getDate() + '/' + (b.s.getMonth() + 1), posts: b.posts, done: b.done })));
        setWards([...byWard.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, n]) => ({ name, n })));
        setKinds(kc);
      } catch (e: any) {
        setErr(e?.code === 'failed-precondition' ? 'Chưa tải được số liệu (thiếu chỉ mục). Thử lại sau ít phút.' : (e?.message || 'Lỗi tải số liệu'));
      } finally { setLoading(false); }
    })();
  }, []);
  if (loading) return <p className="text-slate-600">Đang tính số liệu…</p>;
  if (err) return <p className="rounded-xl bg-rose-50 text-rose-800 p-3 text-sm">{err}</p>;
  const max = Math.max(1, ...rows.map(r => Math.max(r.posts, r.done)));
  const card = 'bg-white border border-line rounded-2xl p-5';
  return <div className="flex flex-col gap-4">
    <section className={card}>
      <h2 className="font-extrabold">8 tuần gần đây</h2>
      <div className="flex items-center gap-4 text-xs text-slate-600 mt-1">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-700" />Tin mới</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-sun" />Trao xong</span>
      </div>
      <div className="mt-4 grid grid-cols-8 gap-2 items-end h-44" role="img" aria-label="Biểu đồ tin mới và lần trao xong theo tuần">
        {rows.map(r => <div key={r.label} className="flex flex-col items-center gap-1 h-full justify-end">
          <div className="flex items-end gap-1 h-full w-full justify-center">
            <div className="w-1/3 bg-emerald-700 rounded-t" style={{ height: (r.posts / max) * 100 + '%' }} title={r.posts + ' tin mới'} />
            <div className="w-1/3 bg-sun rounded-t" style={{ height: (r.done / max) * 100 + '%' }} title={r.done + ' lần trao xong'} />
          </div>
          <span className="text-[10px] text-slate-500">{r.label}</span>
        </div>)}
      </div>
      <table className="w-full text-sm mt-4"><thead><tr className="text-left text-slate-500"><th className="font-semibold">Tuần bắt đầu</th><th className="font-semibold">Tin mới</th><th className="font-semibold">Trao xong</th></tr></thead>
        <tbody>{[...rows].reverse().slice(0, 4).map(r => <tr key={r.label} className="border-t border-line"><td className="py-1.5">{r.label}</td><td>{r.posts}</td><td>{r.done}</td></tr>)}</tbody></table>
    </section>
    <div className="grid md:grid-cols-2 gap-4">
      <section className={card}>
        <h2 className="font-extrabold mb-2">Xã/phường sôi nổi nhất (30 ngày)</h2>
        {!wards.length ? <p className="text-sm text-slate-600">Chưa có dữ liệu.</p>
          : <ol className="space-y-1.5">{wards.map((w, i) => <li key={w.name} className="flex justify-between text-sm"><span>{i + 1}. {w.name}</span><b>{w.n} tin</b></li>)}</ol>}
      </section>
      <section className={card}>
        <h2 className="font-extrabold mb-2">Trao xong theo hoạt động</h2>
        {[['gift', 'Cho tặng'], ['borrow', 'Mượn đồ'], ['help', 'Giúp nhau'], ['repair', 'Sửa đồ']].map(([k, l]) =>
          <div key={k} className="flex justify-between text-sm py-1 border-b border-line last:border-0"><span>{l}</span><b>{kinds[k] || 0}</b></div>)}
      </section>
    </div>
  </div>;
}
