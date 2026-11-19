/**
 * Cloud Functions — Chợ Của Tui (cộng đồng chia sẻ miễn phí).
 * Không có thanh toán. Ba việc chạy trên máy chủ:
 *  1. pushThongBao   : có thông báo mới -> đẩy về điện thoại (FCM).
 *  2. hetHanTin      : mỗi sáng, tin cộng đồng quá 30 ngày -> "hết hạn", báo người đăng gia hạn.
 *  3. diemUyTin      : yêu cầu được cả hai bên xác nhận xong -> cộng 1 lần "đã chia sẻ" cho người trao.
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
  const token = user && user.fcmToken;
  if (!token || user.notificationsEnabled === false) return;

  let badge = 1;
  try {
    const c = await db.collection('notifications').where('userId', '==', n.userId).where('read', '==', false).count().get();
    badge = c.data().count;
  } catch (_) { /* bỏ qua */ }

  const link = typeof n.link === 'string' && n.link.startsWith('/') ? n.link : '/';
  try {
    await admin.messaging().send({
      token,
      // Chỉ gửi "data": service worker (public/sw.js) tự hiện thông báo -> không bị hiện 2 lần
      data: {
        title: String(n.title || 'Chợ Của Tui').slice(0, 120),
        body: String(n.message || '').slice(0, 300),
        link, badge: String(badge), type: String(n.type || 'info'),
      },
      webpush: { headers: { Urgency: 'high', TTL: '86400' } },
    });
  } catch (err) {
    // Máy đã gỡ app hoặc tắt thông báo: xoá mã cũ để không gửi lại
    const code = err && err.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
      await userRef.update({ fcmToken: admin.firestore.FieldValue.delete() }).catch(() => {});
    } else {
      logger.error('Gửi thông báo đẩy lỗi', err);
    }
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
  await db.collection('publicProfiles').doc(giverId).set({ sharedCount: inc }, { merge: true });
  await db.collection('publicProfiles').doc(receiverId).set({ receivedCount: inc }, { merge: true });
});
