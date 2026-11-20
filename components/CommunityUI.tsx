/**
 * Thành phần giao diện dùng chung cho cộng đồng: biểu tượng, thanh tiến trình,
 * nút xác nhận theo vai trò, nhắc an toàn, nút nói thay gõ.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  community, nextStatuses, actionLabel, waitingText, roles,
  type CommunityKind, type CommunityIntent, type CommunityRequest, type CommunityStatus, type SafetyNote
} from '../services/community';

const PATHS: Record<string, React.ReactNode> = {
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" /></>,
  borrow: <><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>,
  help: <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />,
  repair: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" />,
  map: <><path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3z" /><path d="M9 3v15M15 6v15" /></>,
  bookmark: <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  back: <path d="m15 18-6-6 6-6" />,
  camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3" /></>,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  locate: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
};
export type IconName = keyof typeof PATHS;
export const KIcon: React.FC<{ name: string; className?: string; strokeWidth?: number }> = ({ name, className = 'w-6 h-6', strokeWidth = 2 }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name]}</svg>
);

/** Tên hoạt động theo chiều Tôi có / Tôi cần, màu nền ảnh minh hoạ. */
export const KIND_META: Record<CommunityKind, { have: string; need: string; tint: string }> = {
  gift: { have: 'Cho tặng', need: 'Xin đồ', tint: 'bg-[#E3EEE6]' },
  borrow: { have: 'Cho mượn', need: 'Mượn đồ', tint: 'bg-[#E6E9EE]' },
  help: { have: 'Giúp một tay', need: 'Nhờ giúp', tint: 'bg-[#F7E4D8]' },
  repair: { have: 'Sửa giúp', need: 'Cần sửa', tint: 'bg-[#F4EAD5]' },
};
export function kindText(kind: CommunityKind, intent?: CommunityIntent) {
  return KIND_META[kind][intent === 'need' ? 'need' : 'have'];
}
export const IntentBadge: React.FC<{ kind: CommunityKind; intent?: CommunityIntent; className?: string }> = ({ kind, intent, className = '' }) => (
  <span className={'inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ' + (intent === 'need' ? 'bg-sun-light text-sun-dark' : 'bg-emerald-50 text-emerald-900') + ' ' + className}>
    {intent === 'need' ? 'Tôi cần' : 'Tôi có'} · {kindText(kind, intent)}
  </span>
);

const STEP_NAMES: Record<CommunityKind, string[]> = {
  gift: ['Xin', 'Đồng ý', 'Đã trao', 'Đã nhận'],
  borrow: ['Xin', 'Đồng ý', 'Đã giao', 'Đã trả', 'Nhận lại'],
  help: ['Nhờ', 'Đồng ý', 'Đã giúp', 'Xác nhận'],
  repair: ['Nhờ', 'Đồng ý', 'Đã sửa', 'Xác nhận'],
};
/** Thanh tiến trình: ✓ Xin — ✓ Đồng ý — Đã trao — Đã nhận */
export function Steps({ r }: { r: CommunityRequest }) {
  if (r.status === 'declined' || r.status === 'cancelled') return null;
  const order = r.kind === 'borrow' ? ['requested', 'accepted', 'handed_over', 'returned', 'completed'] : ['requested', 'accepted', 'handed_over', 'completed'];
  const at = order.indexOf(r.status);
  const names = STEP_NAMES[r.kind];
  return <ol className="flex items-center gap-1.5" aria-label="Tiến trình">{names.map((name, i) => (
    <li key={name} className={'flex items-center gap-1.5 ' + (i < names.length - 1 ? 'flex-1' : '')}>
      <span className={'flex items-center gap-1 text-xs font-bold whitespace-nowrap ' + (i <= at ? 'text-emerald-700' : 'text-slate-500')}>
        {i <= at
          ? <span className="h-[18px] w-[18px] rounded-full bg-emerald-700 grid place-items-center text-white"><KIcon name="check" className="w-3 h-3" strokeWidth={3} /></span>
          : <span className="h-4 w-4 rounded-full border-2 border-sun" />}
        {name}
      </span>
      {i < names.length - 1 && <span className={'flex-1 h-0.5 min-w-2 ' + (i < at ? 'bg-emerald-700' : 'bg-line')} />}
    </li>))}</ol>;
}

/** Các nút chuyển bước theo vai trò, có hỏi lại trước bước xác nhận. */
export function RequestActions({ r, uid, onDone, compact, mainOnly, onAccepted }: { r: CommunityRequest; uid: string; onDone?: () => void; compact?: boolean; mainOnly?: boolean; onAccepted?: (r: CommunityRequest) => void }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const next = nextStatuses(r, uid);
  async function go(status: CommunityStatus) {
    if ((status === 'completed' || status === 'handed_over' || status === 'returned') && !window.confirm(actionLabel(r, status) + '?\nChỉ bấm khi việc này đã thật sự diễn ra.')) return;
    if (status === 'cancelled' && r.status === 'accepted' && !window.confirm('Hủy việc đã được đồng ý?')) return;
    setWorking(true); setError('');
    try {
      await community.updateStatus(r, status); if (status === 'accepted') onAccepted?.(r); onDone?.();
      // Người nhận vừa xác nhận xong: mời gửi lời cảm ơn ngay
      if (status === 'completed') window.dispatchEvent(new CustomEvent('ccut-cam-on', { detail: { ...r, status: 'completed' } }));
    }
    catch (e: any) { setError(e?.message || 'Chưa cập nhật được, thử lại nhé.'); }
    finally { setWorking(false); }
  }
  const main = next.filter(s => s !== 'declined' && s !== 'cancelled');
  const minor = mainOnly ? [] : next.filter(s => s === 'declined' || s === 'cancelled');
  return <div className="space-y-2">
    {!mainOnly && waitingText(r, uid) && <p className="text-sm leading-snug">{waitingText(r, uid)}</p>}
    {main.map(s => <button key={s} disabled={working} onClick={() => go(s)}
      className={'w-full rounded-[14px] bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold disabled:opacity-60 ' + (compact ? 'min-h-12 text-base' : 'min-h-[52px] text-base')}>{actionLabel(r, s)}</button>)}
    {minor.length > 0 && <div className="flex gap-3 justify-center">{minor.map(s =>
      <button key={s} disabled={working} onClick={() => go(s)} className="text-sm font-semibold text-slate-600 underline min-h-9">{actionLabel(r, s)}</button>)}</div>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </div>;
}

export function SafetyBox({ notes }: { notes: SafetyNote[] }) {
  if (!notes.length) return null;
  return <div className="space-y-2">{notes.map(n =>
    <div key={n.title} role="note" className={'flex gap-2 rounded-xl p-3 text-sm border ' + (n.level === 'block' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-sun-light border-amber-200 text-[#4A3200]')}>
      <KIcon name="alert" className="w-5 h-5 shrink-0 mt-0.5" />
      <span><b>{n.title}.</b> {n.text}</span>
    </div>)}</div>;
}

/** Nói thay vì gõ (Chrome/Android hỗ trợ tiếng Việt). Không hỗ trợ thì không hiện nút. */
export function VoiceButton({ onText, className = '', label }: { onText: (t: string) => void; className?: string; label?: string }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  // @ts-ignore
  const Rec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  useEffect(() => () => { try { recRef.current?.stop(); } catch (_) { /* bỏ qua */ } }, []);
  if (!Rec) return null;
  function start() {
    try {
      const rec = new Rec();
      rec.lang = 'vi-VN'; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript; if (t) onText(t); };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec; setListening(true); rec.start();
    } catch (_) { setListening(false); }
  }
  return <button type="button" onClick={listening ? () => recRef.current?.stop() : start}
    aria-label={listening ? 'Đang nghe, bấm để dừng' : 'Nói thay vì gõ'}
    className={(label ? 'flex items-center justify-center font-bold ' : 'grid place-items-center ') + 'rounded-full shrink-0 ' + (listening ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-50 text-emerald-700') + ' ' + className}>
    <KIcon name="mic" className="w-5 h-5" />{label && <span className="ml-2">{listening ? 'Đang nghe… nói đi bạn' : label}</span>}
  </button>;
}

/* ---------- Tiến trình chi tiết (dùng trong chat) ---------- */
export type StepState = 'done' | 'now' | 'next';
/** Các giai đoạn của một yêu cầu, kèm ai làm và trạng thái từng bước. */
export function stepsFor(r: CommunityRequest, uid: string, partnerName = 'Bên kia') {
  const { giverId, receiverId } = roles(r);
  const who = (id: string) => (id === uid ? 'Bạn' : partnerName);
  const hand = ({ gift: 'trao đồ', borrow: 'giao đồ cho mượn', help: 'giúp xong', repair: 'sửa xong' } as const)[r.kind];
  const steps: { key: CommunityStatus; label: string }[] = [
    { key: 'requested', label: who(r.requesterId) + ' gửi yêu cầu' },
    { key: 'accepted', label: who(r.ownerId) + ' đồng ý' },
    { key: 'handed_over', label: who(giverId) + ' ' + hand },
  ];
  if (r.kind === 'borrow') {
    steps.push({ key: 'returned', label: who(receiverId) + ' trả đồ' });
    steps.push({ key: 'completed', label: who(giverId) + ' xác nhận đã nhận lại' });
  } else {
    steps.push({ key: 'completed', label: who(receiverId) + ' xác nhận ' + (r.kind === 'gift' ? 'đã nhận đồ' : 'hoàn thành') });
  }
  const at = steps.findIndex(s => s.key === r.status);
  const closed = r.status === 'declined' || r.status === 'cancelled';
  return steps.map((s, i) => ({ ...s, state: (closed ? (i === 0 ? 'done' : 'next') : i <= at ? 'done' : i === at + 1 ? 'now' : 'next') as StepState }));
}
/** "Bước 3/4 · Chị Lan trao đồ" — tóm tắt một dòng cho dải tiến trình. */
export function stepSummary(r: CommunityRequest, uid: string, partnerName?: string) {
  if (r.status === 'declined') return 'Yêu cầu đã bị từ chối';
  if (r.status === 'cancelled') return 'Yêu cầu đã hủy';
  const steps = stepsFor(r, uid, partnerName);
  if (r.status === 'completed') return 'Hoàn thành · cả hai bên đã xác nhận';
  const i = steps.findIndex(s => s.state === 'now');
  return 'Bước ' + (i + 1) + '/' + steps.length + ' · ' + steps[i].label;
}
/** Có việc gì đến lượt người này làm không (trừ hủy/từ chối). */
export function needsMe(r: CommunityRequest, uid: string) {
  return nextStatuses(r, uid).some(s => s !== 'declined' && s !== 'cancelled');
}
/** Nhãn trạng thái trong hộp thư. */
export function chipFor(r: CommunityRequest, uid: string): { text: string; tone: 'todo' | 'ok' | 'done' } {
  if (r.status === 'completed') return { text: 'Hoàn thành', tone: 'done' };
  if (r.status === 'declined' || r.status === 'cancelled') return { text: r.status === 'declined' ? 'Đã từ chối' : 'Đã hủy', tone: 'done' };
  if (needsMe(r, uid)) {
    const s = nextStatuses(r, uid).find(x => x !== 'declined' && x !== 'cancelled')!;
    const t = s === 'accepted' ? 'Chờ bạn đồng ý' : s === 'handed_over' ? 'Đến lượt bạn: ' + actionLabel(r, s).replace('Tôi ', '').toLowerCase() : 'Chờ bạn xác nhận';
    return { text: t, tone: 'todo' };
  }
  if (r.status === 'requested') return { text: 'Chờ trả lời', tone: 'ok' };
  if (r.status === 'accepted') return { text: 'Đã đồng ý · hẹn gặp', tone: 'ok' };
  if (r.kind === 'borrow' && r.status === 'handed_over') return { text: 'Đang mượn', tone: 'ok' };
  return { text: 'Chờ bên kia xác nhận', tone: 'ok' };
}
export const ChipBadge: React.FC<{ chip: { text: string; tone: 'todo' | 'ok' | 'done' } }> = ({ chip }) => (
  <span className={'inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ' + (chip.tone === 'todo' ? 'bg-sun-light text-sun-dark' : chip.tone === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-[#EFEDE6] text-slate-600')}>{chip.text}</span>
);
/** Danh sách giai đoạn dạng dọc: đã xong / đang tới / còn lại. */
export function VStepper({ r, uid, partnerName }: { r: CommunityRequest; uid: string; partnerName?: string }) {
  const steps = stepsFor(r, uid, partnerName);
  return <ol className="flex flex-col" aria-label="Các giai đoạn">{steps.map((s, i) => (
    <li key={s.key} className="flex gap-3">
      <span className="flex flex-col items-center">
        {s.state === 'done'
          ? <span className="h-[22px] w-[22px] rounded-full bg-emerald-700 text-white grid place-items-center"><KIcon name="check" className="w-3 h-3" strokeWidth={3} /></span>
          : s.state === 'now' ? <span className="h-[22px] w-[22px] rounded-full border-[3px] border-sun bg-white" />
          : <span className="h-[22px] w-[22px] rounded-full border-2 border-line bg-white" />}
        {i < steps.length - 1 && <span className={'w-0.5 flex-1 min-h-4 ' + (s.state === 'done' ? 'bg-emerald-700' : 'bg-line')} />}
      </span>
      <span className={'pb-3 text-sm leading-[22px] ' + (s.state === 'now' ? 'font-extrabold text-ink' : s.state === 'done' ? 'font-semibold text-ink' : 'text-slate-500')}>
        {s.label}{s.state === 'now' && <span className="ml-2 text-[11px] font-bold text-sun-dark bg-sun-light rounded-full px-2 py-0.5">{nextStatuses(r, uid).some(x => x !== 'declined' && x !== 'cancelled') ? 'Đến lượt bạn' : 'Đang chờ'}</span>}
      </span>
    </li>))}</ol>;
}
/** 2 câu trả lời nhanh hợp với bước hiện tại. */
export function suggestionsFor(r: CommunityRequest | null, uid: string): string[] {
  if (!r) return ['Món này còn không ạ?', 'Khi nào mình qua được ạ?'];
  const mineListing = r.ownerId === uid;
  switch (r.status) {
    case 'requested': return mineListing ? ['Còn bạn nhé!', 'Bạn qua lúc nào được?'] : ['Món này còn không ạ?', 'Khi nào mình qua được ạ?'];
    case 'accepted': return ['Mình đang tới nhé', 'Hẹn giờ khác được không ạ?'];
    case 'handed_over': return roles(r).receiverId === uid ? ['Mình nhận được rồi ạ', 'Cảm ơn bạn nhiều!'] : ['Bạn nhận được chưa?', 'Có gì cứ nhắn mình nhé'];
    case 'returned': return ['Mình trả rồi nhé', 'Cảm ơn đã cho mượn!'];
    case 'completed': return ['Cảm ơn bạn nhiều!', 'Chúc bạn một ngày vui'];
    default: return ['Cảm ơn bạn!', 'Hẹn dịp khác nhé'];
  }
}
