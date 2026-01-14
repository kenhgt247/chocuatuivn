import { Category, Listing, User } from './types';

export const PUSH_LISTING_PRICE = 20000;

// ============================================================
// BỘ DỮ LIỆU DANH MỤC & TRƯỜNG DỮ LIỆU 
// ============================================================
export const CATEGORIES: Category[] = [
  
  // ==================== 1. BẤT ĐỘNG SẢN ====================
  { id: 'bat-dong-san', name: 'Bất động sản', icon: '🏠', slug: 'bat-dong-san', parentId: null, order: 1 },
  // Con
  { 
    id: 'can-ho-chung-cu', name: 'Căn hộ/Chung cư', icon: '🏢', slug: 'can-ho-chung-cu', parentId: 'bat-dong-san',
    attributes: [
      { key: 'project', label: 'Tên dự án', type: 'text' },
      { key: 'area', label: 'Diện tích', type: 'number', suffix: 'm²', required: true },
      { key: 'bedrooms', label: 'Số phòng ngủ', type: 'number', required: true },
      { key: 'bathrooms', label: 'Số WC', type: 'number' },
      { key: 'direction', label: 'Hướng cửa', type: 'select', options: ['Đông', 'Tây', 'Nam', 'Bắc', 'Đông Nam', 'Đông Bắc', 'Tây Nam', 'Tây Bắc'] },
      { key: 'legal', label: 'Pháp lý', type: 'select', options: ['Sổ hồng', 'Hợp đồng mua bán', 'Đang chờ sổ'] }
    ]
  },
  { 
    id: 'nha-o', name: 'Nhà ở', icon: '🏠', slug: 'nha-o', parentId: 'bat-dong-san',
    attributes: [
      { key: 'area', label: 'Diện tích', type: 'number', suffix: 'm²', required: true },
      { key: 'floors', label: 'Số tầng', type: 'number' },
      { key: 'bedrooms', label: 'Số phòng ngủ', type: 'number' },
      { key: 'type', label: 'Loại nhà', type: 'select', options: ['Nhà mặt tiền', 'Nhà hẻm', 'Biệt thự', 'Nhà phố'] },
      { key: 'legal', label: 'Giấy tờ', type: 'select', options: ['Sổ đỏ/Sổ hồng', 'Vi bằng', 'Giấy tay'] }
    ]
  },
  { 
    id: 'dat', name: 'Đất', icon: '🏞️', slug: 'dat', parentId: 'bat-dong-san',
    attributes: [
      { key: 'area', label: 'Diện tích', type: 'number', suffix: 'm²', required: true },
      { key: 'type', label: 'Loại đất', type: 'select', options: ['Đất thổ cư', 'Đất dự án', 'Đất nông nghiệp', 'Đất công nghiệp'] },
      { key: 'direction', label: 'Hướng đất', type: 'select', options: ['Đông', 'Tây', 'Nam', 'Bắc', 'Đông Nam', 'Đông Bắc', 'Tây Nam', 'Tây Bắc'] }
    ]
  },
  { 
    id: 'phong-tro', name: 'Phòng trọ', icon: '🚪', slug: 'phong-tro', parentId: 'bat-dong-san',
    attributes: [
      { key: 'area', label: 'Diện tích', type: 'number', suffix: 'm²' },
      { key: 'deposit', label: 'Tiền cọc', type: 'number', suffix: 'đ' },
      { key: 'furniture', label: 'Nội thất', type: 'select', options: ['Full nội thất', 'Cơ bản', 'Trống'] }
    ]
  },
  { id: 'van-phong', name: 'Văn phòng, Mặt bằng', icon: '🏪', slug: 'van-phong', parentId: 'bat-dong-san', attributes: [] },

  // ==================== 2. XE CỘ ====================
  { id: 'xe-co', name: 'Xe cộ', icon: '🚗', slug: 'xe-co', parentId: null, order: 2 },
  // Con
  { 
    id: 'o-to', name: 'Ô tô', icon: '🚘', slug: 'o-to', parentId: 'xe-co',
    attributes: [
      { key: 'brand', label: 'Hãng xe', type: 'select', options: ['Toyota', 'Hyundai', 'Kia', 'VinFast', 'Mazda', 'Ford', 'Honda', 'Mercedes', 'BMW'], required: true },
      { key: 'year', label: 'Năm SX', type: 'number', required: true },
      { key: 'mileage', label: 'Số Km (ODO)', type: 'number', suffix: 'Km' },
      { key: 'gearbox', label: 'Hộp số', type: 'select', options: ['Tự động', 'Số sàn', 'Bán tự động'] },
      { key: 'fuel', label: 'Nhiên liệu', type: 'select', options: ['Xăng', 'Dầu', 'Điện', 'Hybrid'] },
      { key: 'origin', label: 'Xuất xứ', type: 'select', options: ['Việt Nam', 'Thái Lan', 'Nhập khẩu khác'] }
    ]
  },
  { 
    id: 'xe-may', name: 'Xe máy', icon: '🛵', slug: 'xe-may', parentId: 'xe-co',
    attributes: [
      { key: 'brand', label: 'Hãng xe', type: 'select', options: ['Honda', 'Yamaha', 'Suzuki', 'Piaggio', 'SYM', 'VinFast', 'Ducati', 'Kawasaki'], required: true },
      { key: 'year', label: 'Năm đăng ký', type: 'number' },
      { key: 'condition', label: 'Tình trạng', type: 'select', options: ['Mới', 'Đã sử dụng'] },
      { key: 'capacity', label: 'Dung tích', type: 'select', options: ['Dưới 50cc', '100 - 175cc', 'Trên 175cc'] }
    ]
  },
  { 
    id: 'xe-dien', name: 'Xe điện', icon: '🔌', slug: 'xe-dien', parentId: 'xe-co',
    attributes: [
      { key: 'type', label: 'Loại xe', type: 'select', options: ['Xe máy điện', 'Xe đạp điện'] },
      { key: 'brand', label: 'Hãng xe', type: 'text' },
      { key: 'battery', label: 'Pin/Ắc quy', type: 'text' }
    ]
  },
  { id: 'xe-tai', name: 'Xe tải, Xe ben', icon: '🚛', slug: 'xe-tai', parentId: 'xe-co', attributes: [] },
  { id: 'xe-dap', name: 'Xe đạp', icon: '🚲', slug: 'xe-dap', parentId: 'xe-co', attributes: [] },
  { id: 'phu-tung-xe', name: 'Phụ tùng xe', icon: '🔧', slug: 'phu-tung-xe', parentId: 'xe-co', attributes: [] },

  // ==================== 3. ĐỒ ĐIỆN TỬ ====================
  { id: 'do-dien-tu', name: 'Đồ điện tử', icon: '💻', slug: 'do-dien-tu', parentId: null, order: 3 },
  // Con (Dựa theo ảnh Screenshot 671)
  { 
    id: 'dien-thoai', name: 'Điện thoại', icon: '📱', slug: 'dien-thoai', parentId: 'do-dien-tu',
    attributes: [
      { key: 'brand', label: 'Hãng', type: 'select', options: ['Apple', 'Samsung', 'Xiaomi', 'Oppo', 'Vivo', 'Realme', 'Huawei'], required: true },
      { key: 'storage', label: 'Dung lượng', type: 'select', options: ['64GB', '128GB', '256GB', '512GB', '1TB'] },
      { key: 'color', label: 'Màu sắc', type: 'text' },
      { key: 'status', label: 'Tình trạng', type: 'select', options: ['Mới 100%', '99%', '98%', 'Cũ'] }
    ]
  },
  { 
    id: 'may-tinh-bang', name: 'Máy tính bảng', icon: '📟', slug: 'may-tinh-bang', parentId: 'do-dien-tu',
    attributes: [
      { key: 'brand', label: 'Hãng', type: 'select', options: ['iPad (Apple)', 'Samsung', 'Xiaomi', 'Lenovo'] },
      { key: 'screen', label: 'Màn hình', type: 'text' },
      { key: 'connection', label: 'Kết nối', type: 'select', options: ['Wifi', 'Wifi + 4G/5G'] }
    ]
  },
  { 
    id: 'laptop', name: 'Laptop', icon: '💻', slug: 'laptop', parentId: 'do-dien-tu',
    attributes: [
      { key: 'brand', label: 'Hãng', type: 'select', options: ['MacBook', 'Dell', 'HP', 'Asus', 'Acer', 'Lenovo', 'MSI'], required: true },
      { key: 'cpu', label: 'Vi xử lý', type: 'select', options: ['Core i3', 'Core i5', 'Core i7', 'Ryzen 3', 'Ryzen 5', 'M1', 'M2'] },
      { key: 'ram', label: 'RAM', type: 'select', options: ['4GB', '8GB', '16GB', '32GB'] },
      { key: 'hardDrive', label: 'Ổ cứng', type: 'select', options: ['SSD 256GB', 'SSD 512GB', 'HDD 1TB'] }
    ]
  },
  { id: 'may-tinh-de-ban', name: 'Máy tính để bàn', icon: '🖥️', slug: 'may-tinh-de-ban', parentId: 'do-dien-tu', attributes: [] },
  { id: 'may-anh', name: 'Máy ảnh, Máy quay', icon: '📸', slug: 'may-anh', parentId: 'do-dien-tu', attributes: [] },
  { id: 'tivi-am-thanh', name: 'Tivi, Âm thanh', icon: '📺', slug: 'tivi-am-thanh', parentId: 'do-dien-tu', attributes: [] },
  { id: 'thiet-bi-thong-minh', name: 'Thiết bị đeo thông minh', icon: '⌚', slug: 'thiet-bi-thong-minh', parentId: 'do-dien-tu', attributes: [] },
  { id: 'phu-kien-dt', name: 'Phụ kiện (Màn hình, Chuột...)', icon: '🖱️', slug: 'phu-kien-dt', parentId: 'do-dien-tu', attributes: [] },
  { id: 'linh-kien', name: 'Linh kiện (RAM, Card...)', icon: '🔌', slug: 'linh-kien', parentId: 'do-dien-tu', attributes: [] },

  // ==================== 4. VIỆC LÀM ====================
  { id: 'viec-lam', name: 'Việc làm', icon: '💼', slug: 'viec-lam', parentId: null, order: 4 },
  // Con (Dựa theo ảnh Screenshot 670)
  { 
    id: 'ban-hang', name: 'Bán hàng', icon: '🛍️', slug: 'ban-hang', parentId: 'viec-lam',
    attributes: [
      { key: 'salary', label: 'Mức lương', type: 'text', required: true },
      { key: 'type', label: 'Hình thức', type: 'select', options: ['Toàn thời gian', 'Bán thời gian'] },
      { key: 'exp', label: 'Kinh nghiệm', type: 'select', options: ['Không yêu cầu', 'Dưới 1 năm', 'Trên 1 năm'] }
    ]
  },
  { id: 'nhan-vien-phuc-vu', name: 'Nhân viên phục vụ', icon: '💁', slug: 'nhan-vien-phuc-vu', parentId: 'viec-lam', attributes: [] },
  { id: 'tai-xe-giao-hang', name: 'Lái xe, Giao hàng', icon: '🚚', slug: 'tai-xe-giao-hang', parentId: 'viec-lam', attributes: [] },
  { id: 'tap-vu', name: 'Tạp vụ', icon: '🧹', slug: 'tap-vu', parentId: 'viec-lam', attributes: [] },
  { id: 'pha-che', name: 'Pha chế', icon: '🍹', slug: 'pha-che', parentId: 'viec-lam', attributes: [] },
  { id: 'phu-bep', name: 'Phụ bếp', icon: '🍳', slug: 'phu-bep', parentId: 'viec-lam', attributes: [] },
  { id: 'nhan-vien-kinh-doanh', name: 'Nhân viên kinh doanh', icon: '📈', slug: 'nhan-vien-kinh-doanh', parentId: 'viec-lam', attributes: [] },
  { id: 'cong-nhan', name: 'Công nhân', icon: '🏭', slug: 'cong-nhan', parentId: 'viec-lam', attributes: [] },
  { id: 'bao-ve', name: 'Bảo vệ', icon: '🛡️', slug: 'bao-ve', parentId: 'viec-lam', attributes: [] },

  // ==================== 5. THÚ CƯNG ====================
  { id: 'thu-cung', name: 'Thú cưng', icon: '🐕', slug: 'thu-cung', parentId: null, order: 5 },
  // Con (Dựa theo ảnh Screenshot 675)
  { id: 'ga', name: 'Gà', icon: '🐓', slug: 'ga', parentId: 'thu-cung', attributes: [] },
  { 
    id: 'cho', name: 'Chó', icon: '🐕', slug: 'cho', parentId: 'thu-cung',
    attributes: [
      { key: 'breed', label: 'Giống chó', type: 'text', required: true },
      { key: 'age', label: 'Độ tuổi', type: 'text' }
    ]
  },
  { id: 'chim', name: 'Chim', icon: '🐦', slug: 'chim', parentId: 'thu-cung', attributes: [] },
  { 
    id: 'meo', name: 'Mèo', icon: '🐈', slug: 'meo', parentId: 'thu-cung',
    attributes: [
      { key: 'breed', label: 'Giống mèo', type: 'text', required: true },
      { key: 'age', label: 'Độ tuổi', type: 'text' }
    ]
  },
  { id: 'thu-cung-khac', name: 'Thú cưng khác', icon: '🐇', slug: 'thu-cung-khac', parentId: 'thu-cung', attributes: [] },
  { id: 'phu-kien-thu-cung', name: 'Phụ kiện, Thức ăn', icon: '🦴', slug: 'phu-kien-thu-cung', parentId: 'thu-cung', attributes: [] },

  // ==================== 6. ĐIỆN LẠNH, GIA DỤNG ====================
  { id: 'dien-lanh', name: 'Tủ lạnh, Máy lạnh, Máy giặt', icon: '❄️', slug: 'dien-lanh', parentId: null, order: 6 },
  // Con (Dựa theo ảnh Screenshot 676)
  { 
    id: 'tu-lanh', name: 'Tủ lạnh', icon: '🧊', slug: 'tu-lanh', parentId: 'dien-lanh',
    attributes: [
      { key: 'brand', label: 'Thương hiệu', type: 'text' },
      { key: 'capacity', label: 'Dung tích (Lít)', type: 'number' },
      { key: 'inverter', label: 'Inverter', type: 'select', options: ['Có', 'Không'] }
    ]
  },
  { 
    id: 'may-lanh', name: 'Máy lạnh, Điều hòa', icon: '🌬️', slug: 'may-lanh', parentId: 'dien-lanh',
    attributes: [
      { key: 'brand', label: 'Thương hiệu', type: 'text' },
      { key: 'capacity', label: 'Công suất (HP)', type: 'text' },
      { key: 'inverter', label: 'Inverter', type: 'select', options: ['Có', 'Không'] }
    ]
  },
  { 
    id: 'may-giat', name: 'Máy giặt', icon: '🧺', slug: 'may-giat', parentId: 'dien-lanh',
    attributes: [
      { key: 'brand', label: 'Thương hiệu', type: 'text' },
      { key: 'weight', label: 'Khối lượng giặt (kg)', type: 'number' },
      { key: 'type', label: 'Loại lồng', type: 'select', options: ['Cửa trên', 'Cửa ngang'] }
    ]
  },

  // ==================== 7. NỘI THẤT ====================
  { id: 'noi-that', name: 'Đồ gia dụng, Nội thất, Cây cảnh', icon: '🛋️', slug: 'noi-that', parentId: null, order: 7 },
  // Con (Dựa theo ảnh Screenshot 677)
  { id: 'ban-ghe', name: 'Bàn ghế', icon: '🪑', slug: 'ban-ghe', parentId: 'noi-that', attributes: [] },
  { id: 'tu-ke', name: 'Tủ, Kệ gia đình', icon: '🚪', slug: 'tu-ke', parentId: 'noi-that', attributes: [] },
  { id: 'giuong-nem', name: 'Giường, Chăn ga gối nệm', icon: '🛏️', slug: 'giuong-nem', parentId: 'noi-that', attributes: [] },
  { id: 'bep-lo', name: 'Bếp, Lò, Đồ điện nhà bếp', icon: '🍳', slug: 'bep-lo', parentId: 'noi-that', attributes: [] },
  { id: 'dung-cu-bep', name: 'Dụng cụ nhà bếp', icon: '🔪', slug: 'dung-cu-bep', parentId: 'noi-that', attributes: [] },
  { id: 'cay-canh', name: 'Cây cảnh, Đồ trang trí', icon: '🪴', slug: 'cay-canh', parentId: 'noi-that', attributes: [] },

  // ==================== 8. THỜI TRANG ====================
  { id: 'thoi-trang', name: 'Thời trang, Đồ dùng cá nhân', icon: '👕', slug: 'thoi-trang', parentId: null, order: 8 },
  // Con (Dựa theo ảnh Screenshot 679)
  { 
    id: 'quan-ao', name: 'Quần áo', icon: '👕', slug: 'quan-ao', parentId: 'thoi-trang',
    attributes: [
      { key: 'type', label: 'Loại', type: 'select', options: ['Áo thun', 'Sơ mi', 'Quần Jeans', 'Đầm/Váy', 'Áo khoác'] },
      { key: 'gender', label: 'Giới tính', type: 'select', options: ['Nam', 'Nữ', 'Unisex'] }
    ]
  },
  { id: 'dong-ho', name: 'Đồng hồ', icon: '⌚', slug: 'dong-ho', parentId: 'thoi-trang', attributes: [] },
  { id: 'giay-dep', name: 'Giày dép', icon: '👟', slug: 'giay-dep', parentId: 'thoi-trang', attributes: [] },
  { id: 'tui-xach', name: 'Túi xách', icon: '👜', slug: 'tui-xach', parentId: 'thoi-trang', attributes: [] },
  { id: 'nuoc-hoa', name: 'Nước hoa', icon: '🧴', slug: 'nuoc-hoa', parentId: 'thoi-trang', attributes: [] },

  // ==================== 9. GIẢI TRÍ, THỂ THAO ====================
  { id: 'giai-tri', name: 'Giải trí, Thể thao, Sở thích', icon: '⚽', slug: 'giai-tri', parentId: null, order: 9 },
  // Con (Dựa theo ảnh Screenshot 679 - phần dưới)
  { id: 'nhac-cu', name: 'Nhạc cụ', icon: '🎸', slug: 'nhac-cu', parentId: 'giai-tri', attributes: [] },
  { id: 'sach', name: 'Sách', icon: '📚', slug: 'sach', parentId: 'giai-tri', attributes: [] },
  { id: 'do-the-thao', name: 'Đồ thể thao, Dã ngoại', icon: '⛺', slug: 'do-the-thao', parentId: 'giai-tri', attributes: [] },
  { id: 'suu-tam', name: 'Đồ sưu tầm, Đồ cổ', icon: '🏺', slug: 'suu-tam', parentId: 'giai-tri', attributes: [] },

  // ==================== 10. MẸ VÀ BÉ ====================
  { id: 'me-va-be', name: 'Mẹ và Bé', icon: '👶', slug: 'me-va-be', parentId: null, order: 10, attributes: [] },

  // ==================== 11. DỊCH VỤ ====================
  { id: 'dich-vu', name: 'Dịch vụ, Du lịch', icon: '✈️', slug: 'dich-vu', parentId: null, order: 11 },
  // Con (Dựa theo ảnh Screenshot 674)
  { id: 'dich-vu-don-nha', name: 'Dịch vụ dọn dẹp nhà', icon: '🧹', slug: 'dich-vu-don-nha', parentId: 'dich-vu', attributes: [] },
  { id: 'dich-vu-chuyen-nha', name: 'Dịch vụ chuyển nhà', icon: '🚚', slug: 'dich-vu-chuyen-nha', parentId: 'dich-vu', attributes: [] },
  { id: 'dich-vu-sua-chua', name: 'Dịch vụ sửa chữa điện máy', icon: '🔧', slug: 'dich-vu-sua-chua', parentId: 'dich-vu', attributes: [] },

  // ==================== 12. KHÁC ====================
  { id: 'khac', name: 'Các loại khác', icon: '📦', slug: 'khac', parentId: null, order: 99, attributes: [] },
];

export const LOCATIONS = [
  'Toàn quốc', 'Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng', 'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu', 'Bắc Ninh', 'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước', 'Bình Thuận', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Đắk Nông', 'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Giang', 'Hà Nam', 'Hà Tĩnh', 'Hải Dương', 'Hậu Giang', 'Hòa Bình', 'Hưng Yên', 'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu', 'Lâm Đồng', 'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định', 'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên', 'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang', 'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái'
];

export const TIER_CONFIG = {
  free: {
    name: 'Gói Miễn Phí',
    maxImages: 3,
    badge: null,
    priority: 0,
    price: '0đ',
    features: ['Đăng tối đa 5 tin/ngày', 'Hiển thị tiêu chuẩn', 'Hỗ trợ cộng đồng']
  },
  basic: {
    name: 'Gói Basic',
    maxImages: 6,
    badge: 'VIP',
    priority: 1,
    price: '99.000đ/tháng',
    features: ['Đăng tối đa 15 tin/ngày', 'Huy hiệu VIP Bạc', 'Ưu tiên hiển thị trung bình', 'Duyệt tin tự động']
  },
  pro: {
    name: 'Gói Pro VIP',
    maxImages: 10,
    badge: 'PRO VIP',
    priority: 2,
    price: '299.000đ/tháng',
    features: ['Không giới hạn tin đăng', 'Huy hiệu PRO VIP Vàng', 'Ưu tiên hiển thị cao nhất', 'Viền tin đăng nổi bật', 'Đăng Video']
  }
};

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Admin Chợ của tui',
    email: 'admin@chocuatui.vn',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
    role: 'admin',
    status: 'active',
    phone: '0901234567',
    joinedAt: '2023-01-01',
    location: 'TPHCM',
    subscriptionTier: 'pro',
    walletBalance: 1500000
  },
  {
    id: 'u2',
    name: 'Nguyễn Văn A',
    email: 'vana@gmail.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
    role: 'user',
    status: 'active',
    phone: '0908765432',
    joinedAt: '2023-05-12',
    location: 'TP Hà Nội',
    subscriptionTier: 'free',
    walletBalance: 50000
  },
];
// --- 1. KHO DỮ LIỆU MẪU THEO DANH MỤC ---
const REALISTIC_DATA: Record<string, { titles: string[], priceRange: [number, number], keywords: string[] }> = {
  // Bất động sản
  'can-ho-chung-cu': {
    titles: ['Căn hộ Vinhome Grand Park 2PN view đẹp', 'Chung cư Masteri Thảo Điền full nội thất', 'Căn hộ Ecopark xanh mát, giá ngộp', 'Chung cư mini quận Cầu Giấy cho thuê', 'Penthouse Landmark 81 view sông'],
    priceRange: [1500000000, 10000000000],
    keywords: ['apartment', 'condo', 'living room']
  },
  'nha-o': {
    titles: ['Nhà phố liền kề 3 tầng, sổ đỏ chính chủ', 'Bán nhà hẻm xe hơi quận Tân Bình', 'Nhà cấp 4 có gác lửng, tiện xây mới', 'Biệt thự sân vườn ngoại ô', 'Nhà mặt tiền kinh doanh sầm uất'],
    priceRange: [2000000000, 25000000000],
    keywords: ['house', 'villa', 'modern house']
  },
  'phong-tro': {
    titles: ['Phòng trọ giá rẻ sinh viên', 'Căn hộ dịch vụ full đồ', 'Phòng trọ gác xép, giờ giấc tự do', 'Sleepbox cao cấp trung tâm Q1', 'Nhà trọ an ninh, có camera'],
    priceRange: [1500000, 6000000],
    keywords: ['bedroom', 'small room', 'dorm']
  },

  // Xe cộ
  'xe-may': {
    titles: ['Honda Vision 2021 chính chủ nữ đi', 'SH 150i ABS đời 2022 lướt', 'Exciter 150 kiểng nhẹ, máy zin', 'Yamaha Grande Hybrid biển số đẹp', 'Wave Alpha máy êm, giá sinh viên'],
    priceRange: [10000000, 90000000],
    keywords: ['scooter', 'motorcycle', 'vespa']
  },
  'o-to': {
    titles: ['Mazda 3 2020 Luxury màu đỏ', 'VinFast Lux A2.0 bản cao cấp', 'Hyundai Accent 2023 lướt 5000km', 'Toyota Vios E CVT bền bỉ', 'Kia Carnival Signature máy dầu'],
    priceRange: [400000000, 1500000000],
    keywords: ['car', 'sedan', 'suv']
  },

  // Điện tử
  'dien-thoai': {
    titles: ['iPhone 14 Pro Max 256GB Tím VNA', 'Samsung S23 Ultra mới 99%', 'Xiaomi 13 Pro chính hãng fullbox', 'iPhone 11 64GB Quốc tế pin 90%', 'Oppo Reno 8Z chụp ảnh đẹp'],
    priceRange: [3000000, 30000000],
    keywords: ['smartphone', 'iphone', 'samsung phone']
  },
  'laptop': {
    titles: ['MacBook Air M1 8GB/256GB sạc ít', 'Dell XPS 13 viền mỏng, sang trọng', 'Asus TUF Gaming chiến game mượt', 'Lenovo ThinkPad bền bỉ cho coder', 'HP Pavilion văn phòng mỏng nhẹ'],
    priceRange: [8000000, 40000000],
    keywords: ['laptop', 'macbook', 'computer office']
  },

  // Mặc định cho các cái khác
  'default': {
    titles: ['Thanh lý đồ cũ giá rẻ', 'Dọn nhà cần pass lại', 'Hàng xách tay chưa qua sử dụng', 'Cần bán gấp để về quê', 'Đồ sưu tầm hiếm có'],
    priceRange: [50000, 2000000],
    keywords: ['box', 'shopping', 'product']
  }
};

// --- 2. HÀM SINH DỮ LIỆU THÔNG MINH ---
export const generateMockListings = (count: number): Listing[] => {
  return Array.from({ length: count }).map((_, i) => {
    // 1. Chọn ngẫu nhiên danh mục
    const category = CATEGORIES[i % CATEGORIES.length];
    
    // 2. Lấy bộ dữ liệu mẫu tương ứng (nếu không có thì dùng default)
    const data = REALISTIC_DATA[category.id] || REALISTIC_DATA['default'];
    
    // 3. Random dữ liệu
    const title = data.titles[Math.floor(Math.random() * data.titles.length)];
    const price = Math.floor(Math.random() * (data.priceRange[1] - data.priceRange[0])) + data.priceRange[0];
    const keyword = data.keywords[Math.floor(Math.random() * data.keywords.length)];
    
    // 4. Tạo ảnh "xịn" hơn dùng LoremFlickr (theo keyword)
    // Thêm ?lock=i để ảnh không bị đổi mỗi lần reload, nhưng khác nhau giữa các tin
    const image = `https://loremflickr.com/800/600/${keyword}?lock=${i}`;

    return {
      id: `l${i + 1}`,
      title: title,
      description: `Cần bán ${title}. Tình trạng còn rất tốt, xem hàng trực tiếp để kiểm tra. Fix nhẹ cho anh em thiện chí nhanh gọn. Liên hệ ngay!`,
      price: price - (price % 10000), // Làm tròn số tiền cho đẹp (vd: 12.500.000)
      category: category.id, 
      parentCategory: category.parentId || null, // Tự động gán cha nếu có
      images: [image, `https://loremflickr.com/800/600/${keyword}?lock=${i + 1000}`], // 2 ảnh khác nhau
      location: LOCATIONS[(i % (LOCATIONS.length - 1)) + 1],
      
      sellerId: `u${(i % 2) + 1}`,
      sellerName: i % 2 === 0 ? 'Admin Chợ' : 'Người dùng mẫu',
      sellerAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=user${(i % 2) + 1}`,
      
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 10 * 24 * 60 * 60 * 1000)).toISOString(), // Random trong 10 ngày qua
      status: 'approved',
      condition: i % 3 === 0 ? 'new' : 'used',
      tier: i < 5 ? 'pro' : (i < 15 ? 'basic' : 'free'),
      
      // Tạo slug giả để link đẹp
      slug: title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
    };
  });
};
