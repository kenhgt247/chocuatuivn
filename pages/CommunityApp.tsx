/**
 * Chợ Của Tui — các trang cộng đồng: Khám phá, Đăng tin, Chi tiết tin, Yêu cầu, Đã lưu.
 * Thiết kế: nền kem, xanh lá đậm, vàng nắng; hai nút chính "Tôi có" / "Tôi cần".
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import ShareModal from '../components/ShareModal';
import { db } from '../services/db';
import {
  community, kindLabels, statusLabels, MAX_PHOTOS, safetyNotes,
  type CommunityKind, type CommunityIntent, type CommunityListing, type CommunityRequest
} from '../services/community';
import { KIcon, KIND_META, kindText, IntentBadge, Steps, RequestActions, SafetyBox, VoiceButton } from '../components/CommunityUI';
import { getArea, getAreaPoint, onAreaChange, sameArea } from '../utils/area';
import { AreaInput } from '../components/AreaInput';
import { wardFromLabel } from '../utils/dvhc';
import { formatTimeAgo, tinPath } from '../utils/format';
import type { User, PublicProfile } from '../types';

const KINDS: CommunityKind[] = ['gift', 'borrow', 'help', 'repair'];
const MEET_PLACES = ['Cổng chợ', 'Cổng trường', 'Nhà văn hoá', 'UBND phường/xã', 'Gửi tiệm tạp hoá', 'Tại nhà'];

const btnPrimary = 'min-h-12 rounded-2xl px-5 font-bold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60';
const btnLight = 'min-h-12 rounded-2xl px-5 font-bold bg-white border border-line text-ink hover:bg-cream';
const inputCls = 'w-full min-h-12 rounded-[14px] border border-[#C9C1AE] bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-600';

function ErrorMessage({ message }: { message: string }) {
  return <p role="alert" className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">{message}</p>;
}
function AuthRequired() {
  return <div className="max-w-md mx-auto rounded-3xl bg-white border border-line p-8 text-center">
    <img src="/icons/icon-192.png" alt="" className="h-14 w-14 rounded-2xl mx-auto" />
    <h1 className="text-2xl font-extrabold mt-4">Đăng nhập để tiếp tục</h1>
    <p className="text-slate-600 mt-2">Xem tin không cần tài khoản. Chỉ đăng tin và liên hệ mới cần đăng nhập.</p>
    <Link className={btnPrimary + ' inline-flex items-center mt-5'} to="/login">Đăng nhập miễn phí</Link>
  </div>;
}

function useArea(user?: User | null) {
  const [area, setArea] = useState(() => getArea(user?.location || ''));
  useEffect(() => onAreaChange(() => setArea(getArea(user?.location || ''))), [user?.location]);
  useEffect(() => { if (!getArea('') && user?.location) setArea(user.location); }, [user?.location]);
  return area;
}
function metaLine(item: CommunityListing, area: string) {
  const where = sameArea(item.location, area) ? 'Cùng khu vực' : (item.location || '').split(',')[0];
  const when = item.createdAt ? formatTimeAgo(String(item.createdAt)) : '';
  return [where, when].filter(Boolean).join(' · ');
}

/* ---------------- Thẻ tin ---------------- */
function Card({ item, area = '' }: { item: CommunityListing; area?: string; key?: React.Key }) {
  const kind = (item.communityKind || 'gift') as CommunityKind;
  return <Link to={tinPath(item)} className="flex flex-col bg-white rounded-2xl overflow-hidden border border-line hover:shadow-md transition-shadow">
    {item.images?.[0]
      ? <img src={item.images[0]} alt="" loading="lazy" className="h-[108px] sm:h-40 w-full object-cover" />
      : <div className={'h-[108px] sm:h-40 grid place-items-center text-emerald-700 ' + KIND_META[kind].tint}><KIcon name={kind} className="w-11 h-11" strokeWidth={1.6} /></div>}
    <div className="p-3 flex flex-col gap-1.5">
      <IntentBadge kind={kind} intent={item.communityIntent} className="self-start" />
      <span className="text-[15px] font-bold leading-snug line-clamp-2">{item.title}</span>
      <span className="text-xs text-slate-600 truncate">{metaLine(item, area)}</span>
    </div>
  </Link>;
}
export { Card };

/* ---------------- Khám phá ---------------- */
function Home({ user }: { user: User | null }) {
  const [items, setItems] = useState<CommunityListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<CommunityKind | 'all'>('all');
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
  const [map, setMap] = useState(false);
  const area = useArea(user);
  useEffect(() => {
    let alive = true;
    community.list().then(r => { if (alive) setItems(r); })
      .catch(e => { if (alive) setError(e?.message || 'Không tải được tin'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter(it => (kind === 'all' || it.communityKind === kind) &&
      (!q || [it.title, it.description, it.location].join(' ').toLowerCase().includes(q)));
    // Tin cùng khu vực lên trước, sau đó tới tin mới nhất
    return area ? [...list].sort((a, b) => Number(sameArea(b.location, area)) - Number(sameArea(a.location, area))) : list;
  }, [items, kind, search, area]);
  const near = area ? filtered.filter(x => sameArea(x.location, area)).length : 0;
  const mapped = filtered.map(x => ({ ...x, lat: x.lat == null ? null : Math.round(x.lat * 100) / 100, lng: x.lng == null ? null : Math.round(x.lng * 100) / 100 }));
  const first = mapped.find(x => x.lat != null && x.lng != null);
  const center: [number, number] = first?.lat != null && first?.lng != null ? [first.lat, first.lng] : [21.0, 105.85];

  return <div className="flex flex-col gap-4">
    <h1 className="text-2xl md:text-4xl font-extrabold leading-tight">Có gì chia sẻ,<br />cần gì có nhau.</h1>
    <div className="grid grid-cols-2 gap-3">
      <Link to="/cong-dong/dang-tin?y=co" className="flex flex-col gap-1 p-4 md:p-6 rounded-[20px] bg-emerald-700 hover:bg-emerald-800 text-white">
        <span className="text-[22px] md:text-3xl font-extrabold">Tôi có</span>
        <span className="text-[13px] md:text-base leading-snug text-emerald-100">Cho, cho mượn, giúp một tay</span>
      </Link>
      <Link to="/cong-dong/dang-tin?y=can" className="flex flex-col gap-1 p-4 md:p-6 rounded-[20px] bg-sun hover:brightness-95 text-[#2E1F00]">
        <span className="text-[22px] md:text-3xl font-extrabold">Tôi cần</span>
        <span className="text-[13px] md:text-base leading-snug text-[#4A3200]">Xin, mượn, nhờ giúp đỡ</span>
      </Link>
    </div>
    <div className="grid grid-cols-4 gap-2" role="group" aria-label="Lọc theo hoạt động">
      {KINDS.map(k => <button key={k} onClick={() => setKind(kind === k ? 'all' : k)} aria-pressed={kind === k}
        className={'flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-[14px] border text-xs font-bold ' + (kind === k ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-line bg-white text-ink')}>
        <KIcon name={k} className="w-6 h-6 text-emerald-700" />{kindLabels[k]}
      </button>)}
    </div>
    <label className="relative block">
      <span className="sr-only">Tìm kiếm</span>
      <KIcon name="search" className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
      <input className={inputCls + ' pl-11'} placeholder="Tìm món đồ hoặc việc cần giúp…" value={search} onChange={e => setSearch(e.target.value)} />
    </label>
    <div className="flex items-center justify-between mt-1">
      <h2 className="text-lg font-extrabold">{area && near ? 'Gần bạn' : 'Mọi người đang chia sẻ'}</h2>
      <button onClick={() => setMap(v => !v)} className="flex items-center gap-1 text-sm font-semibold text-emerald-700 min-h-10">
        <KIcon name={map ? 'list' : 'map'} className="w-[18px] h-[18px]" />{map ? 'Xem danh sách' : 'Xem bản đồ'}
      </button>
    </div>
    {area && !loading && near === 0 && filtered.length > 0 && <p className="text-sm text-slate-600 -mt-2">Chưa có tin ở {area.split(',')[0]}. Đây là tin ở khu vực khác.</p>}
    {loading ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-56 rounded-2xl bg-[#ECE5D4] animate-pulse" />)}</div>
      : error ? <ErrorMessage message={error} />
      : !filtered.length ? <div className="bg-white border border-line rounded-2xl p-8 text-center">
          <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl mx-auto" />
          <h3 className="text-lg font-bold mt-3">Chưa có tin phù hợp</h3>
          <p className="text-slate-600 mt-1">Hãy là người chia sẻ đầu tiên trong khu vực của bạn.</p>
          <Link className={btnPrimary + ' inline-flex items-center mt-4'} to="/cong-dong/dang-tin">Đăng tin đầu tiên</Link>
        </div>
      : map ? <MapView listings={mapped} center={center} />
      : <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{filtered.map(it => <Card item={it} area={area} key={it.id} />)}</div>}
  </div>;
}

/* ---------------- Đăng tin nhanh ---------------- */
function Post({ user }: { user: User | null }) {
  const nav = useNavigate();
  const [intent, setIntent] = useState<CommunityIntent>(() => new URLSearchParams(window.location.search).get('y') === 'can' ? 'need' : 'have');
  const [kind, setKind] = useState<CommunityKind>('gift');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showDesc, setShowDesc] = useState(false);
  const [location, setLocation] = useState(() => getArea(user?.location || '') || user?.location || '');
  const [editLoc, setEditLoc] = useState(!location);
  const [meetPlace, setMeetPlace] = useState('');
  const [wardPoint, setWardPoint] = useState<{ lat: number; lng: number; code?: string } | null>(() => getAreaPoint());
  // Khu vực lấy từ hồ sơ: tìm tâm xã/phường tương ứng để đặt tin lên bản đồ
  useEffect(() => { if (location && !wardPoint) wardFromLabel(location).then(w => w && setWardPoint({ lat: w.lat, lng: w.lng, code: w.code })); }, []);
  const [photos, setPhotos] = useState<File[]>([]);
  const previews = useMemo(() => photos.map(f => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);
  const [approximateCoords, setApproximateCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [safetyAck, setSafetyAck] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const notes = useMemo(() => safetyNotes(title + ' ' + description), [title, description]);
  const blocked = notes.some(n => n.level === 'block');
  const needAck = notes.some(n => n.level === 'warn');
  if (!user) return <AuthRequired />;

  function askLocation() {
    if (!navigator.geolocation) { setError('Thiết bị chưa hỗ trợ định vị. Bạn vẫn đăng được bằng tên khu vực.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setApproximateCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); setError(''); },
      () => { setLocating(false); setError('Chưa lấy được vị trí. Bạn vẫn đăng được bằng tên khu vực.'); },
      { timeout: 10000, enableHighAccuracy: false });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (blocked) { setError('Việc này không đăng được trên Chợ Của Tui. Nếu nguy cấp, hãy gọi 115.'); return; }
    if (needAck && !safetyAck) { setError('Hãy đọc và đánh dấu đã hiểu lưu ý an toàn.'); return; }
    setError(''); setSaving(true);
    try {
      await community.create(user, { title, description, location, photos, kind, intent, approximateCoords, meetPlace, wardPoint });
      nav('/cong-dong/da-dang');
    } catch (err: any) { setError(err?.message || 'Chưa đăng được tin. Thử lại nhé.'); }
    finally { setSaving(false); }
  }
  const titleHint = intent === 'have'
    ? ({ gift: 'VD: Xe đạp trẻ em', borrow: 'VD: Máy khoan cầm tay', help: 'VD: Chỉ dùng điện thoại cho người lớn tuổi', repair: 'VD: Sửa quần áo, vá xe đạp' } as const)[kind]
    : ({ gift: 'VD: Cần sách giáo khoa lớp 5', borrow: 'VD: Mượn thang nhôm 2 ngày', help: 'VD: Nhờ khuân đồ chuyển nhà', repair: 'VD: Quạt bàn không quay' } as const)[kind];

  return <form onSubmit={submit} className="mx-auto max-w-xl flex flex-col gap-4 pb-28 md:pb-0">
    <div className="flex items-center gap-2">
      <Link to="/" aria-label="Đóng" className="h-11 w-11 grid place-items-center rounded-full hover:bg-white"><KIcon name="x" /></Link>
      <h1 className="text-xl font-extrabold">Đăng tin</h1>
    </div>
    <div role="group" aria-label="Bạn có hay bạn cần" className="grid grid-cols-2 p-1 bg-[#F1ECDF] rounded-2xl">
      {(['have', 'need'] as const).map(v => <button type="button" key={v} onClick={() => setIntent(v)} aria-pressed={intent === v}
        className={'min-h-12 rounded-xl text-[17px] ' + (intent === v ? (v === 'have' ? 'bg-emerald-700 text-white font-extrabold' : 'bg-sun text-[#2E1F00] font-extrabold') : 'text-ink font-bold')}>
        {v === 'have' ? 'Tôi có' : 'Tôi cần'}</button>)}
    </div>

    <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
      onChange={e => { const files = Array.from(e.target.files || []); setPhotos(p => [...p, ...files].slice(0, MAX_PHOTOS)); e.target.value = ''; }} />
    {photos.length === 0
      ? <button type="button" onClick={() => fileRef.current?.click()} className="h-[168px] rounded-[20px] border-2 border-dashed border-[#B9C9BC] bg-white flex flex-col items-center justify-center gap-2 text-emerald-700">
          <span className="h-16 w-16 rounded-full bg-emerald-50 grid place-items-center"><KIcon name="camera" className="w-8 h-8" /></span>
          <span className="text-[17px] font-extrabold">{intent === 'have' ? 'Chụp ảnh món đồ' : 'Thêm ảnh (nếu có)'}</span>
          <span className="text-[13px] text-slate-600">hoặc chọn từ máy · tối đa {MAX_PHOTOS} ảnh</span>
        </button>
      : <div className="flex gap-2 flex-wrap">{previews.map((u, i) =>
          <div key={u} className="relative"><img src={u} alt="" className="h-24 w-24 rounded-2xl object-cover border border-line" />
            <button type="button" aria-label="Bỏ ảnh" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white border border-line grid place-items-center"><KIcon name="x" className="w-4 h-4" /></button>
          </div>)}
          {photos.length < MAX_PHOTOS && <button type="button" onClick={() => fileRef.current?.click()} aria-label="Thêm ảnh" className="h-24 w-24 rounded-2xl border-2 border-dashed border-[#B9C9BC] bg-white grid place-items-center text-emerald-700"><KIcon name="camera" /></button>}
        </div>}

    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Loại">
      {KINDS.map(k => <button type="button" key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
        className={'flex items-center gap-2 min-h-[52px] px-3 rounded-[14px] text-[15px] font-bold ' + (kind === k ? 'border-2 border-emerald-700 bg-emerald-50 text-emerald-900' : 'border border-line bg-white')}>
        <KIcon name={k} className="w-[22px] h-[22px] text-emerald-700" />{kindText(k, intent)}</button>)}
    </div>

    <div className="flex flex-col gap-1.5">
      <label htmlFor="post-title" className="text-[15px] font-bold">{intent === 'have' ? (kind === 'help' || kind === 'repair' ? 'Bạn giúp được việc gì?' : 'Món gì?') : 'Bạn cần gì?'}</label>
      <div className="flex items-center min-h-[52px] rounded-[14px] border border-[#C9C1AE] bg-white pl-4 pr-1.5 focus-within:ring-2 focus-within:ring-emerald-600">
        <input id="post-title" required minLength={5} maxLength={90} value={title} onChange={e => setTitle(e.target.value)} placeholder={titleHint}
          className="flex-1 bg-transparent outline-none text-base py-3" />
        <VoiceButton className="h-10 w-10" onText={t => setTitle(v => (v ? v + ' ' : '') + t)} />
      </div>
      {!showDesc ? <button type="button" onClick={() => setShowDesc(true)} className="self-start text-sm font-semibold text-emerald-700 underline min-h-9">+ Thêm mô tả (không bắt buộc)</button>
        : <textarea maxLength={900} rows={3} className={inputCls} placeholder="Tình trạng, thời gian rảnh…" value={description} onChange={e => setDescription(e.target.value)} aria-label="Mô tả thêm" />}
    </div>

    <div className="flex flex-col gap-2">
      <span className="text-[15px] font-bold">Hẹn {intent === 'have' && (kind === 'gift' || kind === 'borrow') ? 'trao' : 'gặp'} ở đâu?</span>
      <div className="flex gap-2 flex-wrap">{MEET_PLACES.map(p => <button type="button" key={p} onClick={() => setMeetPlace(meetPlace === p ? '' : p)} aria-pressed={meetPlace === p}
        className={'min-h-9 px-3 rounded-full border text-[13px] font-semibold ' + (meetPlace === p ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-line bg-white')}>{p}</button>)}</div>
      {editLoc
        ? <div><label htmlFor="post-area" className="sr-only">Xã/phường</label>
            <AreaInput id="post-area" value={location} onType={t => { setLocation(t); setWardPoint(null); }} onPick={w => { setLocation(w.label); setWardPoint({ lat: w.lat, lng: w.lng, code: w.code }); setEditLoc(false); }} /></div>
        : <span className="flex items-center gap-1.5 text-[13px] text-slate-600"><KIcon name="pin" className="w-4 h-4 text-emerald-700" />{location} · <button type="button" className="underline text-emerald-700 font-semibold" onClick={() => setEditLoc(true)}>Đổi</button></span>}
      <button type="button" onClick={askLocation} disabled={locating} className="self-start text-[13px] font-semibold underline text-emerald-700 min-h-8">
        {locating ? 'Đang xác định…' : approximateCoords ? '✓ Đã gắn vị trí gần đúng lên bản đồ' : 'Thêm vị trí gần đúng lên bản đồ (không bắt buộc)'}</button>
      <span className="text-xs text-slate-500">Không ghi số nhà. Trên bản đồ, tin được đặt ở giữa xã/phường (hoặc vị trí làm tròn khoảng 1 km nếu bạn cho phép).</span>
    </div>

    <SafetyBox notes={notes} />
    {needAck && !blocked && <label className="flex gap-2 items-start text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={safetyAck} onChange={e => setSafetyAck(e.target.checked)} />Tôi đã đọc lưu ý an toàn ở trên.</label>}
    {error && <ErrorMessage message={error} />}

    <div className="fixed md:static left-0 right-0 bottom-[76px] z-30 bg-white md:bg-transparent border-t md:border-0 border-line px-4 md:px-0 pt-3 pb-3 md:p-0 flex flex-col gap-1">
      <button disabled={saving || blocked} type="submit" className="min-h-14 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-lg font-extrabold disabled:opacity-60">{saving ? 'Đang đăng…' : 'Đăng tin'}</button>
      <span className="text-center text-xs text-slate-600">Miễn phí. Tin hiện sau khi được duyệt.</span>
    </div>
  </form>;
}
function Posted() {
  return <div className="mx-auto max-w-lg rounded-3xl bg-white border border-line p-8 text-center">
    <span className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center mx-auto"><KIcon name="check" className="w-8 h-8" strokeWidth={3} /></span>
    <h1 className="text-2xl font-extrabold mt-4">Đã nhận tin của bạn!</h1>
    <p className="text-slate-600 mt-2">Tin đang chờ quản trị viên duyệt. Khi có người liên hệ, bạn sẽ thấy ở mục Tin nhắn.</p>
    <Link className={btnPrimary + ' inline-flex items-center mt-6'} to="/">Về trang chủ</Link>
  </div>;
}

/* ---------------- Chi tiết tin ---------------- */
function Detail({ user, id }: { user: User | null; id: string }) {
  const nav = useNavigate();
  const [item, setItem] = useState<CommunityListing | null>(null);
  const [owner, setOwner] = useState<PublicProfile | null>(null);
  const [done, setDone] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [reported, setReported] = useState(false);
  const area = useArea(user);
  useEffect(() => {
    if (!item) return;
    const prev = document.title;
    document.title = item.title + ' – Chợ Của Tui';
    return () => { document.title = prev; };
  }, [item?.id]);
  useEffect(() => { if (user) community.savedIds(user.id).then(ids => setSaved(ids.includes(id))); }, [user?.id, id]);
  useEffect(() => {
    let alive = true; setLoading(true);
    community.detail(id).then(x => {
      if (!alive) return; setItem(x);
      if (x) { db.getPublicProfile(x.sellerId).then(p => alive && setOwner(p)); community.doneCount(x.sellerId).then(n => alive && setDone(n)); }
    }).catch(e => alive && setError(e?.message || 'Không tải được tin')).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);
  if (loading) return <div className="max-w-3xl mx-auto"><div className="h-72 rounded-3xl bg-[#ECE5D4] animate-pulse" /><div className="h-8 w-2/3 rounded-xl bg-[#ECE5D4] animate-pulse mt-5" /></div>;
  if (error) return <ErrorMessage message={error} />;
  if (!item) return <div className="bg-white p-8 rounded-2xl border border-line">Tin không tồn tại hoặc đã đóng. <Link className="underline" to="/">Về trang chủ</Link></div>;
  const kind = (item.communityKind || 'gift') as CommunityKind;
  const need = item.communityIntent === 'need';
  const mine = user?.id === item.sellerId;
  const ownerName = owner?.name || item.sellerName || 'Thành viên';
  const notes = safetyNotes(item.title + ' ' + (item.description || ''));
  const images = item.images || [];

  async function ask() {
    if (!user || !item) return nav('/login');
    setSending(true); setError('');
    try {
      const msg = need ? 'Chào bạn, mình giúp được việc này: ' + item.title : 'Chào bạn, mình xin món này nhé: ' + item.title;
      const room = await community.askAndOpenChat(item, user, msg);
      nav('/chat/' + room);
    } catch (e: any) { setError(e?.message || 'Chưa liên hệ được, thử lại nhé.'); }
    finally { setSending(false); }
  }
  async function toggleSave() {
    if (!user) return nav('/login');
    setSaved(v => !v);
    try { await community.toggleSave(user.id, id); } catch (_) { setSaved(v => !v); setError('Chưa lưu được tin, thử lại nhé.'); }
  }
  async function report() {
    if (!user) return nav('/login');
    const reason = window.prompt('Tin này có vấn đề gì? (ví dụ: đòi tiền, lừa đảo, nội dung xấu)');
    if (!reason || !item) return;
    try { await db.reportListing({ listingId: item.id, targetUserId: item.sellerId, userId: user.id, reason: reason.slice(0, 300) }); setReported(true); }
    catch (_) { setError('Chưa gửi được báo cáo.'); }
  }
  const roundBtn = 'h-11 w-11 rounded-full bg-white/95 grid place-items-center text-ink shadow-sm';

  return <div className="mx-auto max-w-3xl pb-32 md:pb-0">
    <div className="relative -mx-4 md:mx-0 md:rounded-3xl overflow-hidden">
      {images.length
        ? <img src={images[Math.min(photoIndex, images.length - 1)]} alt={item.title} className="w-full h-[300px] md:h-[420px] object-cover bg-emerald-950" />
        : <div className={'h-[300px] grid place-items-center text-emerald-700 ' + KIND_META[kind].tint}><KIcon name={kind} className="w-28 h-28" strokeWidth={1.2} /></div>}
      <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} aria-label="Quay lại" className={roundBtn + ' absolute top-3.5 left-4'}><KIcon name="back" className="w-[22px] h-[22px]" /></button>
      <div className="absolute top-3.5 right-4 flex gap-2">
        <button onClick={() => setSharing(true)} aria-label="Chia sẻ" className={roundBtn}><KIcon name="share" className="w-5 h-5" /></button>
        <button onClick={toggleSave} aria-label={saved ? 'Bỏ lưu' : 'Lưu tin'} aria-pressed={saved} className={roundBtn + (saved ? ' !bg-emerald-700 !text-white' : '')}><KIcon name="bookmark" className="w-5 h-5" /></button>
      </div>
      {images.length > 1 && <div className="absolute bottom-3.5 left-0 right-0 flex justify-center gap-1.5">{images.map((_, i) =>
        <button key={i} onClick={() => setPhotoIndex(i)} aria-label={'Ảnh ' + (i + 1)} className={'h-2.5 rounded-full ' + (i === photoIndex ? 'w-6 bg-white' : 'w-2.5 bg-white/60')} />)}</div>}
    </div>

    <div className="pt-5 flex flex-col gap-3.5">
      <div className="flex gap-2 flex-wrap">
        <IntentBadge kind={kind} intent={item.communityIntent} className="!text-xs !px-2.5 !py-1" />
        <span className="text-xs font-bold text-emerald-700 bg-white border border-emerald-700 px-2.5 py-0.5 rounded-full">Miễn phí</span>
      </div>
      <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">{item.title}</h1>
      {item.description && <p className="text-[15px] leading-relaxed text-[#3B4A40] whitespace-pre-wrap">{item.description}</p>}
      <div className="flex flex-col gap-2.5 text-sm text-slate-600">
        <span className="flex items-center gap-2"><KIcon name="pin" className="w-[18px] h-[18px] text-emerald-700" />{item.location || 'Chưa có khu vực'}{sameArea(item.location, area) ? ' · cùng khu vực với bạn' : ''}</span>
        {item.meetPlace && <span className="flex items-center gap-2"><KIcon name="map" className="w-[18px] h-[18px] text-emerald-700" />Hẹn {need ? 'gặp' : 'trao'} ở: {item.meetPlace}</span>}
        {item.createdAt && <span className="flex items-center gap-2"><KIcon name="clock" className="w-[18px] h-[18px] text-emerald-700" />Đăng {formatTimeAgo(String(item.createdAt))}</span>}
      </div>
      <Link to={'/profile/' + item.sellerId} className="flex items-center gap-3 p-3 bg-white border border-line rounded-2xl">
        {owner?.avatar ? <img src={owner.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
          : <span className="h-11 w-11 rounded-full bg-emerald-700 text-white font-extrabold grid place-items-center">{ownerName.charAt(0).toUpperCase()}</span>}
        <span className="flex flex-col flex-1 min-w-0">
          <span className="text-[15px] font-bold truncate">{ownerName}</span>
          <span className="text-xs text-slate-600">{(owner?.sharedCount || done) > 0 ? 'Đã chia sẻ xong ' + (owner?.sharedCount || done) + ' lần' : 'Thành viên Chợ Của Tui'}</span>
        </span>
      </Link>
      <SafetyBox notes={notes} />
      {!mine && <p className="text-[13px] leading-relaxed text-slate-600">{need ? 'Người đăng sẽ chọn người giúp phù hợp.' : 'Người cho sẽ chọn người nhận.'} Không chuyển khoản hay đặt cọc cho bất kỳ ai. {reported ? 'Đã gửi báo cáo, cảm ơn bạn.' : <button onClick={report} className="underline">Báo cáo tin này</button>}</p>}
      {error && <ErrorMessage message={error} />}
    </div>

    <div className="fixed md:static left-0 right-0 bottom-[76px] z-30 bg-white md:bg-transparent border-t md:border-0 border-line px-4 md:px-0 pt-3 pb-3 md:pt-5 flex flex-col gap-1.5">
      {mine
        ? <Link to="/chat" className="min-h-14 rounded-2xl bg-emerald-700 text-white text-lg font-extrabold flex items-center justify-center gap-2">Xem người liên hệ</Link>
        : <button disabled={sending} onClick={ask} className="min-h-14 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-lg font-extrabold flex items-center justify-center gap-2 disabled:opacity-60">
            <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
            {sending ? 'Đang mở trò chuyện…' : need ? 'Tôi giúp được' : 'Xin món này'}</button>}
      {!mine && <span className="text-center text-xs text-slate-600">{user ? 'Bấm là mở trò chuyện với ' + ownerName + ' ngay' : 'Bạn sẽ được mời đăng nhập trước'}</span>}
    </div>
    <ShareModal isOpen={sharing} onClose={() => setSharing(false)} url={window.location.origin + tinPath(item)} title={item.title} image={images[0]} text={(need ? 'Tôi cần' : 'Tôi có') + ' · ' + kindText(kind, item.communityIntent) + ': ' + item.title + ' — miễn phí trên Chợ Của Tui'} />
  </div>;
}

/* ---------------- Yêu cầu ---------------- */
function Requests({ user }: { user: User | null }) {
  const nav = useNavigate();
  const [items, setItems] = useState<CommunityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState('');
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  async function refresh() {
    if (!user) return;
    setError('');
    try { setItems(await community.mine()); } catch (e: any) { setError(e?.message || 'Chưa tải được các yêu cầu'); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (user) void refresh(); else setLoading(false); }, [user?.id]);
  if (!user) return <AuthRequired />;
  const visible = items.filter(x => tab === 'received' ? x.ownerId === user.id : x.requesterId === user.id);
  async function chat(request: CommunityRequest) {
    setWorking(request.id); setError('');
    try {
      const listing = await community.detail(request.listingId);
      if (!listing) throw new Error('Tin đã được ẩn.');
      const requester = request.requesterId === user!.id ? user! : (await db.getPublicProfile(request.requesterId)) as unknown as User | null;
      if (!requester) throw new Error('Không tìm thấy thành viên.');
      nav('/chat/' + await db.createChatRoom(listing, requester));
    } catch (e: any) { setError(e?.message || 'Không thể mở tin nhắn'); }
    finally { setWorking(''); }
  }
  return <div className="mx-auto max-w-2xl">
    <h1 className="text-2xl md:text-3xl font-extrabold mb-1">Yêu cầu</h1>
    <p className="text-slate-600 mb-4">Ai đang xin, ai đang giúp, đã tới bước nào.</p>
    <div role="group" className="grid grid-cols-2 p-1 bg-[#F1ECDF] rounded-2xl mb-4">
      {([['received', 'Trên tin của tôi'], ['sent', 'Tôi đã gửi']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
        className={'min-h-11 rounded-xl text-[15px] ' + (tab === k ? 'bg-white font-extrabold shadow-sm' : 'font-semibold text-slate-600')}>{l}</button>)}
    </div>
    {error && <ErrorMessage message={error} />}
    {loading ? <p className="text-slate-600">Đang tải…</p> : !visible.length ? <p className="rounded-2xl bg-white border border-line p-6 text-slate-600">Chưa có yêu cầu nào ở mục này.</p> :
      <div className="space-y-3">{visible.map(r => <article key={r.id} className="rounded-[18px] bg-white border border-line p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link className="text-[15px] font-bold hover:underline line-clamp-2" to={'/cong-dong/tin/' + r.listingId}>{r.listingTitle}</Link>
            <span className="block text-xs text-slate-600 mt-0.5">{kindText(r.kind, r.intent)} · {statusLabels[r.status]}</span>
          </div>
          {r.status !== 'declined' && r.status !== 'cancelled' && <button disabled={working === r.id} onClick={() => chat(r)} className="shrink-0 min-h-10 px-3 rounded-full border border-line text-sm font-semibold flex items-center gap-1.5"><KIcon name="send" className="w-4 h-4 text-emerald-700" />Trò chuyện</button>}
        </div>
        <p className="text-sm text-slate-600">“{r.message}”</p>
        <Steps r={r} />
        <RequestActions r={r} uid={user.id} onDone={refresh} compact />
      </article>)}</div>}
  </div>;
}

/* ---------------- Đã lưu ---------------- */
function Saved({ user }: { user: User | null }) {
  const [items, setItems] = useState<CommunityListing[]>([]);
  const [loading, setLoading] = useState(true);
  const area = useArea(user);
  useEffect(() => { if (!user) { setLoading(false); return; } community.saved(user.id).then(setItems).finally(() => setLoading(false)); }, [user?.id]);
  if (!user) return <AuthRequired />;
  return <div>
    <h1 className="text-2xl md:text-3xl font-extrabold mb-1">Tin đã lưu</h1>
    <p className="text-slate-600 mb-4">Bấm biểu tượng lưu ở trang chi tiết để xem lại sau.</p>
    {loading ? <p className="text-slate-600">Đang tải…</p> : !items.length
      ? <p className="rounded-2xl bg-white border border-line p-6 text-slate-600">Chưa lưu tin nào. <Link className="underline text-emerald-700" to="/">Khám phá ngay</Link></p>
      : <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{items.map(it => <Card item={it} area={area} key={it.id} />)}</div>}
  </div>;
}

export default function CommunityApp({ user }: { user: User | null }) {
  const route = useLocation().pathname;
  if (route === '/cong-dong/dang-tin') return <Post user={user} />;
  if (route === '/cong-dong/yeu-cau') return <Requests user={user} />;
  if (route === '/cong-dong/da-dang') return <Posted />;
  if (route === '/cong-dong/da-luu') return <Saved user={user} />;
  if (route.startsWith('/cong-dong/tin/')) return <Detail user={user} id={(decodeURIComponent(route.split('/').pop() || '').split('-').pop()) || ''} />;
  return <Home user={user} />;
}
