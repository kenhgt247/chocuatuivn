import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
const cors = require("cors")({ origin: true });
const PayOS = require("@payos/node"); 

admin.initializeApp();

// ==========================================
// 1. LOGIC THÔNG BÁO (GIỮ NGUYÊN TỪ CODE CŨ CỦA BẠN)
// ==========================================
export const onNotificationCreated = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snapshot: any, context: any) => {
    const notifData = snapshot.data();
    const userId = notifData.userId;

    if (!userId) return;

    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    const userData = userDoc.data();
    const fcmToken = userData?.fcmToken;

    if (!fcmToken) return;

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
      data: {
        link: notifData.link || "/",
        badge: badgeCount.toString(),
        type: notifData.type || "system"
      },
      android: {
        notification: {
          icon: "ic_stat_name",
          color: "#0066CC",
          clickAction: "FLUTTER_NOTIFICATION_CLICK"
        }
      },
      webpush: {
        headers: { Urgency: "high" },
        fcmOptions: { link: notifData.link || "/" }
      }
    };

    try {
      await admin.messaging().send(messagePayload as any);
    } catch (error) {
      console.error("❌ Lỗi bắn thông báo:", error);
    }
  });

// ==========================================
// 2. LOGIC PAYOS (QUAN TRỌNG: KEY CỨNG Ở ĐÂY)
// ==========================================

export const createPaymentLink = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    try {
      console.log("🚀 ĐANG TẠO LINK (TYPESCRIPT VERSION)...");

      // [QUAN TRỌNG] KHỞI TẠO TRỰC TIẾP
      const payOS = new PayOS(
        "1e9b451c-ce1c-4721-9b48-244f0220ea6e", // Client ID
        "a478c434-c81c-43fb-ad44-c9026cf3ba05", // API Key
        "8ce6d2273462dfe8072bcffd8da664ab70d798b6608023bde7ed58ff6739d071" // Checksum Key
      );

      const { amount, description, userId } = req.body;
      const orderCode = Number(String(Date.now()).slice(-10));
      
      const paymentData = {
        orderCode: orderCode,
        amount: Number(amount),
        description: "Nap tien",
        cancelUrl: "https://chocuatui.vn/wallet",
        returnUrl: "https://chocuatui.vn/wallet",
      };

      const result = await payOS.createPaymentLink(paymentData);
      
      // Data có thể nằm trong result hoặc result.data tùy phiên bản, lấy cả 2 cho chắc
      const finalResult = result.data || result;

      // Lưu DB
      await admin.firestore().collection("transactions").add({
        userId: userId || "guest",
        orderCode: orderCode,
        amount: Number(amount),
        status: "pending",
        type: "deposit",
        createdAt: new Date().toISOString(),
        paymentLinkId: finalResult.paymentLinkId,
        checkoutUrl: finalResult.checkoutUrl
      });

      res.json(finalResult);

    } catch (error: any) {
      console.error("❌ Lỗi PayOS:", error);
      res.status(500).json({ error: error.message });
    }
  });
});

export const handlePayOSWebhook = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            // Khởi tạo lại Key cứng trong Webhook
            const payOS = new PayOS(
                "1e9b451c-ce1c-4721-9b48-244f0220ea6e",
                "a478c434-c81c-43fb-ad44-c9026cf3ba05",
                "8ce6d2273462dfe8072bcffd8da664ab70d798b6608023bde7ed58ff6739d071"
            );
            
            const webhookData = payOS.verifyPaymentWebhookData(req.body);

            if (webhookData.code === "00" && webhookData.data) {
                const { orderCode, amount } = webhookData.data;
                const snapshot = await admin.firestore().collection("transactions")
                    .where("orderCode", "==", orderCode)
                    .where("status", "==", "pending")
                    .limit(1)
                    .get();

                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    await admin.firestore().runTransaction(async (t) => {
                        const userRef = admin.firestore().collection("users").doc(doc.data().userId);
                        const userDoc = await t.get(userRef);
                        const currentBalance = (userDoc.exists && userDoc.data()?.walletBalance) ? userDoc.data()?.walletBalance : 0;
                        
                        t.update(userRef, { walletBalance: currentBalance + amount });
                        t.update(doc.ref, { status: "success", webhookTime: admin.firestore.FieldValue.serverTimestamp() });
                    });
                }
            }
            res.json({ success: true });
        } catch (e) {
            console.error(e);
            res.json({ success: false });
        }
    });
});