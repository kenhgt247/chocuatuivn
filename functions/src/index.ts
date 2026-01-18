import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

// Hàm này tự động chạy khi có một document mới được tạo trong collection "notifications"
export const onNotificationCreated = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snapshot, context) => {
    // 1. Lấy dữ liệu thông báo vừa được lưu
    const notifData = snapshot.data();
    const userId = notifData.userId;

    if (!userId) {
      console.log("Không tìm thấy userId trong thông báo");
      return;
    }

    // 2. Tìm User để lấy cái "Token" (địa chỉ gửi thư)
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    const userData = userDoc.data();
    const fcmToken = userData?.fcmToken; // Token này được lưu lúc user login (trong Layout.tsx)

    if (!fcmToken) {
      console.log(`User ${userId} chưa đăng ký nhận thông báo (thiếu fcmToken).`);
      return;
    }

    // 3. Chuẩn bị nội dung tin nhắn để bắn sang Google
    // Logic đếm số tin nhắn chưa đọc để hiện chấm đỏ (Badge)
    let badgeCount = 1;
    try {
        const unreadQuery = await admin.firestore().collection("notifications")
            .where("userId", "==", userId)
            .where("read", "==", false)
            .count()
            .get();
        badgeCount = unreadQuery.data().count;
    } catch (e) { console.error(e); }

    const messagePayload = {
      token: fcmToken,
      notification: {
        title: notifData.title || "Thông báo mới",
        body: notifData.message || "Bạn có tin nhắn mới từ Chợ của tui",
      },
      // Dữ liệu ngầm để Service Worker xử lý (mở link, hiện chấm đỏ)
      data: {
        link: notifData.link || "/",
        badge: badgeCount.toString(),
        type: notifData.type || "system"
      },
      // Cấu hình riêng cho Android
      android: {
        notification: {
          icon: "ic_stat_name", // Tên icon trong folder res/drawable (nếu làm app native)
          color: "#0066CC", // Màu xanh chủ đạo của bạn
          clickAction: "FLUTTER_NOTIFICATION_CLICK" // Hỗ trợ mở app
        }
      },
      // Cấu hình riêng cho Web Push
      webpush: {
        headers: {
          Urgency: "high"
        },
        fcmOptions: {
          link: notifData.link || "/"
        }
      }
    };

    // 4. Bắn tin nhắn đi!
    try {
      const response = await admin.messaging().send(messagePayload);
      console.log("✅ Đã bắn thông báo thành công:", response);
      return { success: true };
    } catch (error) {
      console.error("❌ Lỗi khi bắn thông báo:", error);
      return { success: false };
    }
  });
