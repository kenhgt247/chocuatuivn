// types.ts

// ==========================================
// 1. CÁC ĐỊNH NGHĨA TYPE (ENUMS/UNIONS)
// ==========================================

export type UserRole = 'user' | 'admin';
export type SubscriptionTier = 'free' | 'basic' | 'pro';
export type UserStatus = 'active' | 'banned';

// Trạng thái xác thực danh tính (KYC)
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

// Trạng thái tin đăng (Đã bổ sung 'sold' và 'hidden')
export type ListingStatus = 'pending' | 'approved' | 'rejected' | 'sold' | 'hidden';

// Loại thông báo
export type NotificationType = 
  | 'info' | 'success' | 'warning' | 'error' 
  | 'review' | 'message' | 'approval' | 'follow' | 'system';

// ==========================================
// 2. CÁC INTERFACE CHÍNH (CORE)
// ==========================================

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

  // --- VÍ & GÓI CƯỚC ---
  subscriptionTier: SubscriptionTier;
  subscriptionExpires?: string;
  walletBalance?: number; // Cho phép undefined để tránh lỗi khi user cũ chưa có field này
  
  // --- SOCIAL ---
  followers?: string[];
  following?: string[];
  
  // --- XÁC THỰC (KYC) ---
  verificationStatus?: VerificationStatus; 
  idCardFront?: string; // Ảnh CMND mặt trước
  idCardBack?: string;  // Ảnh CMND mặt sau
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  
  // --- SEO & TÌM KIẾM (QUAN TRỌNG) ---
  slug?: string;         // URL SEO (vd: ban-iphone-15-pro)
  keywords?: string[];   // [MỚI] Mảng từ khóa hỗ trợ thuật toán tìm kiếm Hybrid
  viewCount?: number;    // [MỚI] Đếm lượt xem

  // --- THÔNG TIN VỊ TRÍ ---
  location: string; 
  address?: string; 
  lat?: number;      
  lng?: number;      

  // --- NGƯỜI BÁN ---
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  
  // --- METADATA ---
  createdAt: string;
  updatedAt?: string;    // Thời gian cập nhật (khi sửa hoặc đẩy tin)
  
  status: ListingStatus;
  condition: 'new' | 'used';
  tier: SubscriptionTier; // Gói tin (VIP/Thường)
  
  // --- THÔNG SỐ KỸ THUẬT (LINH HOẠT) ---
  attributes?: {
    brand?: string;
    color?: string;
    warranty?: string;
    battery?: string;  
    mileage?: string;  
    area?: string;     
    year?: string;     
    storage?: string;  
    [key: string]: any; // Cho phép thêm các trường động khác
  };
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  slug: string;
  subcategories?: string[];
}

// ==========================================
// 3. TƯƠNG TÁC (CHAT, REVIEW, NOTIF)
// ==========================================

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  image?: string; 
}

export interface ChatRoom {
  id: string;
  // Thông tin tóm tắt sản phẩm để hiển thị trên header chat
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;
  
  participantIds: string[];
  
  // [QUAN TRỌNG] Cache thông tin user để không phải query lại
  participantsData?: Record<string, { name: string; avatar: string }>; 
  
  messages: Message[];
  lastMessage?: string;
  lastUpdate: string;
  seenBy?: string[]; // Mảng ID của những người đã xem tin nhắn cuối
}

export interface Review {
  id: string;
  targetId: string;      // ID người được đánh giá hoặc ID sản phẩm
  targetType: 'listing' | 'user';
  authorId: string;
  authorName: string;
  authorAvatar: string;
  rating: number;        // 1-5 sao
  comment: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  link?: string;         // Đường dẫn khi click vào (vd: /listings/slug-id)
  image?: string;        // Thumbnail (nếu có)
}

export interface Report {
  id: string;
  listingId?: string;
  targetUserId?: string; // Có thể báo cáo người dùng thay vì tin đăng
  userId: string;        // Người báo cáo
  reason: string;
  details?: string;
  createdAt: string;
  status: 'pending' | 'resolved' | 'dismissed';
}

// ==========================================
// 4. TÀI CHÍNH & HỆ THỐNG
// ==========================================

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'deposit' | 'payment' | 'refund';
  method?: string;       // Banking, Momo, Wallet...
  description: string;
  status: 'success' | 'pending' | 'failed';
  createdAt: string;
  
  // Metadata dùng để lưu thông tin mở rộng (vd: mua gói VIP nào)
  metadata?: {
    targetTier?: SubscriptionTier;
    listingId?: string;
    [key: string]: any;
  }; 
}

export interface BannerSlide {
  id: number;
  isActive: boolean;        
  type: 'text' | 'image';   
  
  title?: string;
  desc?: string;
  btnText?: string;
  btnLink?: string;
  colorFrom?: string;
  colorTo?: string;
  icon?: string;
  imageUrl?: string; 
}

export interface SystemSettings {
  pushPrice: number;
  pushDiscount: number;
  tierDiscount: number;
  
  tierConfigs: {
    free: { name: string; price: number; maxImages: number; postsPerDay: number; autoApprove: boolean; features: string[] };
    basic: { name: string; price: number; maxImages: number; postsPerDay: number; autoApprove: boolean; features: string[] };
    pro: { name: string; price: number; maxImages: number; postsPerDay: number; autoApprove: boolean; features: string[] };
  };
  
  bankName: string;
  accountNumber: string;
  accountName: string;
  beneficiaryQR?: string;

  bannerSlides?: BannerSlide[];
}
