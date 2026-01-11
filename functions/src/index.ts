import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

admin.initializeApp();

export const captureUrl = functions
  .runWith({ 
    timeoutSeconds: 60,
    memory: "2GB" 
  })
  .https.onCall(async (data: any, context: any) => {
    const url = data.url;

    if (!url || !url.startsWith('http')) {
      throw new functions.https.HttpsError("invalid-argument", "Link không hợp lệ.");
    }

    let browser = null;
    try {
      browser = await puppeteer.launch({
        args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });

      const page = await browser.newPage();
      
      // Giả lập iPhone 12 Pro để Shopee hiện giao diện gọn hơn
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1');

      // Tăng thời gian chờ tải trang lên 30s
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

      // 🔥 KỸ THUẬT MỚI: Cuộn xuống 300px để né Banner/Header
      await page.evaluate(() => {
        window.scrollBy(0, 300);
      });

      // ⏳ Chờ thêm 2 giây để ảnh load cho nét
      await new Promise(resolve => setTimeout(resolve, 2000));

      const screenshotBuffer = await page.screenshot({ 
        encoding: "base64", 
        type: "jpeg", 
        quality: 60 // Giảm chất lượng chút cho nhẹ
      });
      
      await browser.close();

      return { success: true, base64: `data:image/jpeg;base64,${screenshotBuffer}` };

    } catch (error: any) {
      if (browser) await browser.close();
      console.error("Lỗi Crawler:", error);
      throw new functions.https.HttpsError("internal", "Không thể truy cập trang web này.");
    }
  });