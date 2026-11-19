# Hướng dẫn phát hành — Chợ Của Tui

Làm theo thứ tự. Mỗi bước có cách kiểm tra.

## 1. Quy tắc bảo mật (Firestore Rules) — mỗi khi file `firestore.rules` đổi
1. Mở `firestore.rules` trên GitHub, bấm **Raw**, chép tất cả.
2. Firebase Console → dự án **chocuatui-3e65c** → Firestore Database → **Rules** → dán → **Publish**.
3. Kiểm tra: mở web, xem trang chủ, mở một tin, gửi một yêu cầu. Lỗi quyền → khôi phục bản trước trong tab Rules.

## 2. Thông báo đẩy, tin hết hạn, điểm uy tín (Cloud Functions)
Cần làm **một lần** trên máy tính.

1. **Chuyển gói Blaze**: Firebase Console → góc dưới trái → **Upgrade** → Blaze (gắn thẻ).
   Ngay sau đó: Google Cloud Console → **Billing → Budgets & alerts** → tạo ngân sách, ví dụ 50.000đ/tháng, bật email cảnh báo.
   Cộng đồng nhỏ thường nằm trong hạn mức miễn phí.
2. Cài công cụ (cần Node.js 20 trở lên): `npm install -g firebase-tools`, rồi `firebase login`.
3. Tải code: `git clone https://github.com/kenhgt247/chocuatuivn` → `cd chocuatuivn`.
4. Phát hành: `firebase deploy --only functions --project chocuatui-3e65c --force`
   (`--force` để xoá các hàm thanh toán cũ: createPaymentLink, handlePayOSWebhook, trackAffiliateClick).
5. Kiểm tra: dùng 2 tài khoản; tài khoản A bật thông báo (nút "Bật thông báo"), rồi tắt hẳn trình duyệt/ứng dụng;
   tài khoản B gửi tin nhắn → máy A phải rung báo trong vài giây.

Ba hàm được cài:
- `pushThongBao`: có thông báo mới → đẩy về điện thoại.
- `hetHanTin`: 7 giờ sáng mỗi ngày, tin quá 30 ngày → "Hết hạn", báo người đăng bấm **Gia hạn**.
- `diemUyTin`: khi cả hai bên xác nhận xong → cộng "Đã chia sẻ xong" cho người trao.

## 3. Sau khi phát hành
- Đăng nhập admin → **Quản trị → Công cụ → Đồng bộ ngay** (một lần).
- Google Search Console → **Sitemaps** → gửi `https://www.chocuatui.vn/sitemap.xml`.
- Đổi/xoá khoá cũ đã lộ: Gemini (aistudio.google.com/apikey) và PayOS.

## 4. Chạy thử ở 1–2 xã/phường
1. Chọn 1–2 phường mình quen (có nhóm Zalo khu phố, chợ, trường học).
2. Tự đăng trước 10–20 tin thật (sách cũ, quần áo trẻ em, đồ gia dụng, cho mượn dụng cụ, nhận chỉ dùng điện thoại…).
3. Chia sẻ từng tin vào nhóm Zalo/Facebook của phường bằng nút **Chia sẻ → Chép lời giới thiệu**.
4. Mỗi ngày: vào **Quản trị → Duyệt tin** (mục tiêu duyệt trong vài giờ), xem **Báo cáo**.
5. Sau 2–4 tuần, xem: số yêu cầu hoàn thành, tin có người xin trong 3 ngày, người đăng lần 2.

## Đóng gói ứng dụng Android (APK / Google Play)

1. Vào **pwabuilder.com**, dán `https://www.chocuatui.vn` → **Start** → **Package for stores** → **Android** → **Generate**.
   - Package ID gợi ý: `vn.chocuatui.app`; App name: `Chợ Của Tui`; Launcher name: `Chợ Của Tui`.
   - Signing key: chọn **Create new**, điền tên + mật khẩu. **Cất kỹ file .keystore và mật khẩu** (mất là không cập nhật được ứng dụng trên Google Play).
2. Tải về file .zip: có `*.apk` (cài thử / gửi người dùng), `*.aab` (nộp Google Play), `assetlinks.json`.
3. Gửi `assetlinks.json` để đưa lên `public/.well-known/assetlinks.json` → ứng dụng mở toàn màn hình, không hiện thanh địa chỉ.
   (Nếu dùng Google Play App Signing: thêm cả mã SHA-256 trong Play Console → Setup → App integrity vào file này.)
4. Google Play Console: tài khoản nhà phát triển 25 USD (một lần) → Create app → tải `.aab` lên → điền mô tả, ảnh (có sẵn trong `public/screenshots/`).
