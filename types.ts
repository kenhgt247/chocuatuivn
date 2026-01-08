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
  location?: string; 
  address?: string; 
  lat?: number;      
  lng?: number;      

  subscriptionTier: SubscriptionTier;
  subscriptionExpires?: string;
  walletBalance: number;
  followers?: string[];
  following?: string[];
  
  // --- MỚI: Các trường cho tính năng xác thực ---
  verificationStatus?: VerificationStatus; 
  verificationDocuments?: string[]; 
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
  
  // [BỔ SUNG CHO CHUẨN] Dùng để lưu thông tin gói VIP khi mua
  metadata?: any; 
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
  location: string; 
  address?: string; 
  lat?: number;     
  lng?: number;     

  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  condition: 'new' | 'used';
  tier: SubscriptionTier;
  isFavorite?: boolean;
  
  // --- MỚI: Các trường thông tin cứng (Attributes) ---
  attributes?: {
    battery?: string;  
    mileage?: string;  
    area?: string;     
    year?: string;     
    storage?: string;  
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
  updatedAt?: string; 
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
  image?: string; 
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
  // UPDATE: Thêm các loại thông báo mới
  type: 'info' | 'success' | 'warning' | 'error' | 'review' | 'message' | 'approval' | 'follow' | 'system';
  read: boolean;
  createdAt: string;
  
  // [QUAN TRỌNG] Link để điều hướng khi bấm vào thông báo
  link?: string;
}

// ==========================================
// [MỚI] CÁC INTERFACE CHO CẤU HÌNH HỆ THỐNG
// ==========================================

export interface BannerSlide {
  id: number;
  isActive: boolean;        // Bật/Tắt
  type: 'text' | 'image';   // Loại banner
  
  // Dùng cho loại Text
  title?: string;
  desc?: string;
  btnText?: string;
  btnLink?: string;
  colorFrom?: string;
  colorTo?: string;
  icon?: string;

  // Dùng cho loại Image
  imageUrl?: string; 
}

export interface SystemSettings {
  pushPrice: number;
  pushDiscount?: number;
  tierDiscount: number;
  
  tierConfigs: {
    free: { price: number; maxImages: number; features: string[] };
    basic: { price: number; maxImages: number; features: string[] };
    pro: { price: number; maxImages: number; features: string[] };
  };
  
  // Cấu hình Ngân hàng (VietQR)
  bankName: string;
  accountNumber: string;
  accountName: string;
  beneficiaryQR?: string;

  // [MỚI] Cấu hình Banner
  bannerSlides?: BannerSlide[];
}
