# Chợ Của Tui — Thiết kế lại theo mô hình cộng đồng Olio

Ngày rà soát: 18/11/2026. Đọc trực tiếp mã nguồn trong repository `kenhgt247/chocuatuivn`, nhánh `main`. Bản thử nghiệm nằm ở route `/chia-se`; trang `/` và dữ liệu sản xuất giữ nguyên.

## 1. Kiểm kê dự án

- Frontend: React 19 + TypeScript + Vite + Tailwind, React Router.
- Backend: Firebase Authentication, Firestore, Storage, Cloud Functions; tích hợp Firebase Messaging.
- Tái sử dụng: đăng nhập Google, danh mục, hình ảnh, tin đăng, trò chuyện, yêu thích, định vị, bản đồ Leaflet, quản trị, báo cáo.
- Hiện trạng định vị: sàn rao vặt có đấu giá, gói VIP, ví, quảng cáo, tiếp thị liên kết, AI định giá và tin đẩy.
- Hiện trạng đường dẫn: `/` tin rao vặt; `/post` đăng bán; `/san-pham/:id` trang sản phẩm; `/chat` nhắn tin; `/profile` tài khoản; `/admin` quản trị.

## 2. Định vị mới

**Chợ Của Tui — Cho đi đồ còn tốt, nhận về những điều tử tế.**

Đây là sản phẩm nguyên bản cho cộng đồng Việt Nam, lấy cảm hứng từ nguyên tắc giảm lãng phí và trao đổi tại địa phương của Olio. Không sao chép nhãn hiệu, logo, thiết kế hoặc nội dung bản quyền Olio.

Dòng sử dụng quan trọng nhất: **người đăng tặng → người gần đó nhìn thấy → nhắn tin xin nhận → chủ đồ chọn người nhận → xác nhận giao đồ**.

Điều kiện đặc biệt: minh bạch việc tặng miễn phí, tránh bị trục lợi/mua đi bán lại, bảo vệ địa chỉ và số điện thoại, không công khai vị trí chính xác của người đăng.

## 3. Giao diện thử nghiệm hiện có

- Route mới: `/chia-se` (nhánh PR). Không thay đổi route chính `/`.
- Giao diện riêng, tối ưu điện thoại, xanh lá + nền sáng, lời kêu gọi “Tôi muốn tặng đồ”.
- Danh sách tin duyệt từ Firestore; các tab: Tặng miễn phí / Giá dưới 200k / Xem tất cả.
- Bộ lọc tìm kiếm, khu vực, danh mục thông dụng, dạng lưới/bản đồ, xem thêm tin.
- `/post?mode=give`: sử dụng lại form đăng tin, đặt giá = 0, gắn `communityType:'give'`, không đấu giá; tin chờ duyệt.
- **Không** gắn nhãn “tặng” cho các tin cũ chỉ vì giá = 0 (trước đây giá 0 có thể mang nghĩa “Liên hệ”).

Lưu ý: Đây là **MVP giao diện + đăng tặng cơ bản**, chưa phải sản phẩm Olio hoàn chỉnh; chưa có quy trình hẹn/giữ/hoàn tất nhận đồ.

## 4. Ưu tiên tiếp theo

### P0 – Cần xong trước khi mở rộng

1. **Rà soát Firestore Rules**: `users/{uid}` đang `allow read: if true`, trong khi user document có thể lưu `email`, `phone`, `address`, `fcmToken`, `verificationDocuments`, `idCardFront`, `idCardBack`. Cần tách hồ sơ công khai khỏi hồ sơ riêng tư và KYC; cập nhật rules, migration, kiểm thử trước khi deploy. Không sửa một dòng `allow read` đơn lẻ vì các màn hình hiện tại gọi thông tin user.
2. Quy tắc `listings/{listingId}` hiện cho chủ tin sửa toàn bộ trường khác `sellerId`, gồm `status`, `tier` và thuộc tính nhạy cảm; cần whitelist quyền sửa và giữ quyết định phê duyệt trên máy chủ.
3. `notifications` đang cho người đã đăng nhập tạo thông báo tùy ý; `chats` cho participant cập nhật toàn bộ document. Cần xác thực người gửi, quyền participant, tránh giả mạo tin nhắn/trạng thái.
4. Kiểm tra Storage Rules và đường dẫn upload, giới hạn loại/kích thước file, kiểm duyệt ảnh. Không bắt đầu thu thập giấy tờ định danh mới trước khi hoàn tất quy trình bảo vệ dữ liệu.
5. Tách vị trí chính xác khỏi feed công khai; dùng điểm xấp xỉ (phường/xã, bán kính) và chỉ trao đổi điểm hẹn trong chat an toàn.
6. Test quy trình đăng tin miễn phí, duyệt, hiển thị và nhắn tin với tài khoản khác nhau; test Firestore indexes và phân trang.

### P1 – Luồng cốt lõi

1. `communityType` gồm `give`, `request`, `borrow`, `sell` (chỉ `give` được thêm trong bản thử nghiệm này).
2. `handoffStatus`: `available`, `reserved`, `completed`, `cancelled` + người nhận được chọn. Dùng transaction/Cloud Function để chống nhận trùng.
3. Nút “Xin nhận” gửi yêu cầu kèm lời nhắn, thay vì nhắn tin không cấu trúc.
4. Thông báo chủ đồ chọn người nhận; hết thời gian giữ tự động trả đồ về trạng thái có thể nhận.
5. Ghi nhận giao thành công, đánh giá hai chiều và báo cáo hành vi trục lợi.
6. Trang “Tôi cần tìm”; tìm kiếm địa phương theo bán kính thực tế (cần geohash/index).

### P2 – Mở rộng

- Điểm chia sẻ cộng đồng tại trường học, chung cư, khu công nghiệp, thôn/xã.
- Cửa hàng cộng đồng và nhóm thu gom thực phẩm dư thừa với quy tắc an toàn thực phẩm.
- Bảng điều phối tình nguyện viên và công cụ kiểm duyệt.
- Theo dõi tác động bằng số món đã trao tặng thực tế; không tự động quy đổi thành số tiền hay CO₂ thiếu căn cứ.

## 5. Tiêu chí nghiệm thu

- Người dùng mới có thể xem tin mà không đăng nhập; đăng/nhắn cần đăng nhập.
- Tin tặng có giá 0 đồng, không hiển thị giá “Liên hệ”.
- Tin tặng xuất hiện ở bộ lọc Tặng miễn phí **sau duyệt**.
- Người bán cũ và tin bán cũ không bị gắn nhãn tặng sai.
- Không có hồ sơ riêng tư/KYC nào được client ngoài chủ sở hữu hoặc quản trị có thẩm quyền đọc.
- Không thể duyệt tin hoặc tự nâng tier bằng yêu cầu Firestore từ client.
- Chạy được `npm run build` và kiểm tra trên điện thoại trước khi nhập nhánh chính.

## 6. Lộ trình thử nghiệm

- 1–2 tuần: sửa bảo mật P0, hoàn thiện quy trình xin nhận và UI.
- 2–4 tuần: thí điểm trong 2–3 cộng đồng nhỏ có điều phối; theo dõi yêu cầu/đăng tặng/giao nhận/vi phạm.
- Mở rộng địa bàn sau khi tỷ lệ giao nhận thành công, an toàn, hiệu quả duyệt nội dung đạt mục tiêu.

## 7. Đối chiếu nguồn

- Mã nguồn: `App.tsx`, `pages/Home.tsx`, `pages/PostListing.tsx`, `pages/ListingDetail.tsx`, `components/Layout.tsx`, `services/db.ts`, `types.ts`, `firestore.rules`, `storage.rules`, `public/manifest.json`.
- Olio (tham khảo mô hình): https://olioapp.com/en/getting-started-on-olio/what-is-olio/
