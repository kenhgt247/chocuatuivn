/**
 * Cloud Functions — Chợ Của Tui (cộng đồng chia sẻ miễn phí).
 * Không có thanh toán. Ba việc chạy trên máy chủ:
 *  1. pushThongBao   : có thông báo mới -> đẩy về điện thoại (FCM).
 *  2. hetHanTin      : mỗi sáng, tin cộng đồng quá 30 ngày -> "hết hạn", báo người đăng gia hạn.
 *  3. diemUyTin      : yêu cầu được cả hai bên xác nhận xong -> cộng 1 lần "đã chia sẻ" cho người trao.
 *  4. kiemDuyetTin   : tin mới -> máy tự kiểm tra chữ + ảnh; ổn thì cho hiện ngay, có vấn đề thì từ chối/giữ lại.
 *  5. baoCaoTin      : tin bị từ 3 người báo cáo -> tự ẩn chờ xem lại.
 */
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions, logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({ maxInstances: 5 });

const SITE = 'https://www.chocuatui.vn';
const EXPIRE_DAYS = 30;

// ---------------------------------------------------------------- 1. Thông báo đẩy
exports.pushThongBao = onDocumentCreated('notifications/{id}', async (event) => {
  const n = event.data && event.data.data();
  if (!n || !n.userId) return;
  const userRef = db.collection('users').doc(n.userId);
  const user = (await userRef.get()).data();
  if (!user || user.notificationsEnabled === false) return;
  // Mỗi máy (điện thoại, máy tính) có một mã riêng: gửi tới tất cả
  const tokens = [...new Set([...(Array.isArray(user.fcmTokens) ? user.fcmTokens : []), user.fcmToken].filter(t => typeof t === 'string' && t))].slice(-10);
  if (!tokens.length) return;

  let badge = 1;
  try {
    const c = await db.collection('notifications').where('userId', '==', n.userId).where('read', '==', false).count().get();
    badge = c.data().count;
  } catch (_) { /* bỏ qua */ }

  const link = typeof n.link === 'string' && n.link.startsWith('/') ? n.link : '/';
  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    // Chỉ gửi "data": service worker (public/sw.js) tự hiện thông báo -> không bị hiện 2 lần
    data: {
      title: String(n.title || 'Chợ Của Tui').slice(0, 120),
      body: String(n.message || '').slice(0, 300),
      link, badge: String(badge), type: String(n.type || 'info'),
    },
    webpush: { headers: { Urgency: 'high', TTL: '86400' } },
  });
  // Máy đã gỡ app hoặc tắt thông báo: xoá mã cũ để không gửi lại
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token' || code === 'messaging/invalid-argument') dead.push(tokens[i]);
    else if (r.error) logger.error('Gửi thông báo đẩy lỗi', r.error);
  });
  logger.info('Thông báo đẩy', { userId: n.userId, may: tokens.length, thanhCong: res.successCount });
  if (dead.length) {
    const upd = { fcmTokens: admin.firestore.FieldValue.arrayRemove(...dead) };
    if (dead.includes(user.fcmToken)) upd.fcmToken = admin.firestore.FieldValue.delete();
    await userRef.update(upd).catch(() => {});
  }
});

// ---------------------------------------------------------------- 2. Tin hết hạn sau 30 ngày
function toMillis(v) {
  if (!v) return 0;
  if (typeof v === 'string') return Date.parse(v) || 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  return 0;
}
exports.hetHanTin = onSchedule({ schedule: 'every day 07:00', timeZone: 'Asia/Ho_Chi_Minh' }, async () => {
  const cutoff = Date.now() - EXPIRE_DAYS * 86400000;
  const snap = await db.collection('listings').where('isCommunityFree', '==', true).where('status', '==', 'approved').get();
  const old = snap.docs.filter(d => Math.max(toMillis(d.get('renewedAt')), toMillis(d.get('createdAt'))) < cutoff);
  for (let i = 0; i < old.length; i += 200) {
    const batch = db.batch();
    for (const d of old.slice(i, i + 200)) {
      batch.update(d.ref, { status: 'expired', expiredAt: admin.firestore.FieldValue.serverTimestamp() });
      batch.set(db.collection('notifications').doc(), {
        userId: d.get('sellerId'),
        title: 'Tin của bạn đã hết hạn',
        message: '"' + String(d.get('title') || '').slice(0, 80) + '" đã hiện ' + EXPIRE_DAYS + ' ngày. Nếu vẫn còn, vào Cá nhân và bấm Gia hạn nhé.',
        type: 'info', link: '/profile', read: false, createdAt: new Date().toISOString(),
      });
    }
    await batch.commit();
  }
  logger.info('Đã cho hết hạn ' + old.length + ' tin');
});

// ---------------------------------------------------------------- 3. Điểm uy tín
// Chỉ tính khi yêu cầu chuyển sang "completed" (bước cuối luôn do bên còn lại xác nhận).
exports.diemUyTin = onDocumentUpdated('communityRequests/{id}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!before || !after || before.status === 'completed' || after.status !== 'completed') return;
  const need = after.intent === 'need';
  const giverId = need ? after.requesterId : after.ownerId;
  const receiverId = need ? after.ownerId : after.requesterId;
  const inc = admin.firestore.FieldValue.increment(1);
  const kind = ['gift', 'borrow', 'help', 'repair'].includes(after.kind) ? after.kind : 'gift';
  await db.collection('publicProfiles').doc(giverId).set({ sharedCount: inc, sharedByKind: { [kind]: inc } }, { merge: true });
  await db.collection('publicProfiles').doc(receiverId).set({ receivedCount: inc }, { merge: true });
});

// ---------------------------------------------------------------- 4. Tự kiểm duyệt tin mới
// Giống Facebook/Zalo: tin ổn thì hiện ngay; có dấu hiệu xấu thì từ chối hoặc giữ lại cho người duyệt.
const TU_CAM = require('./tu-cam.json');
const VISION_MOI_THANG = 3000;       // tối đa số ảnh kiểm tra/tháng (1.000 ảnh đầu miễn phí, sau đó ~1,5 USD/1.000 ảnh)
const TIN_MOI_NGAY = 10;             // quá số tin này trong 24 giờ -> chờ người duyệt
const BUCKET = 'chocuatui-3e65c.firebasestorage.app';

function khongDau(s) {
  return ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9+]+/g, ' ').trim() + ' ';
}
function timTu(text, nhom) {
  const t = khongDau(text);
  for (const [ten, tu] of Object.entries(nhom)) {
    for (const w of tu) if (t.includes(' ' + w + ' ')) return { ten, tu: w };
  }
  return null;
}
function duongDanAnh(url) {
  const m = /\/o\/([^?]+)/.exec(String(url || ''));
  return m ? 'gs://' + BUCKET + '/' + decodeURIComponent(m[1]) : null;
}
const MUC = { UNKNOWN: 0, VERY_UNLIKELY: 1, UNLIKELY: 2, POSSIBLE: 3, LIKELY: 4, VERY_LIKELY: 5 };

/** Kiểm tra ảnh bằng Google Cloud Vision (SafeSearch). Trả về 'tot' | 'xau' | 'nghi' | 'khong-kiem-duoc'. */
async function kiemTraAnh(urls) {
  const anh = urls.map(duongDanAnh).filter(Boolean).slice(0, 4);
  if (!anh.length) return 'tot';
  const thang = new Date().toISOString().slice(0, 7);
  const dem = db.collection('heThong').doc('kiemDuyet-' + thang);
  const daDung = await db.runTransaction(async tx => {
    const n = ((await tx.get(dem)).data() || {}).anh || 0;
    if (n + anh.length > VISION_MOI_THANG) return -1;
    tx.set(dem, { anh: n + anh.length }, { merge: true });
    return n;
  });
  if (daDung < 0) return 'khong-kiem-duoc';
  try {
    const { access_token } = await admin.credential.applicationDefault().getAccessToken();
    const r = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + access_token },
      body: JSON.stringify({ requests: anh.map(u => ({ image: { source: { gcsImageUri: u } }, features: [{ type: 'SAFE_SEARCH_DETECTION' }] })) }),
    });
    if (!r.ok) { logger.warn('Vision lỗi', r.status, await r.text()); return 'khong-kiem-duoc'; }
    const out = (await r.json()).responses || [];
    let kq = 'tot';
    for (const x of out) {
      const s = x.safeSearchAnnotation;
      if (!s) { if (x.error) return 'khong-kiem-duoc'; continue; }
      const a = MUC[s.adult] || 0, racy = MUC[s.racy] || 0, v = MUC[s.violence] || 0;
      if (a >= 5 || v >= 5) return 'xau';
      if (a >= 4 || racy >= 5 || v >= 4) kq = 'nghi';
    }
    return kq;
  } catch (e) { logger.warn('Vision lỗi', e); return 'khong-kiem-duoc'; }
}

async function baoNguoiDang(uid, title, message, link) {
  await db.collection('notifications').add({ userId: uid, title, message, link, type: 'listing', read: false, createdAt: new Date().toISOString() });
}

exports.kiemDuyetTin = onDocumentCreated({ document: 'listings/{id}', memory: '256MiB' }, async (event) => {
  const tin = event.data && event.data.data();
  if (!tin || tin.isCommunityFree !== true || tin.status !== 'pending') return;
  await kiemDuyet(event.data.ref, tin, event.params.id, false);
});

// Tin vừa được chủ tin sửa (status -> pending, editedAt mới): kiểm tra lại như tin mới
exports.kiemDuyetTinSua = onDocumentUpdated({ document: 'listings/{id}', memory: '256MiB' }, async (event) => {
  const truoc = event.data && event.data.before.data();
  const sau = event.data && event.data.after.data();
  if (!sau || sau.isCommunityFree !== true || sau.status !== 'pending' || !sau.editedAt) return;
  if (truoc && truoc.editedAt && truoc.editedAt.isEqual && truoc.editedAt.isEqual(sau.editedAt)) return;
  await kiemDuyet(event.data.after.ref, sau, event.params.id, true);
});

async function kiemDuyet(ref, tin, id, daSua) {
  const chu = [tin.title, tin.description, tin.meetPlace].join(' ');
  const datKetQua = async (status, ly, extra = {}) => {
    await ref.update({ status, kiemDuyet: { luc: new Date().toISOString(), ketQua: status, lyDo: ly || null, may: true }, ...extra });
    logger.info('Kiểm duyệt', { id, status, ly });
  };

  // 1. Từ cấm -> từ chối luôn
  const cam = timTu(chu, TU_CAM.cam);
  if (cam) {
    await datKetQua('rejected', cam.ten, { rejectReason: 'Tin có nội dung không được phép (' + cam.ten.toLowerCase() + ').' });
    await baoNguoiDang(tin.sellerId, 'Tin chưa được đăng', 'Tin "' + String(tin.title).slice(0, 60) + '" có nội dung không được phép (' + cam.ten.toLowerCase() + '). Xem quy tắc cộng đồng.', '/page/quy-tac');
    return;
  }

  // 2. Dấu hiệu cần người xem lại
  const lyDo = [];
  const nghi = timTu(chu, TU_CAM.xemLai);
  if (nghi) lyDo.push(nghi.ten);
  const raw = String(tin.title || '') + ' ' + String(tin.description || '');
  if (/(\+?84|0)[\s.-]?\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}/.test(raw)) lyDo.push('Có số điện thoại trong tin');
  if (/(https?:\/\/|www\.|zalo\.me|t\.me|bit\.ly|\.com\b|\.vn\b)/i.test(raw)) lyDo.push('Có đường link');

  // 3. Người đăng: đăng quá nhiều, đang bị báo cáo
  try {
    const motNgay = new Date(Date.now() - 864e5).toISOString();
    const gan = await db.collection('listings').where('sellerId', '==', tin.sellerId).where('createdAt', '>=', motNgay).count().get();
    if (!daSua && gan.data().count > TIN_MOI_NGAY) lyDo.push('Đăng nhiều tin trong 24 giờ');
  } catch (_) { /* thiếu chỉ mục: bỏ qua bước này */ }
  try {
    const bc = await db.collection('reports').where('targetUserId', '==', tin.sellerId).where('status', '==', 'pending').count().get();
    if (bc.data().count >= 2) lyDo.push('Người đăng đang bị báo cáo');
  } catch (_) { /* bỏ qua */ }

  // 4. Ảnh: dùng ảnh nhỏ cho rẻ
  const anh = (Array.isArray(tin.thumbs) && tin.thumbs.length ? tin.thumbs : tin.images) || [];
  const kqAnh = await kiemTraAnh(anh);
  if (kqAnh === 'xau') {
    await datKetQua('rejected', 'Ảnh không phù hợp', { rejectReason: 'Ảnh trong tin không phù hợp với cộng đồng.' });
    await baoNguoiDang(tin.sellerId, 'Tin chưa được đăng', 'Ảnh trong tin "' + String(tin.title).slice(0, 60) + '" không phù hợp. Bạn đăng lại với ảnh khác nhé.', '/profile');
    return;
  }
  if (kqAnh === 'nghi') lyDo.push('Ảnh cần xem lại');
  if (kqAnh === 'khong-kiem-duoc' && anh.length) {
    // Không kiểm được ảnh: chỉ cho hiện ngay với người đã có uy tín
    const pp = (await db.collection('publicProfiles').doc(tin.sellerId).get()).data() || {};
    if ((pp.sharedCount || 0) < 3) lyDo.push('Chưa kiểm tra được ảnh');
  }

  if (lyDo.length) {
    await datKetQua('pending', lyDo.join(', '));
    await baoNguoiDang(tin.sellerId, 'Tin đang chờ duyệt', 'Tin "' + String(tin.title).slice(0, 60) + '" cần người duyệt xem qua (thường trong ngày).', '/profile');
    return;
  }
  await datKetQua('approved', null, { approvedAt: new Date().toISOString() });
}

// ---------------------------------------------------------------- 5. Báo cáo: đủ 3 người -> tạm ẩn
exports.baoCaoTin = onDocumentCreated('reports/{id}', async (event) => {
  const r = event.data && event.data.data();
  if (!r || !r.listingId) return;
  const ds = await db.collection('reports').where('listingId', '==', r.listingId).limit(50).get();
  const nguoi = new Set(ds.docs.map(d => d.data().userId).filter(Boolean));
  if (nguoi.size < 3) return;
  const ref = db.collection('listings').doc(r.listingId);
  const tin = (await ref.get()).data();
  if (!tin || tin.status !== 'approved') return;
  await ref.update({ status: 'pending', kiemDuyet: { luc: new Date().toISOString(), ketQua: 'pending', lyDo: 'Bị ' + nguoi.size + ' người báo cáo', may: true } });
  await baoNguoiDang(tin.sellerId, 'Tin tạm ẩn', 'Tin "' + String(tin.title).slice(0, 60) + '" bị nhiều người báo cáo nên tạm ẩn để xem lại.', '/profile');
});
