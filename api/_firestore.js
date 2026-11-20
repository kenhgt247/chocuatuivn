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

function toValue(v) {
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { stringValue: String(v) };
}
async function runQuery(structuredQuery) {
  const r = await fetch(`${BASE}:runQuery?key=${API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ structuredQuery }) });
  if (!r.ok) { const e = new Error('firestore ' + r.status); e.status = r.status; throw e; }
  const rows = await r.json();
  return rows.filter(x => x.document).map(x => ({ id: x.document.name.split('/').pop(), ...fields(x.document.fields) }));
}

/**
 * Tin cộng đồng đang hiện, mới nhất trước, có lọc theo khu vực / từ khoá và phân trang.
 * eq: { provinceCode: '31' } ; contains: 'xe' (một từ trong keywords) ; before: createdAt của tin cuối trang trước.
 * Chưa có chỉ mục (lỗi 400) -> lấy không sắp xếp rồi lọc/sắp xếp tại đây.
 */
export async function listCommunity({ eq = {}, contains = null, before = null, max = 24, status = 'approved' } = {}) {
  const filters = [
    { fieldFilter: { field: { fieldPath: 'isCommunityFree' }, op: 'EQUAL', value: { booleanValue: true } } },
    { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: status } } },
    ...Object.entries(eq).map(([k, v]) => ({ fieldFilter: { field: { fieldPath: k }, op: 'EQUAL', value: toValue(v) } })),
  ];
  if (contains) filters.push({ fieldFilter: { field: { fieldPath: 'keywords' }, op: 'ARRAY_CONTAINS', value: { stringValue: contains } } });
  const where = { compositeFilter: { op: 'AND', filters } };
  const from = [{ collectionId: 'listings' }];
  try {
    const q = { from, where, orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }], limit: max };
    if (before) q.startAt = { values: [{ stringValue: before }], before: false };
    return await runQuery(q);
  } catch (e) {
    if (e.status !== 400) throw e;
    const rows = await runQuery({ from, where, limit: 400 });
    return rows
      .filter(x => !before || String(x.createdAt || '') < before)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, max);
  }
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

/** Đếm tin cộng đồng theo điều kiện bằng (không tải từng tin). */
export async function countCommunity(eq) {
  const filters = [{ fieldFilter: { field: { fieldPath: 'isCommunityFree' }, op: 'EQUAL', value: { booleanValue: true } } },
    ...Object.entries(eq).map(([k, v]) => ({ fieldFilter: { field: { fieldPath: k }, op: 'EQUAL', value: { stringValue: String(v) } } }))];
  const body = { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'listings' }], where: { compositeFilter: { op: 'AND', filters } } }, aggregations: [{ alias: 'n', count: {} }] } };
  const r = await fetch(`${BASE}:runAggregationQuery?key=${API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('firestore ' + r.status);
  const out = await r.json();
  return Number(out?.[0]?.result?.aggregateFields?.n?.integerValue || 0);
}

/** Đếm số tài liệu trong một bảng công khai (vd: publicProfiles). */
export async function countCollection(collectionId) {
  const body = { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId }] }, aggregations: [{ alias: 'n', count: {} }] } };
  const r = await fetch(`${BASE}:runAggregationQuery?key=${API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('firestore ' + r.status);
  const out = await r.json();
  return Number(out?.[0]?.result?.aggregateFields?.n?.integerValue || 0);
}

/** Tin trong một xã/phường theo trạng thái (không sắp xếp, đủ để thống kê). */
export async function listByArea(areaCode, status, max = 300) {
  const filters = [
    { fieldFilter: { field: { fieldPath: 'isCommunityFree' }, op: 'EQUAL', value: { booleanValue: true } } },
    { fieldFilter: { field: { fieldPath: 'areaCode' }, op: 'EQUAL', value: { stringValue: areaCode } } },
    { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: status } } },
  ];
  const r = await fetch(`${BASE}:runQuery?key=${API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'listings' }], where: { compositeFilter: { op: 'AND', filters } },
      select: { fields: [{ fieldPath: 'sellerId' }, { fieldPath: 'sellerName' }] }, limit: max } }) });
  if (!r.ok) throw new Error('firestore ' + r.status);
  const rows = await r.json();
  return rows.filter(x => x.document).map(x => fields(x.document.fields || {}));
}

/** Truy vấn tự do (chỉ đọc dữ liệu công khai theo quy tắc bảo mật). */
export async function queryDocs(structuredQuery) {
  return runQuery(structuredQuery);
}
/** Đọc nhiều tài liệu một lượt: paths dạng "publicProfiles/<uid>". */
export async function getMany(paths) {
  if (!paths.length) return {};
  const r = await fetch(`${BASE}:batchGet?key=${API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ documents: paths.map(p => `projects/${PROJECT}/databases/(default)/documents/${p}`) }) });
  if (!r.ok) return {};
  const out = {};
  for (const x of await r.json()) if (x.found) out[x.found.name.split('/').slice(-2).join('/')] = fields(x.found.fields);
  return out;
}
