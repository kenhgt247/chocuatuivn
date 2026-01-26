const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// --- 1. HÀM LỌC TÊN (XỬ LÝ TIẾNG VIỆT) ---
function cleanVietnamese(str) {
    if (!str) return "";
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str.replace(/[^a-zA-Z0-9 ]/g, "").trim();
}

// --- 2. HÀM TẠO CHỮ KÝ PAYOS ---
function createSignature(data, checksumKey) {
    const sortedData = {
        amount: data.amount,
        cancelUrl: data.cancelUrl,
        description: data.description,
        orderCode: data.orderCode,
        returnUrl: data.returnUrl
    };
    const signString = Object.keys(sortedData)
        .sort()
        .map(key => `${key}=${sortedData[key]}`)
        .join("&");
    return crypto.createHmac("sha256", checksumKey).update(signString).digest("hex");
}

// --- 3. API TẠO LINK THANH TOÁN (PAYOS) ---
exports.createPaymentLink = onRequest({ cors: true }, async (req, res) => {
  try {
    const CLIENT_ID = process.env.PAYOS_CLIENT_ID;
    const API_KEY = process.env.PAYOS_API_KEY;
    const CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY;

    if (!CLIENT_ID || !API_KEY || !CHECKSUM_KEY) throw new Error("Thiếu Key PayOS");

    const { amount, userId, fullName } = req.body; 
    const orderCode = Number(String(Date.now()).slice(-10));

    let displayRawName = fullName || userId || "Khach";
    let cleanName = cleanVietnamese(displayRawName);
    if (cleanName.length > 15) cleanName = cleanName.substring(0, 15);

    const descriptionText = `Nap ${cleanName}`; 

    const requestData = {
        orderCode: orderCode,
        amount: Number(amount),
        description: descriptionText,
        cancelUrl: "https://www.chocuatui.vn/wallet",
        returnUrl: "https://www.chocuatui.vn/wallet",
        items: [],
        buyerName: cleanName, 
        expiredAt: Math.floor(Date.now() / 1000) + (15 * 60)
    };

    requestData.signature = createSignature(requestData, CHECKSUM_KEY);

    const response = await fetch("https://api-merchant.payos.vn/v2/payment-requests", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-client-id": CLIENT_ID,
            "x-api-key": API_KEY
        },
        body: JSON.stringify(requestData)
    });

    const result = await response.json();
    if (!response.ok || result.code !== "00") throw new Error(result.desc);

    await db.collection("transactions").add({
        userId: userId || "guest",
        fullName: fullName || "",
        orderCode: orderCode,
        amount: Number(amount),
        status: "pending",
        type: "deposit",
        createdAt: new Date().toISOString(),
        paymentLinkId: result.data.paymentLinkId,
        checkoutUrl: result.data.checkoutUrl,
        description: descriptionText
    });

    return res.json(result.data);

  } catch (error) {
    console.error("❌ Lỗi:", error);
    return res.status(500).json({ error: error.message });
  }
});

// --- 4. XỬ LÝ WEBHOOK PAYOS (CỘNG TIỀN + GỬI THÔNG BÁO) ---
exports.handlePayOSWebhook = onRequest({ cors: true }, async (req, res) => {
  try {
    const webhookData = req.body.data;
    if (!webhookData || !webhookData.orderCode) return res.json({ success: false, reason: "No data" });

    const { orderCode, amount } = webhookData;
    console.log(`🔔 PayOS báo tin: Đơn hàng ${orderCode} đã thanh toán ${amount}đ`);

    const snapshot = await db.collection("transactions")
        .where("orderCode", "==", Number(orderCode))
        .limit(1)
        .get();

    if (snapshot.empty) return res.json({ success: false, reason: "Transaction not found" });

    const doc = snapshot.docs[0];
    const transData = doc.data();

    if (transData.status === "success") return res.json({ success: true, message: "Already processed" });

    // 🔥 TRANSACTION: CỘNG TIỀN VÀ TẠO THÔNG BÁO
    await db.runTransaction(async (t) => {
        const userRef = db.collection("users").doc(transData.userId);
        const transRef = db.collection("transactions").doc(doc.id);
        const newNotiRef = db.collection("notifications").doc();

        // 1. Cộng tiền ví chính
        t.update(userRef, { 
            walletBalance: admin.firestore.FieldValue.increment(Number(amount)) 
        });

        // 2. Đổi trạng thái giao dịch
        t.update(transRef, { 
            status: "success",
            webhookTime: new Date().toISOString(),
            payOSReference: webhookData.reference || ""
        });

        // 3. Tạo thông báo
        t.set(newNotiRef, {
            userId: transData.userId,
            title: "Nạp tiền thành công! 🎉",
            message: `Hệ thống đã cộng ${Number(amount).toLocaleString('vi-VN')}đ vào ví của bạn.`,
            type: "wallet",
            read: false,
            link: "/wallet",
            createdAt: new Date().toISOString()
        });
    });

    console.log(`✅ Đã cộng tiền và gửi thông báo cho User: ${transData.userId}`);
    return res.json({ success: true });

  } catch (error) {
    console.error("❌ Lỗi xử lý Webhook:", error);
    return res.json({ success: true }); 
  }
});

// --- 5. API TÍCH ĐIỂM CHIA SẺ (AFFILIATE POINTS) [MỚI] ---
exports.trackAffiliateClick = onRequest({ cors: true }, async (req, res) => {
  try {
    const { refId, listingId } = req.body;
    // Lấy IP người click (để chống spam)
    const visitorIp = req.headers['fastly-client-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!refId || !listingId) return res.json({ success: false, message: "Thiếu thông tin" });

    // --- CẤU HÌNH ĐIỂM ---
    const POINTS_PER_VIEW = 10; // 10 điểm cho 1 lượt xem

    // 1. CHECK SPAM (IP + Listing + RefId trong 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const spamCheck = await db.collection("affiliate_logs")
        .where("refId", "==", refId)
        .where("visitorIp", "==", visitorIp)
        .where("listingId", "==", listingId)
        .where("createdAt", ">", yesterday)
        .limit(1)
        .get();

    if (!spamCheck.empty) {
        return res.json({ success: false, message: "IP này đã xem rồi" });
    }

    // 2. CỘNG ĐIỂM VÀO VÍ ĐIỂM (pointBalance)
    await db.runTransaction(async (t) => {
        const userRef = db.collection("users").doc(refId);
        
        // Cộng vào pointBalance (KHÔNG CỘNG VÀO walletBalance)
        t.update(userRef, { 
            pointBalance: admin.firestore.FieldValue.increment(POINTS_PER_VIEW),
            totalPointsEarned: admin.firestore.FieldValue.increment(POINTS_PER_VIEW)
        });

        // Lưu log lịch sử điểm
        const logRef = db.collection("affiliate_logs").doc();
        t.set(logRef, {
            refId,
            listingId,
            visitorIp,
            points: POINTS_PER_VIEW,
            type: 'share_view',
            createdAt: new Date().toISOString()
        });
    });

    return res.json({ success: true, points: POINTS_PER_VIEW });

  } catch (error) {
    console.error("❌ Lỗi Tích điểm:", error);
    return res.status(500).json({ error: error.message });
  }
});