import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

admin.initializeApp();

export const captureUrl = functions
  .runWith({ 
    timeoutSeconds: 120, // Tăng thời gian chờ lên 2 phút
    memory: "2GB" 
  })
  .https.onCall(async (data: any, context: any) => {
    const url = data.url;

    if (!url || !url.startsWith('http')) {
      throw new functions.https.HttpsError("invalid-argument", "Link không hợp lệ.");
    }

    let browser = null;
    try {
      // Cấu hình trình duyệt
      browser = await puppeteer.launch({
        args: [
          ...chromium.args, 
          "--hide-scrollbars", 
          "--disable-web-security",
          "--no-sandbox",
          "--disable-setuid-sandbox"
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });

      const page = await browser.newPage();
      
      // 🔥 THAY ĐỔI LỚN: Giả lập Màn hình Máy tính (PC) thay vì điện thoại
      // Để tránh bị hiện popup "Mở App" che mất sản phẩm
      await page.setViewport({ width: 1366, height: 768 });
      
      // Dùng UserAgent của Chrome trên Windows 10
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36');

      // Vào trang web
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

      // 🔥 KỸ THUẬT: Cuộn từ từ xuống để tải ảnh (Lazy load)
      await page.evaluate(async () => {
        // Cuộn xuống 500px
        window.scrollBy(0, 500);
        // Chờ 1 giây
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // Cuộn thêm chút nữa
        window.scrollBy(0, 500);
        // Cuộn ngược lên đầu trang để chụp cho đẹp
        window.scrollTo(0, 0);
      });

      // Chờ thêm 3 giây cho mọi thứ ổn định
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Chụp ảnh
      const screenshotBuffer = await page.screenshot({ 
        encoding: "base64", 
        type: "jpeg", 
        quality: 70,
        fullPage: false // Chỉ chụp màn hình hiển thị (không chụp dài ngoằng)
      });
      
      await browser.close();

      return { success: true, base64: `data:image/jpeg;base64,${screenshotBuffer}` };

    } catch (error: any) {
      if (browser) await browser.close();
      console.error("Lỗi Crawler:", error);
      throw new functions.https.HttpsError("internal", "Không thể truy cập trang web này. Vui lòng thử lại.");
    }
  });