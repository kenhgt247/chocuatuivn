const functions = require("firebase-functions");
const admin = require("firebase-admin");

// [FIX IMPORT] Import an toàn, tự động xử lý dù thư viện thay đổi cấu trúc
const PayOSLib = require("@payos/node");
const PayOS = PayOSLib.PayOS || PayOSLib;

admin.initializeApp();
const db = admin.firestore();

// --- HÀM KHỞI TẠO (LAZY LOAD) ---
// Chỉ chạy khi có request, giúp Deploy không bị lỗi
function getPayOS() {
  return new PayOS(
    "1e9b451c-ce1c-4721-9b48-244f0220ea6e",     // <-- Điền Client ID
    "a478c434-c81c-43fb-ad44-c9026cf3ba05",       // <-- Điền API Key
    "8ce6d2273462dfe8072bcffd8da664ab70d798b6608023bde7ed58ff6739d071"   // <-- Điền Checksum Key
  );
}

// 1. Hàm tạo Link thanh toán (onCall)
exports.createPaymentLink = functions.https.onCall(async (data, context) => {
  // data: { amount, description, userId }
  const amount = data.amount;
  const description = data.description || "Nap tien";
  const userId = data.userId || "guest";

  if (!amount || amount < 2000) {
    throw new functions.https.HttpsError('invalid-argument', 'Số tiền phải > 2000đ');
  }

  const orderCode = Number(String(Date.now()).slice(-10));

  const paymentData = {
    orderCode: orderCode,
    amount: amount,
    description: description.slice(0, 25),
    cancelUrl: "https://chocuatuivn.web.app/wallet",
    returnUrl: "https://chocuatuivn.web.app/wallet",
  };

  try {
    // Khởi tạo PayOS ở đây để an toàn
    const payOS = getPayOS();
    const paymentLinkRes = await payOS.createPaymentLink(paymentData);

    // Lưu DB
    await db.collection("transactions").add({
      userId: userId,
      orderCode: orderCode,
      amount: amount,
      status: "pending",
      type: "deposit",
      createdAt: new Date().toISOString(),
      paymentLinkId: paymentLinkRes.paymentLinkId,
      checkoutUrl: paymentLinkRes.checkoutUrl
    });

    return {
      checkoutUrl: paymentLinkRes.checkoutUrl,
      qrCode: paymentLinkRes.qrCode,
      accountName: paymentLinkRes.accountName,
      accountNumber: paymentLinkRes.accountNumber,
      bin: paymentLinkRes.bin,
      amount: amount,
      description: description
    };
  } catch (error) {
    console.error("Lỗi PayOS:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Lỗi server');
  }
});

// 2. Webhook
exports.handlePayOSWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const payOS = getPayOS();
    const webhookData = payOS.verifyPaymentWebhookData(req.body);

    if (webhookData.code === "00" && webhookData.data) {
        const orderCode = webhookData.data.orderCode;
        const amount = webhookData.data.amount;

        const querySnapshot = await db.collection("transactions")
            .where("orderCode", "==", orderCode)
            .where("status", "==", "pending")
            .limit(1)
            .get();

        if (!querySnapshot.empty) {
            const txDoc = querySnapshot.docs[0];
            const userId = txDoc.data().userId;

            await db.runTransaction(async (t) => {
                const userRef = db.collection("users").doc(userId);
                const userDoc = await t.get(userRef);
                const currentBalance = (userDoc.exists && userDoc.data().walletBalance) || 0;
                
                t.update(userRef, { walletBalance: currentBalance + amount });
                t.update(txDoc.ref, { 
                    status: "success",
                    webhookTime: new Date().toISOString()
                });
            });
            console.log(`✅ Cộng ${amount} cho đơn ${orderCode}`);
        }
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Lỗi Webhook:", error);
    res.json({ success: false });
  }
});