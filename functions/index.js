const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true }); // Thêm CORS để tránh lỗi chặn trình duyệt

admin.initializeApp();
const db = admin.firestore();

// [FIX 1] Import an toàn: Tự động tìm đúng class PayOS dù thư viện thay đổi
const PayOSOrigin = require("@payos/node");
const PayOS = PayOSOrigin.default || PayOSOrigin.PayOS || PayOSOrigin;

// [FIX 2] Hàm lấy instance PayOS (Lazy Load)
// Giúp deploy không bị lỗi dù điền sai Key, chỉ báo lỗi khi chạy thật
function getPayOS() {
    return new PayOS(
        "YOUR_CLIENT_ID",      // <--- Điền Client ID
        "YOUR_API_KEY",        // <--- Điền API Key
        "YOUR_CHECKSUM_KEY"    // <--- Điền Checksum Key
    );
}

// 1. Hàm tạo Link thanh toán
exports.createPaymentLink = functions.https.onRequest((req, res) => {
    // Dùng cors để cho phép gọi từ web
    cors(req, res, async () => {
        try {
            // Kiểm tra đăng nhập (nếu cần)
            // const idToken = req.headers.authorization?.split('Bearer ')[1];
            // const decodedToken = await admin.auth().verifyIdToken(idToken);
            // const userId = decodedToken.uid;
            
            // Lấy data từ body (vì dùng onRequest nên data nằm trong req.body)
            const { amount, description, userId } = req.body.data || req.body; 

            if (!amount) return res.status(400).json({ error: "Thiếu số tiền" });

            const orderCode = Number(String(Date.now()).slice(-10));
            const payOS = getPayOS(); // Khởi tạo PayOS tại đây

            const paymentData = {
                orderCode: orderCode,
                amount: amount,
                description: (description || "Nap tien").slice(0, 25),
                cancelUrl: "https://chocuatuivn.web.app/wallet",
                returnUrl: "https://chocuatuivn.web.app/wallet",
            };

            const paymentLinkRes = await payOS.createPaymentLink(paymentData);

            // Lưu DB
            await db.collection("transactions").add({
                userId: userId || "guest", // Cần xử lý lấy userId chuẩn
                orderCode: orderCode,
                amount: amount,
                status: "pending",
                type: "deposit",
                createdAt: new Date().toISOString(),
                paymentLinkId: paymentLinkRes.paymentLinkId,
                checkoutUrl: paymentLinkRes.checkoutUrl
            });

            // Trả về kết quả chuẩn format của onCall hoặc JSON thường
            res.json({ data: {
                checkoutUrl: paymentLinkRes.checkoutUrl,
                qrCode: paymentLinkRes.qrCode,
                accountName: paymentLinkRes.accountName,
                accountNumber: paymentLinkRes.accountNumber,
                bin: paymentLinkRes.bin
            }});

        } catch (error) {
            console.error("Lỗi PayOS:", error);
            res.status(500).json({ error: error.message });
        }
    });
});

// 2. Webhook
exports.handlePayOSWebhook = functions.https.onRequest(async (req, res) => {
    try {
        const payOS = getPayOS();
        const webhookData = payOS.verifyPaymentWebhookData(req.body);

        if (webhookData.code === "00" && webhookData.data) {
            const { orderCode, amount } = webhookData.data;

            const querySnapshot = await db.collection("transactions")
                .where("orderCode", "==", orderCode)
                .where("status", "==", "pending")
                .limit(1)
                .get();

            if (!querySnapshot.empty) {
                const txDoc = querySnapshot.docs[0];
                const txData = txDoc.data();
                
                await db.runTransaction(async (t) => {
                    const userRef = db.collection("users").doc(txData.userId);
                    const userDoc = await t.get(userRef);
                    const currentBalance = (userDoc.exists && userDoc.data().walletBalance) || 0;

                    t.update(userRef, { walletBalance: currentBalance + amount });
                    t.update(txDoc.ref, { 
                        status: "success", 
                        webhookTime: new Date().toISOString() 
                    });
                });
                console.log(`✅ Đã cộng tiền đơn: ${orderCode}`);
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error("Lỗi Webhook:", error);
        res.json({ success: false });
    }
});