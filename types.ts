// ==========================================
// 1. CÁC ĐỊNH NGHĨA TYPE (ENUMS/UNIONS)
// ==========================================

export type UserRole = 'user' | 'admin';
export type SubscriptionTier = 'free' | 'basic' | 'pro';
export type UserStatus = 'active' | 'banned';

// Trạng thái xác thực danh tính (KYC)
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

// Trạng thái tin đăng
export type ListingStatus = 'pending' | 'approved' | 'rejected' | 'sold' | 'hidden';

// Loại thông báo
export type NotificationType = 
  | 'info' | 'success' | 'warning' | 'error' 
  | 'review' | 'message' | 'approval' | 'follow' | 'offer' | 'system';

// Loại tin nhắn chat
export type MessageType = 'text' | 'image' | 'location' | 'offer';

// Trạng thái của một lời mặc cả
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

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
  walletBalance?: number; 
  
  // --- SOCIAL ---
  followers?: string[];
  following?: string[];
  
  // --- XÁC THỰC (KYC) ---
  verificationStatus?: VerificationStatus; 
  idCardFront?: string; 
  idCardBack?: string;  
}

// [MỚI] Interface cho Cấu hình Trường nhập liệu động
export interface CategoryAttribute {
  key: string;        // Tên biến lưu vào DB (vd: 'odo', 'ram')
  label: string;      // Tên hiển thị ra màn hình (vd: 'Số Km', 'Dung lượng RAM')
  type: 'text' | 'number' | 'select'; // Kiểu nhập liệu
  options?: string[]; // Các lựa chọn (nếu type là 'select')
  suffix?: string;    // Đơn vị (vd: 'Km', 'm²', 'GB')
  required?: boolean; // Bắt buộc nhập hay không
}

// [CẬP NHẬT] Interface Category để hỗ trợ Dynamic Fields & Parent/Child
export interface Category {
  id: string;         // Slug (vd: 'bat-dong-san')
  name: string;
  icon: string;
  slug: string;       // Giống id (để tương thích ngược)
  parentId?: string | null; // ID của danh mục cha (nếu null là danh mục gốc)
  order?: number;     // Số thứ tự sắp xếp
  attributes?: CategoryAttribute[]; // Mảng chứa cấu hình các trường nhập liệu
  subcategories?: string[]; // (Cũ - Giữ lại để tránh lỗi code cũ nếu có)
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  videoUrl?: string;     // Link video ngắn sản phẩm
  affiliateLink?: string;
  
  // --- SEO & TÌM KIẾM ---
  slug?: string;         
  keywords?: string[];   
  viewCount?: number;    

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
  updatedAt?: string;    
  
  status: ListingStatus;
  condition: 'new' | 'used';
  tier: SubscriptionTier; 
  
  // --- THÔNG SỐ KỸ THUẬT ---
  attributes?: {
    brand?: string;
    color?: string;
    warranty?: string;
    battery?: string;  
    mileage?: string;  
    area?: string;     
    year?: string;     
    storage?: string;  
    [key: string]: any; 
  };
}

// ==========================================
// 3. TƯƠNG TÁC (OFFER, CHAT, REVIEW, NOTIF)
// ==========================================

export interface Offer {
  id: string;
  listingId: string;
  listingTitle: string; // Lưu dư thừa để hiển thị nhanh
  listingImage: string;
  
  buyerId: string;
  buyerName: string;
  
  sellerId: string;
  
  originalPrice: number; // Giá gốc
  offerPrice: number;    // Giá khách trả
  
  status: OfferStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  type?: MessageType; // Loại tin nhắn (text, image, offer...)
  image?: string; 
  offerId?: string;   // Nếu là tin nhắn mặc cả thì có ID này
  isSystem?: boolean; // Tin nhắn hệ thống (không phải người chat)
}

export interface ChatRoom {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;
  participantIds: string[];
  participantsData?: Record<string, { name: string; avatar: string }>; 
  messages: Message[];
  lastMessage?: string;
  lastUpdate: string;
  seenBy?: string[];
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
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  link?: string; 
  image?: string; 
}

export interface Report {
  id: string;
  listingId?: string;
  targetUserId?: string; 
  userId: string;        
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
  method?: string; 
  description: string;
  status: 'success' | 'pending' | 'failed';
  createdAt: string;
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

export interface TierConfig {
  name: string;
  price: number;
  maxImages: number;
  postsPerDay: number;
  autoApprove: boolean;
  features: string[];
  allowVideo: boolean; 
}

export interface SystemSettings {
  pushPrice: number;
  pushDiscount: number;
  tierDiscount: number;
  
  tierConfigs: {
    free: TierConfig;
    basic: TierConfig;
    pro: TierConfig;
  };
  
  bankName: string;
  accountNumber: string;
  accountName: string;
  beneficiaryQR?: string;

  bannerSlides?: BannerSlide[];
}