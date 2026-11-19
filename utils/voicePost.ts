/** Hiểu câu nói khi đăng tin bằng giọng nói: "Tôi có xe đạp trẻ em cho tặng", "Tôi cần mượn thang nhôm"… */
import type { CommunityIntent, CommunityKind } from '../services/community';

const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

export function parseVoicePost(raw: string): { intent?: CommunityIntent; kind?: CommunityKind; title: string } {
  let t = raw.trim().replace(/\s+/g, ' ');
  const p = plain(t);
  let intent: CommunityIntent | undefined;
  if (/\b(toi|minh|em|anh|chi) (dang )?can\b|\bcan (xin|muon|nguoi|ai|giup|nho|sua)\b|\bxin\b|\bnho (ai|nguoi|giup)\b/.test(p)) intent = 'need';
  if (/\b(toi|minh|em|anh|chi) (dang )?co\b|\bcho tang\b|\btang\b|\bcho muon\b|\bthanh ly mien phi\b|\bgiup duoc\b|\bsua giup\b/.test(p)) intent = intent === 'need' && /\bcho (tang|muon)\b/.test(p) ? 'have' : intent || 'have';
  let kind: CommunityKind | undefined;
  if (/\bmuon\b/.test(p)) kind = 'borrow';
  else if (/\bsua\b/.test(p)) kind = 'repair';
  else if (/\b(giup|nho|khuan|cho di|don|day|chi cach)\b/.test(p)) kind = 'help';
  else if (/\b(tang|cho|xin|thanh ly)\b/.test(p)) kind = 'gift';
  // Bỏ các cụm mở đầu/kết thúc, giữ phần tên món đồ / việc
  const lead = /^(xin chao |chao )?((toi|minh|em|anh|chi|nha minh|nha toi) )?(dang )?(co|can|muon|xin|nho|cho tang|cho muon|tang)( (cho tang|tang|cho muon|muon|xin|nguoi|ai|giup|sua|mot|1))*\s*/;
  const m = lead.exec(p);
  if (m && m[0].length) t = t.slice(m[0].length);
  const tail = /\s*(de |can |muon )?(cho tang|tang|cho muon|cho|mien phi|nhe|a|voi|giup|giup voi|giup minh|giup toi)$/;
  for (let i = 0; i < 3; i++) { const q = plain(t); const n = tail.exec(q); if (!n || !n[0].trim()) break; t = t.slice(0, t.length - n[0].length); }
  t = t.trim().replace(/[.,!?]+$/, '');
  if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
  return { intent, kind, title: t.slice(0, 90) };
}
