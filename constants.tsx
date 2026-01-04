
import React from 'react';
import { Category, Listing, User, SubscriptionTier } from './types';

export const PUSH_LISTING_PRICE = 20000; // Giá đẩy tin: 20.000đ

export const CATEGORIES: Category[] = [
  { id: '1', name: 'Bất động sản', icon: '🏠', slug: 'bat-dong-san' },
  { id: '2', name: 'Xe cộ', icon: '🚗', slug: 'xe-co' },
  { id: '3', name: 'Đồ điện tử', icon: '💻', slug: 'do-dien-tu' },
  { id: '4', name: 'Đồ gia dụng, nội thất', icon: '🛋️', slug: 'do-gia-dung-noi-that' },
  { id: '5', name: 'Giải trí, Thể thao, Sở thích', icon: '🎨', slug: 'giai-tri-the-thao-so-thich' },
  { id: '6', name: 'Đồ dùng cá nhân', icon: '👕', slug: 'do-dung-ca-nhan' },
  { id: '7', name: 'Mẹ và bé', icon: '👶', slug: 'me-va-be' },
  { id: '8', name: 'Thú cưng', icon: '🐕', slug: 'thu-cung' },
  { id: '9', name: 'Đồ ăn, thực phẩm', icon: '🍎', slug: 'do-an-thuc-pham' },
  { id: '10', name: 'Tủ lạnh, máy lạnh, máy giặt', icon: '❄️', slug: 'dien-lanh' },
  { id: '11', name: 'Việc làm', icon: '💼', slug: 'viec-lam' },
  { id: '12', name: 'Dịch vụ, Du lịch', icon: '✈️', slug: 'dich-vu-du-lich' },
  { id: '13', name: 'Các loại khác', icon: '📦', slug: 'cac-loai-khac' },
];

export const LOCATIONS = [
  'Toàn quốc', 'TP Hà Nội', 'TP Huế', 'Quảng Ninh', 'Cao Bằng', 'Lạng Sơn', 'Lai Châu', 'Điện Biên', 'Sơn La', 'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Tuyên Quang', 'Lào Cai', 'Thái Nguyên', 'Phú Thọ', 'Bắc Ninh', 'Hưng Yên', 'TP Hải Phòng', 'Ninh Bình', 'Quảng Trị', 'TP Đà Nẵng', 'Quảng Ngãi', 'Gia Lai', 'Khánh Hòa', 'Lâm Đồng', 'Đánh Lắk', 'TPHCM', 'Đồng Nai', 'Tây Ninh', 'TP Cần Thơ', 'Vĩnh Long', 'Đồng Tháp', 'Cà Mau', 'An Giang'
];

export const TIER_CONFIG = {
  free: {
    name: 'Gói Miễn Phí',
    maxImages: 3,
    badge: null,
    priority: 0,
    price: '0đ',
    features: ['Đăng tối đa 3 ảnh', 'Hiển thị tiêu chuẩn', 'Hỗ trợ cộng đồng']
  },
  basic: {
    name: 'Gói Basic',
    maxImages: 6,
    badge: 'VIP',
    priority: 1,
    price: '99.000đ/tháng',
    features: ['Đăng tối đa 6 ảnh', 'Huy hiệu VIP Bạc', 'Ưu tiên hiển thị trung bình', 'AI phân tích ảnh (5 lần/ngày)']
  },
  pro: {
    name: 'Gói Pro VIP',
    maxImages: 10,
    badge: 'PRO VIP',
    priority: 2,
    price: '299.000đ/tháng',
    features: ['Đăng tối đa 10 ảnh', 'Huy hiệu PRO VIP Vàng', 'Ưu tiên hiển thị cao nhất', 'Không giới hạn AI', 'Viền tin đăng nổi bật']
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

export const generateMockListings = (count: number): Listing[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `l${i + 1}`,
    title: `Sản phẩm mẫu ${i + 1} - ${CATEGORIES[i % CATEGORIES.length].name}`,
    description: `Mô tả chi tiết sản phẩm chất lượng cao, giá cả phải chăng cho sản phẩm thứ ${i + 1}.`,
    price: Math.floor(Math.random() * 500) * 10000 + 50000,
    category: CATEGORIES[i % CATEGORIES.length].id,
    images: [`https://picsum.photos/seed/list${i + 1}/800/600`],
    location: LOCATIONS[(i % (LOCATIONS.length - 1)) + 1],
    sellerId: `u${(i % 2) + 1}`,
    sellerName: i % 2 === 0 ? 'Admin Chợ của tui' : 'Nguyễn Văn A',
    sellerAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=user${(i % 2) + 1}`,
    createdAt: new Date(Date.now() - i * 3600000).toISOString(),
    status: 'approved',
    condition: i % 2 === 0 ? 'new' : 'used',
    tier: i < 5 ? 'pro' : (i < 15 ? 'basic' : 'free'),
  }));
};
