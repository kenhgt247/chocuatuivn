// Đọc dữ liệu công khai từ Firestore qua REST (không cần đăng nhập).
// Quy tắc bảo mật chỉ cho đọc tin cộng đồng (isCommunityFree == true).
export const PROJECT = 'chocuatui-3e65c';
// Khóa web công khai của Firebase (giống trong code trình duyệt), không phải khóa bí mật.
export const API_KEY = 'AIzaSyD-kdwqMhAuddGMZRXMkQgbXIt4qukKObo';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function val(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) return fields(v.mapValue.fields || {});
  return undefined;
}
function fields(f) {
  const o = {};
  for (const k of Object.keys(f || {})) o[k] = val(f[k]);
  return o;
}

export async function getListing(id) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(id || '')) return null;
  const r = await fetch(`${BASE}/listings/${id}?key=${API_KEY}`);
  if (!r.ok) return null;
  const d = await r.json();
  return { id, ...fields(d.fields) };
}

/** Tin cộng đồng đang hiện, mới nhất trước. Cần chỉ mục (isCommunityFree, status, createdAt);
 *  chưa có chỉ mục thì tự lùi về truy vấn không sắp xếp. */
export async function listNewest(max = 200) {
  const where = { compositeFilter: { op: 'AND', filters: [
    { fieldFilter: { field: { fieldPath: 'isCommunityFree' }, op: 'EQUAL', value: { booleanValue: true } } },
    { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'approved' } } },
  ] } };
  const body = { structuredQuery: { from: [{ collectionId: 'listings' }], where,
    orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }], limit: max } };
  const r = await fetch(`${BASE}:runQuery?key=${API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) {
    // Chưa có chỉ mục sắp xếp: lấy không sắp xếp
    const r2 = await fetch(`${BASE}:runQuery?key=${API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'listings' }], where, limit: 300 } }) });
    if (!r2.ok) throw new Error('firestore ' + r2.status);
    const rows2 = await r2.json();
    return rows2.filter(x => x.document).map(x => ({ id: x.document.name.split('/').pop(), ...fields(x.document.fields) }));
  }
  const rows = await r.json();
  return rows.filter(x => x.document).map(x => ({ id: x.document.name.split('/').pop(), ...fields(x.document.fields) }));
}

export async function listApproved(max = 1000) {
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'listings' }],
      where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: 'isCommunityFree' }, op: 'EQUAL', value: { booleanValue: true } } },
        { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'approved' } } },
      ] } },
      limit: max,
    },
  };
  const r = await fetch(`${BASE}:runQuery?key=${API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) return [];
  const rows = await r.json();
  return rows.filter(x => x.document).map(x => ({ id: x.document.name.split('/').pop(), ...fields(x.document.fields) }));
}

// Giống utils/format.ts: bỏ dấu, chữ thường, nối bằng "-"
export function slugify(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim().replace(/\s+/g, '-');
}
export function tinPath(l) {
  const s = slugify(l.title || 'tin');
  return `/cong-dong/tin/${s ? s + '-' : ''}${l.id}`;
}
export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function origin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.chocuatui.vn';
  return `https://${host}`;
}
