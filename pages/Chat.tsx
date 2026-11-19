/**
 * Trò chuyện — Chợ Của Tui.
 * Điện thoại: hộp thư → bấm vào là chat toàn màn hình.
 * Máy tính: 3 cột (hộp thư | trò chuyện | chi tiết & tiến trình).
 * Tiến trình: dải mỏng hiện bước hiện tại; bấm vào để xem mọi giai đoạn.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ChatRoom, User, Message } from '../types';
import { community, kindLabels, type CommunityRequest } from '../services/community';
import {
  KIcon, VStepper, RequestActions, VoiceButton, ChipBadge, IntentBadge,
  chipFor, needsMe, stepSummary, suggestionsFor
} from '../components/CommunityUI';
import { ThankButton } from '../components/Thanks';

const MEET_TIMES = ['Sáng nay', 'Trưa nay', 'Chiều nay', 'Tối nay', 'Ngày mai'];
const MEET_PLACES = ['Cổng chợ', 'Cổng trường', 'Nhà văn hoá', 'UBND phường/xã', 'Gửi tiệm tạp hoá', 'Tại nhà'];
const GROUP_GAP_MS = 5 * 60 * 1000;

type Partner = { name: string; avatar?: string };

function dayLabel(iso: string) {
  const d = new Date(iso), now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
}
function shortTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const days = (now.getTime() - d.getTime()) / 86400000;
  if (days < 2) return 'Hôm qua';
  if (days < 7) return d.toLocaleDateString('vi-VN', { weekday: 'short' });
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}
function realImage(url?: string) { return url && !url.includes('placehold.co') ? url : ''; }

const Avatar: React.FC<{ p?: Partner; size?: number; thumb?: string; kind?: string }> = ({ p, size = 52, thumb, kind }) => (
  <span className="relative shrink-0" style={{ width: size, height: size }}>
    {p?.avatar
      ? <img src={p.avatar} alt="" className="rounded-full object-cover w-full h-full bg-emerald-50" onError={e => { e.currentTarget.style.display = 'none'; }} />
      : <span className="rounded-full w-full h-full bg-emerald-700 text-white font-extrabold grid place-items-center" style={{ fontSize: size * 0.4 }}>{(p?.name || '?').charAt(0).toUpperCase()}</span>}
    {(thumb || kind) && size >= 44 && <span className="absolute -right-1 -bottom-1 h-[26px] w-[26px] rounded-lg border-2 border-white bg-emerald-50 overflow-hidden grid place-items-center text-emerald-700">
      {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <KIcon name={kind!} className="w-4 h-4" strokeWidth={1.8} />}
    </span>}
  </span>
);

const Chat: React.FC<{ user: User | null }> = ({ user }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [reqs, setReqs] = useState<Record<string, CommunityRequest | null>>({});
  const [partners, setPartners] = useState<Record<string, Partner>>({});
  const [filter, setFilter] = useState<'all' | 'todo'>('all');
  const [search, setSearch] = useState('');
  const [activeReq, setActiveReq] = useState<CommunityRequest | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [tray, setTray] = useState<'none' | 'menu' | 'meet'>('none');
  const [meetTime, setMeetTime] = useState('');
  const [meetPlace, setMeetPlace] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  useEffect(() => { if (user) community.blockedIds(user.id).then(setBlockedIds); }, [user?.id]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 1. Danh sách phòng (trực tiếp)
  useEffect(() => {
    if (!user) return;
    const unsub = db.getChatRooms(user.id, (r: ChatRoom[]) => setRooms(r || []));
    return () => unsub && unsub();
  }, [user?.id]);

  // 2. Trạng thái yêu cầu của từng phòng (để hiện nhãn trong hộp thư)
  useEffect(() => {
    const missing = rooms.filter(r => !(r.id in reqs) && r.listingId);
    if (!missing.length) return;
    Promise.all(missing.map(r => community.requestForRoom(r.id, r.listingId).then(q => [r.id, q] as const)))
      .then(list => setReqs(prev => ({ ...prev, ...Object.fromEntries(list) })));
  }, [rooms]);

  // 3. Tên, ảnh người kia (hồ sơ công khai) khi phòng chưa lưu sẵn
  useEffect(() => {
    if (!user) return;
    const ids: string[] = Array.from(new Set<string>(rooms.map(r => r.participantIds?.find(id => id !== user.id) || '').filter(x => !!x && !partners[x])));
    if (!ids.length) return;
    Promise.all(ids.map(id => db.getPublicProfile(id).then(p => [id, p] as const))).then(list => {
      const next: Record<string, Partner> = {};
      list.forEach(([id, p]) => { if (p) next[id] = { name: p.name, avatar: p.avatar }; });
      setPartners(prev => ({ ...prev, ...next }));
    });
  }, [rooms, user?.id]);

  const activeRoom = useMemo(() => rooms.find(r => r.id === roomId) || null, [rooms, roomId]);
  const [fallbackRoom, setFallbackRoom] = useState<ChatRoom | null>(null);
  useEffect(() => {
    // Phòng vừa tạo có thể chưa có trong danh sách
    if (roomId && !activeRoom) db.getChatRoom(roomId).then(r => setFallbackRoom(r || null));
    else setFallbackRoom(null);
  }, [roomId, !!activeRoom]);
  const room = activeRoom || fallbackRoom;

  // 4. Yêu cầu của phòng đang mở (trực tiếp) + đánh dấu đã xem
  useEffect(() => {
    setActiveReq(null); setExpanded(false); setTray('none'); setMenu(false);
    if (!room?.id || !room.listingId) return;
    return community.watchRequestForRoom(room.id, room.listingId, q => { setActiveReq(q); setReqs(prev => ({ ...prev, [room.id]: q })); });
  }, [room?.id]);
  useEffect(() => {
    if (user && room && room.messages?.length && !room.seenBy?.includes(user.id)) db.markRoomAsSeen(room.id, user.id);
  }, [room?.id, room?.messages?.length]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [room?.messages?.length, room?.id]);

  if (!user) return <div className="p-10 text-center">Vui lòng <Link className="underline" to="/login">đăng nhập</Link> để xem tin nhắn.</div>;

  const partnerOf = (r: ChatRoom): Partner => {
    const pid = r.participantIds?.find(id => id !== user.id) || '';
    return partners[pid] || r.participantsData?.[pid] || { name: 'Thành viên' };
  };
  const partner = room ? partnerOf(room) : undefined;
  const todoCount = rooms.filter(r => reqs[r.id] && needsMe(reqs[r.id]!, user.id)).length;
  const q = search.trim().toLowerCase();
  const listRooms = rooms
    .filter(r => filter === 'all' || (reqs[r.id] && needsMe(reqs[r.id]!, user.id)))
    .filter(r => !q || (partnerOf(r).name + ' ' + (r.listingTitle || '')).toLowerCase().includes(q))
    // Việc cần mình làm lên trên cùng
    .sort((a, b) => Number(!!reqs[b.id] && needsMe(reqs[b.id]!, user.id)) - Number(!!reqs[a.id] && needsMe(reqs[a.id]!, user.id)));

  async function send(text: string, type: Message['type'] = 'text') {
    if (!room || !text.trim()) return;
    setSending(true);
    try { await db.addMessage(room.id, { senderId: user!.id, text: text.trim().slice(0, 1000), type }); }
    catch (e: any) { alert(e?.code === 'permission-denied' ? 'Không gửi được: người này hiện không nhận tin nhắn từ bạn.' : 'Gửi chưa được, kiểm tra mạng rồi thử lại nhé.'); }
    finally { setSending(false); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = message; setMessage('');
    await send(t);
  }
  async function sendImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !room) return;
    setSending(true); setTray('none');
    try {
      const url = await db.uploadChatImage(file);
      await db.addMessage(room.id, { senderId: user!.id, text: 'Đã gửi một ảnh', type: 'image', imageUrl: url });
    } catch (_) { alert('Chưa gửi được ảnh.'); }
    finally { setSending(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function sendZalo() {
    setTray('none');
    const phone = window.prompt('Số Zalo bạn muốn gửi cho người này:', user!.phone || '');
    if (!phone || !phone.trim()) return;
    if (!window.confirm('Gửi số ' + phone.trim() + ' cho ' + (partner?.name || 'người này') + '?')) return;
    await send('Zalo của mình: ' + phone.trim().slice(0, 20));
  }
  async function sendMeet() {
    if (!meetTime && !meetPlace) return;
    await send([meetTime, meetPlace].filter(Boolean).join(' · '), 'meet');
    setMeetTime(''); setMeetPlace(''); setTray('none');
  }
  async function removeRoom() {
    if (!room || !window.confirm('Xoá cuộc trò chuyện này?')) return;
    try { await db.deleteChatRoom(room.id); navigate('/chat'); } catch (_) { alert('Chưa xoá được.'); }
  }
  async function toggleBlock() {
    if (!room) return;
    const other = room.participantIds?.find(id => id !== user!.id);
    if (!other) return;
    const on = !blockedIds.includes(other);
    if (on && !window.confirm('Chặn ' + (partner?.name || 'người này') + '?\nHọ sẽ không nhắn tin, gửi yêu cầu hay thông báo cho bạn được nữa. Bạn có thể bỏ chặn trong trang Cá nhân.')) return;
    setMenu(false);
    try { await community.setBlocked(other, on); setBlockedIds(b => on ? [...b, other] : b.filter(x => x !== other)); }
    catch (_) { alert('Chưa thực hiện được, thử lại nhé.'); }
  }
  async function report() {
    setMenu(false);
    const reason = window.prompt('Cuộc trò chuyện có vấn đề gì? (ví dụ: đòi tiền, lừa đảo, nói lời xấu)');
    if (!reason || !room) return;
    const other = room.participantIds?.find(id => id !== user!.id);
    try { await db.reportListing({ listingId: room.listingId, targetUserId: other, userId: user!.id, reason: ('[Chat] ' + reason).slice(0, 300) }); alert('Đã gửi báo cáo, cảm ơn bạn.'); }
    catch (_) { alert('Chưa gửi được báo cáo.'); }
  }

  const latestMeet = room ? [...(room.messages || [])].reverse().find(m => m.type === 'meet') : undefined;

  /* ---------- Hộp thư ---------- */
  const inbox = (
    <aside className={(roomId ? 'hidden md:flex' : 'flex') + ' flex-col w-full md:w-[340px] md:shrink-0 md:border-r border-line bg-white min-h-0'}>
      <div className="p-4 pb-2 flex flex-col gap-3">
        <h1 className="text-[26px] md:text-[22px] font-extrabold">Tin nhắn</h1>
        <label className="relative block"><span className="sr-only">Tìm trong tin nhắn</span>
          <KIcon name="search" className="w-[18px] h-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên, món đồ…" className="w-full h-11 rounded-xl bg-cream border border-line pl-10 pr-3 text-[15px] outline-none focus:ring-2 focus:ring-emerald-600" />
        </label>
        <div role="group" aria-label="Lọc" className="grid grid-cols-2 p-1 bg-[#F1ECDF] rounded-[14px]">
          <button onClick={() => setFilter('all')} aria-pressed={filter === 'all'} className={'h-10 rounded-[10px] text-sm ' + (filter === 'all' ? 'bg-white font-extrabold shadow-sm' : 'font-semibold text-slate-600')}>Tất cả</button>
          <button onClick={() => setFilter('todo')} aria-pressed={filter === 'todo'} className={'h-10 rounded-[10px] text-sm flex items-center justify-center gap-1.5 ' + (filter === 'todo' ? 'bg-white font-extrabold shadow-sm' : 'font-semibold text-slate-600')}>
            Cần bạn làm {todoCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-sun text-[#2E1F00] text-xs font-extrabold grid place-items-center">{todoCount}</span>}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {listRooms.length ? listRooms.map(r => {
          const p = partnerOf(r);
          const unread = r.messages?.length > 0 && !r.seenBy?.includes(user.id);
          const rq = reqs[r.id];
          const last = r.messages?.[r.messages.length - 1];
          const lastText = !last ? 'Bắt đầu trò chuyện'
            : last.type === 'event' ? (last.senderId === user.id ? 'Bạn ' : p.name + ' ') + last.text
            : (last.senderId === user.id ? 'Bạn: ' : '') + (last.type === 'image' ? 'Ảnh' : last.type === 'meet' ? 'Đề nghị hẹn: ' + last.text : last.text);
          return <Link key={r.id} to={'/chat/' + r.id} className={'flex gap-3 px-4 py-3 border-l-[3px] ' + (roomId === r.id ? 'bg-[#F1F7F2] border-emerald-700' : 'border-transparent hover:bg-cream')}>
            <Avatar p={p} thumb={realImage(r.listingImage)} kind={rq?.kind} />
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="flex items-baseline gap-2">
                <span className={'flex-1 truncate text-[15px] ' + (unread ? 'font-extrabold' : 'font-bold')}>{p.name}</span>
                <span className={'text-xs ' + (unread ? 'text-emerald-700 font-bold' : 'text-slate-500')}>{shortTime(r.lastUpdate)}</span>
              </span>
              <span className="text-xs text-slate-500 truncate">{r.listingTitle}</span>
              <span className="flex items-center gap-2">
                <span className={'flex-1 truncate text-sm ' + (unread ? 'text-ink font-semibold' : 'text-slate-500')}>{lastText}</span>
                {unread && <span className="h-2.5 w-2.5 rounded-full bg-emerald-700 shrink-0" aria-label="Chưa đọc" />}
              </span>
              {rq && <span className="mt-1"><ChipBadge chip={chipFor(rq, user.id)} /></span>}
            </span>
          </Link>;
        }) : <p className="p-8 text-center text-slate-600">{filter === 'todo' ? 'Không có việc nào đang chờ bạn.' : 'Chưa có trò chuyện nào. Bấm "Xin món này" ở một tin để bắt đầu.'}</p>}
        <p className="px-4 py-4 text-xs text-slate-500">Mỗi cuộc trò chuyện gắn với một món đồ. Việc cần bạn làm luôn nằm trên cùng.</p>
      </div>
    </aside>
  );

  /* ---------- Dòng tin nhắn (gộp cụm, ngăn theo ngày) ---------- */
  const thread = room && (() => {
    const msgs = room.messages || [];
    const out: React.ReactNode[] = [];
    let lastDay = '';
    msgs.forEach((m, i) => {
      const day = new Date(m.timestamp).toDateString();
      if (day !== lastDay) { out.push(<span key={'d' + i} className="self-center text-xs font-bold text-slate-500 my-1">{dayLabel(m.timestamp)}</span>); lastDay = day; }
      const mine = m.senderId === user.id;
      if (m.type === 'event') {
        out.push(<div key={m.id} className="self-center flex items-center gap-1.5 text-xs font-semibold text-emerald-900 bg-[#F1ECDF] px-3 py-1.5 rounded-full max-w-[90%] text-center">
          <KIcon name="check" className="w-3.5 h-3.5 text-emerald-700" strokeWidth={2.5} />{(mine ? 'Bạn ' : (partner?.name || 'Bên kia') + ' ') + m.text} · {shortTime(m.timestamp)}</div>);
        return;
      }
      const next = msgs[i + 1];
      const prev = msgs[i - 1];
      const startsGroup = !prev || prev.senderId !== m.senderId || prev.type === 'event' || new Date(m.timestamp).getTime() - new Date(prev.timestamp).getTime() > GROUP_GAP_MS || new Date(prev.timestamp).toDateString() !== day;
      const endsGroup = !next || next.senderId !== m.senderId || next.type === 'event' || new Date(next.timestamp).getTime() - new Date(m.timestamp).getTime() > GROUP_GAP_MS || new Date(next.timestamp).toDateString() !== day;
      const radius = mine ? (endsGroup ? 'rounded-[18px] rounded-br-md' : 'rounded-[18px]') : (endsGroup ? 'rounded-[18px] rounded-bl-md' : 'rounded-[18px]');
      let body: React.ReactNode;
      if (m.type === 'image' && m.imageUrl) {
        body = <a href={m.imageUrl} target="_blank" rel="noopener noreferrer" className="block rounded-2xl overflow-hidden border border-line max-w-[240px]"><img src={m.imageUrl} alt="Ảnh đã gửi" className="w-full" /></a>;
      } else if (m.type === 'meet') {
        const isLatest = latestMeet?.id === m.id;
        body = <div className="w-[260px] max-w-full bg-white border border-line rounded-2xl overflow-hidden">
          <div className="p-3 flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><KIcon name="clock" className="w-3.5 h-3.5" />Đề nghị hẹn</span>
            <span className="text-[15px] font-extrabold">{m.text}</span>
          </div>
          {!mine && isLatest && <div className="grid grid-cols-2 border-t border-line">
            <button onClick={() => send('Đồng ý hẹn ' + m.text + ' nhé!')} className="min-h-11 text-sm font-bold text-emerald-700 border-r border-line">Đồng ý</button>
            <button onClick={() => setTray('meet')} className="min-h-11 text-sm font-semibold">Đổi giờ</button>
          </div>}
        </div>;
      } else {
        body = <span className={'inline-block px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap break-words ' + radius + (mine ? ' bg-emerald-700 text-white' : ' bg-white border border-line')}>{m.type === 'location' ? (m.text || 'Vị trí') : m.text}</span>;
      }
      out.push(<div key={m.id} className={'group flex flex-col max-w-[78%] ' + (mine ? 'self-end items-end' : 'self-start items-start') + (startsGroup ? ' mt-2' : '')}>
        {body}
        {endsGroup && <span className="text-[11px] text-slate-500 mt-1 mx-1 flex gap-2">
          {mine && m.type === 'text' && <button onClick={() => window.confirm('Thu hồi tin nhắn này?') && db.deleteMessage(room.id, m.id)} className="hidden md:group-hover:inline underline">Thu hồi</button>}
          {shortTime(m.timestamp)}</span>}
      </div>);
    });
    return out;
  })();

  /* ---------- Dải tiến trình (thu gọn / mở ra) ---------- */
  const progress = room && activeReq && (
    <div className="lg:hidden bg-sun-light border-b border-[#F2DFAF]">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <button onClick={() => setExpanded(v => !v)} aria-expanded={expanded} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
          {realImage(room.listingImage)
            ? <img src={room.listingImage} alt="" className="h-11 w-11 rounded-[10px] object-cover shrink-0" />
            : <span className="h-11 w-11 rounded-[10px] bg-emerald-50 text-emerald-700 grid place-items-center shrink-0"><KIcon name={activeReq.kind} className="w-6 h-6" strokeWidth={1.6} /></span>}
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold truncate">{room.listingTitle}</span>
            <span className="block text-xs font-semibold text-sun-dark truncate">{stepSummary(activeReq, user.id, partner?.name)}</span>
          </span>
          <svg className={'w-5 h-5 shrink-0 transition-transform ' + (expanded ? 'rotate-180' : '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          <span className="sr-only">{expanded ? 'Thu gọn tiến trình' : 'Xem các giai đoạn'}</span>
        </button>
      </div>
      {expanded && <div className="px-4 pb-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
        <VStepper r={activeReq} uid={user.id} partnerName={partner?.name} />
        <RequestActions r={activeReq} uid={user.id} compact onDone={() => setExpanded(false)} />
        <ThankButton r={activeReq} user={user} />
        {latestMeet && <span className="flex items-center gap-2 text-sm text-slate-700"><KIcon name="clock" className="w-4 h-4 text-emerald-700" />Hẹn: {latestMeet.text}</span>}
        <Link to={'/cong-dong/tin/' + room.listingId} className="text-sm font-semibold text-emerald-700 underline">Xem tin</Link>
      </div>}
      {!expanded && needsMe(activeReq, user.id) && <div className="px-3 pb-2.5 -mt-1"><RequestActions r={activeReq} uid={user.id} compact mainOnly /></div>}
    </div>
  );

  /* ---------- Cột chi tiết (máy tính) ---------- */
  const details = room && (
    <aside aria-label="Chi tiết" className="hidden lg:flex flex-col gap-4 w-[320px] shrink-0 border-l border-line bg-white p-5 overflow-y-auto">
      {realImage(room.listingImage)
        ? <img src={room.listingImage} alt="" className="h-40 w-full rounded-2xl object-cover" />
        : <div className="h-40 rounded-2xl bg-emerald-50 text-emerald-700 grid place-items-center"><KIcon name={activeReq?.kind || 'gift'} className="w-16 h-16" strokeWidth={1.3} /></div>}
      <div className="flex flex-col gap-1.5">
        {activeReq && <IntentBadge kind={activeReq.kind} intent={activeReq.intent} className="self-start" />}
        <span className="text-lg font-extrabold leading-snug">{room.listingTitle}</span>
        <Link to={'/cong-dong/tin/' + room.listingId} className="text-sm font-semibold text-emerald-700 underline self-start">Xem tin</Link>
      </div>
      {activeReq ? <>
        <VStepper r={activeReq} uid={user.id} partnerName={partner?.name} />
        <div className="bg-sun-light rounded-[14px] p-3"><RequestActions r={activeReq} uid={user.id} compact /></div>
        <ThankButton r={activeReq} user={user} />
      </> : <p className="text-sm text-slate-600">Chưa có yêu cầu nào cho món này. Bấm "Xin món này" ở trang tin để bắt đầu.</p>}
      {latestMeet && <span className="flex items-center gap-2 text-sm text-slate-700"><KIcon name="clock" className="w-4 h-4 text-emerald-700" />Hẹn: {latestMeet.text}</span>}
      <div className="mt-auto flex flex-col gap-2 text-xs text-slate-600 leading-relaxed">
        <span>Không chuyển khoản hay đặt cọc cho bất kỳ ai. Ưu tiên gặp ở nơi công cộng.</span>
        <button onClick={report} className="self-start underline">Báo cáo cuộc trò chuyện</button>
      </div>
    </aside>
  );

  /* ---------- Khung trò chuyện ---------- */
  const conversation = room ? (
    <main className={(roomId ? 'fixed inset-0 z-[60] md:static md:z-auto' : 'hidden md:flex') + ' flex flex-col flex-1 min-w-0 min-h-0 bg-cream pt-[env(safe-area-inset-top)] md:pt-0'}>
      <header className="flex items-center gap-2.5 px-2 md:px-4 h-16 bg-white border-b border-line shrink-0">
        <Link to="/chat" aria-label="Quay lại" className="md:hidden h-11 w-11 grid place-items-center"><KIcon name="back" className="w-[22px] h-[22px]" /></Link>
        <Avatar p={partner} size={40} />
        <div className="flex-1 min-w-0">
          <div className="text-base font-extrabold truncate">{partner?.name}</div>
          <div className="text-xs text-slate-600 truncate">{room.listingTitle}{activeReq ? ' · ' + kindLabels[activeReq.kind] : ''}</div>
        </div>
        <div className="relative">
          <button onClick={() => setMenu(v => !v)} aria-label="Thêm" aria-expanded={menu} className="h-11 w-11 grid place-items-center rounded-full hover:bg-cream">
            <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
          </button>
          {menu && <div className="absolute right-0 top-12 z-10 w-56 bg-white border border-line rounded-2xl shadow-xl p-1.5 flex flex-col">
            <Link to={'/cong-dong/tin/' + room.listingId} className="px-3 py-2.5 rounded-xl hover:bg-cream text-sm font-semibold">Xem tin</Link>
            <button onClick={report} className="px-3 py-2.5 rounded-xl hover:bg-cream text-sm font-semibold text-left">Báo cáo</button>
            <button onClick={toggleBlock} className="px-3 py-2.5 rounded-xl hover:bg-cream text-sm font-semibold text-left">{blockedIds.includes(room.participantIds?.find(id => id !== user.id) || '') ? 'Bỏ chặn' : 'Chặn người này'}</button>
            <button onClick={removeRoom} className="px-3 py-2.5 rounded-xl hover:bg-cream text-sm font-semibold text-left text-rose-700">Xoá trò chuyện</button>
          </div>}
        </div>
      </header>
      {progress}
      <div className="flex-1 overflow-y-auto px-3.5 md:px-10 py-4 flex flex-col gap-1 overscroll-contain">
        {room.messages?.length ? thread : <p className="self-center text-sm text-slate-600 py-10">Gửi lời chào tới {partner?.name} nhé!</p>}
        <div ref={endRef} />
      </div>
      {blockedIds.includes(room.participantIds?.find(id => id !== user.id) || '') ? <div className="bg-white border-t border-line shrink-0 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] text-center text-sm text-slate-600">
        Bạn đã chặn người này nên không nhắn tin được. <button onClick={toggleBlock} className="underline font-semibold text-emerald-700">Bỏ chặn</button>
      </div> : <>
      {/* Ô soạn: 1 hàng — [+] | ô nhập | micro/gửi */}
      <div className="bg-white border-t border-line shrink-0 px-2.5 pt-2 pb-[max(10px,env(safe-area-inset-bottom))] flex flex-col gap-2">
        {tray === 'none' && !message && <div className="flex gap-2 overflow-x-auto px-0.5">
          {suggestionsFor(activeReq, user.id).map(s => <button key={s} onClick={() => send(s)} className="shrink-0 min-h-[34px] px-3 rounded-full border border-line bg-white text-[13px] font-semibold hover:bg-cream">{s}</button>)}
        </div>}
        {tray === 'menu' && <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setTray('meet')} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-emerald-50 text-emerald-900 text-[13px] font-bold"><KIcon name="clock" className="w-6 h-6 text-emerald-700" />Hẹn giờ & chỗ</button>
          <button onClick={sendZalo} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-cream text-[13px] font-bold"><KIcon name="phone" className="w-6 h-6 text-emerald-700" />Gửi Zalo</button>
          <button onClick={() => fileRef.current?.click()} disabled={sending} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-cream text-[13px] font-bold"><KIcon name="image" className="w-6 h-6 text-emerald-700" />Ảnh</button>
        </div>}
        {tray === 'meet' && <div className="flex flex-col gap-2">
          <span className="text-sm font-bold">Khi nào?</span>
          <div className="flex gap-2 flex-wrap">{MEET_TIMES.map(t => <button key={t} onClick={() => setMeetTime(meetTime === t ? '' : t)} aria-pressed={meetTime === t} className={'min-h-9 px-3 rounded-full border text-[13px] font-semibold ' + (meetTime === t ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-line bg-white')}>{t}</button>)}</div>
          <span className="text-sm font-bold">Ở đâu?</span>
          <div className="flex gap-2 flex-wrap">{MEET_PLACES.map(p => <button key={p} onClick={() => setMeetPlace(meetPlace === p ? '' : p)} aria-pressed={meetPlace === p} className={'min-h-9 px-3 rounded-full border text-[13px] font-semibold ' + (meetPlace === p ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-line bg-white')}>{p}</button>)}</div>
          <button onClick={sendMeet} disabled={!meetTime && !meetPlace} className="min-h-11 rounded-xl bg-emerald-700 text-white font-bold disabled:opacity-50">Gửi đề nghị hẹn</button>
        </div>}
        <form onSubmit={submit} className="flex items-center gap-2">
          <button type="button" onClick={() => setTray(t => t === 'none' ? 'menu' : 'none')} aria-label={tray === 'none' ? 'Hẹn giờ, gửi Zalo, ảnh' : 'Đóng'} aria-expanded={tray !== 'none'}
            className="h-11 w-11 shrink-0 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center">
            <svg className={'w-[22px] h-[22px] transition-transform ' + (tray !== 'none' ? 'rotate-45' : '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <input type="file" ref={fileRef} onChange={sendImage} accept="image/*" className="hidden" />
          <input value={message} onChange={e => setMessage(e.target.value)} onFocus={() => setTray('none')} placeholder={'Nhắn cho ' + (partner?.name || '') + '…'} aria-label="Tin nhắn"
            className="flex-1 min-w-0 h-11 rounded-full border border-line bg-cream px-4 text-[15px] outline-none focus:ring-2 focus:ring-emerald-600" />
          {message.trim()
            ? <button type="submit" disabled={sending} aria-label="Gửi" className="h-11 w-11 shrink-0 rounded-full bg-emerald-700 text-white grid place-items-center disabled:opacity-60"><KIcon name="send" className="w-5 h-5" /></button>
            : <VoiceButton className="h-11 w-11 !bg-emerald-700 !text-white" onText={t => setMessage(m => (m ? m + ' ' : '') + t)} />}
        </form>
      </div>
      </>}
    </main>
  ) : (
    <main className="hidden md:flex flex-1 items-center justify-center bg-cream text-slate-500 flex-col gap-3">
      <img src="/icons/icon-192.png" alt="" className="h-14 w-14 rounded-2xl opacity-80" />
      <p className="font-semibold">Chọn một cuộc trò chuyện để xem</p>
    </main>
  );

  return (
    <div className="md:h-[calc(100vh-68px-3rem)] md:flex md:border md:border-line md:rounded-2xl overflow-hidden bg-white -mx-4 md:mx-0 -mt-3 md:mt-0">
      {inbox}
      {conversation}
      {details}
    </div>
  );
};

export default Chat;
