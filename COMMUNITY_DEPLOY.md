# Chợ Của Tui 2.0 — phát hành không thu phí

## Đã tích hợp trong mã nguồn
- Trang chủ '/' và '/cong-dong/*' dùng giao diện chia sẻ đơn giản, miễn phí.
- Tin mới lưu cùng Firebase project hiện tại, collection 'listings'. Không cần migration phá dữ liệu.
- Đăng nhập qua hệ thống Firebase Auth hiện tại. Ảnh qua Firebase Storage, thư mục 'listings/<uid>/'.
- Chat và FCM được dùng lại từ hệ thống cũ. Quyền thông báo chỉ xin sau khi bấm.
- Leaflet vẫn sử dụng OSM, tọa độ cộng đồng làm tròn 2 chữ số thập phân và chỉ thu thập khi đồng ý.
- Các yêu cầu theo dõi trạng thái dùng 'communityRequests', có Security Rules kiểm tra quyền.
- Nếu Security Rules mới chưa được triển khai, nút gửi yêu cầu dự phòng sang chat cũ. Đây là phương án chuyển tiếp, chưa có quản lý trạng thái trên collection mới.

## Phát hành an toàn — không bỏ qua
1. Xác nhận nền tảng hiện đang phục vụ chocuatui.vn (Vercel, Firebase Hosting hoặc nhà cung cấp khác), bản sao lưu/khả năng rollback.
2. Sao lưu Firestore và Storage theo quy trình dự phòng hiện có.
3. Tạo môi trường Firebase staging riêng hoặc Emulator, không dùng dữ liệu thật để kiểm thử.
4. Trong staging chạy:
   - npm ci --legacy-peer-deps
   - npx tsc --noEmit
   - npm run build
   - Kiểm thử đăng nhập, đăng tin, tải ảnh, chờ duyệt, yêu cầu, chat, bản đồ và push.
5. Kiểm thử firestore.rules bằng Firebase Emulator: khách, chủ tin, người gửi yêu cầu, người ngoài, admin. Đặc biệt phải thử cập nhật trái phép trạng thái.
6. Phát hành quy tắc Firebase sau khi thử thành công:
   - firebase deploy --only firestore:rules,storage --project <project-id>
   - Repo đã đăng ký đường dẫn rules trong firebase.json.
7. Phát hành bản build giao diện lên *đúng môi trường hosting đang nối chocuatui.vn*. Đẩy GitHub main không tự đồng nghĩa với website live.
8. Kiểm tra thực tế trên iOS/Android và cả tài khoản cũ. Không chấp nhận hoạt động thu phí hoặc quảng cáo trong lộ trình cộng đồng.
9. Theo dõi lỗi, thông báo đẩy, chat, số tin chờ duyệt và báo cáo trong 24 giờ đầu. Giữ phương án rollback.

## An toàn và bảo mật còn phải làm
- Firestore legacy hiện cho phép đọc công khai collection 'users', trong đó có trường nhạy cảm. Cần xây 'publicProfiles' và di chuyển dần giao diện cũ, rồi siết read rules. Không nên siết đột ngột khiến profile/chat cũ hỏng.
- Một file functions/src cũ chứa chuỗi khóa dịch vụ thanh toán ở lịch sử git. Phải vô hiệu/thu hồi và cấp lại những khóa có khả năng bị lộ; xóa khỏi HEAD không xóa khỏi lịch sử.
- Mã cloud functions có nhánh thanh toán cũ. Giao diện mới không sử dụng, nhưng việc xóa/vô hiệu trên server cần thực hiện riêng có kiểm soát, tránh ảnh hưởng hồ sơ lịch sử.
- Chưa có quyền truy cập console Firebase/hosting trong phiên làm việc này nên thao tác triển khai nền tảng không được tự giả định đã hoàn tất.

## Hướng dẫn người dùng
- Mở website, chọn Cho tặng / Mượn đồ / Giúp nhau / Sửa đồ.
- Xem tin không cần đăng nhập. Đăng nhập khi cần đăng hoặc liên hệ.
- Đăng tin: Tôi có/Tôi cần → chọn loại → nhập nội dung, khu vực → Đăng.
- Không có VIP, không nhận tiền, không bắt phải bật GPS; bản đồ chỉ lấy vị trí gần đúng khi người dùng đồng ý.
