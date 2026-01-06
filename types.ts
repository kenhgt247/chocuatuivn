export type UserRole = 'user' | 'admin';
export type SubscriptionTier = 'free' | 'basic' | 'pro';
export type UserStatus = 'active' | 'banned';

// --- MỚI: Trạng thái xác thực (KYC) ---
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  joinedAt: string;
  
  // --- THÔNG TIN VỊ TRÍ ---
  location?: string; // Tỉnh/Thành phố (Dùng để lọc chung, ví dụ: TPHCM)
  address?: string;  // <--- QUAN TRỌNG: Địa chỉ cụ thể (Số nhà, đường, phường - Dùng để hiển thị)
  lat?: number;      // Vĩ độ
  lng?: number;      // Kinh độ

  subscriptionTier: SubscriptionTier;
  subscriptionExpires?: string;
  walletBalance: number;
  followers?: string[];
  following?: string[];
  
  // --- MỚI: Các trường cho tính năng xác thực ---
  verificationStatus?: VerificationStatus; 
  verificationDocuments?: string[]; // Chứa link ảnh mặt trước, mặt sau
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'deposit' | 'payment';
  method?: string;
  description: string;
  status: 'success' | 'pending' | 'failed';
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  slug: string;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  
  // --- THÔNG TIN VỊ TRÍ ---
  location: string; // Tỉnh/Thành phố (Bắt buộc để lọc)
  address?: string; // <--- QUAN TRỌNG: Địa chỉ cụ thể (Hiển thị chi tiết cho người mua)
  lat?: number;     // Vĩ độ
  lng?: number;     // Kinh độ

  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  condition: 'new' | 'used';
  tier: SubscriptionTier;
  isFavorite?: boolean;
  
  // --- MỚI: Các trường thông tin cứng (Attributes) ---
  // Dùng Record để linh hoạt cho nhiều loại danh mục khác nhau
  attributes?: {
    battery?: string;  // Phần trăm pin
    mileage?: string;  // Số Km đã đi
    area?: string;     // Diện tích m2
    year?: string;     // Năm sản xuất
    storage?: string;  // Dung lượng bộ nhớ
    [key: string]: any; 
  };
}

export interface Review {
  id: string;
  targetId: string; 
  targetType: 'listing' | 'user';
  authorId: string;
  authorName: string;
  authorAvatar: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt?: string; // (Tùy chọn) Thời gian cập nhật
}

export interface Report {
  id: string;
  listingId: string;
  userId: string;
  reason: string;
  details?: string;
  createdAt: string;
  status: 'pending' | 'resolved';
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  image?: string; // (Tùy chọn) Hỗ trợ gửi ảnh trong chat
}

export interface ChatRoom {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;
  participantIds: string[];
  messages: Message[];
  lastMessage?: string;
  lastUpdate: string;
  seenBy: string[];
}

export interface Favorite {
  userId: string;
  listingId: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  link?: string;
}