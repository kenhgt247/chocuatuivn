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
export type MessageType = 'text' | 'image' | 'location' | 'offer' | 'swap';

// Trạng thái của một lời mặc cả
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

// ==========================================
// 2. CÁC INTERFACE CHÍNH (CORE)
// ==========================================

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string; // Đã sửa thành optional để tránh lỗi nếu null
  role: UserRole;
  status: UserStatus;
  phone?: string;
  joinedAt: string;
 isOnline?: boolean;       // Trạng thái online
  lastActiveAt?: any;  
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

// Interface cho Cấu hình Trường nhập liệu động
export interface CategoryAttribute {
  key: string;        // Tên biến lưu vào DB (vd: 'odo', 'ram')
  label: string;      // Tên hiển thị ra màn hình (vd: 'Số Km', 'Dung lượng RAM')
  type: 'text' | 'number' | 'select'; // Kiểu nhập liệu
  options?: string[]; // Các lựa chọn (nếu type là 'select')
  suffix?: string;    // Đơn vị (vd: 'Km', 'm²', 'GB')
  required?: boolean; // Bắt buộc nhập hay không
}

// Interface Category để hỗ trợ Dynamic Fields & Parent/Child
export interface Category {
  id: string;         // Slug (vd: 'bat-dong-san')
  name: string;
  icon?: string;      // Optional
  slug?: string;      // Optional
  parentId?: string | null; // ID của danh mục cha (nếu null là danh mục gốc)
  order?: number;     // Số thứ tự sắp xếp
  attributes?: CategoryAttribute[]; // Mảng chứa cấu hình các trường nhập liệu
  subcategories?: string[]; // (Cũ - Giữ lại để tránh lỗi code cũ nếu có)
}

// [CẬP NHẬT] Thêm trường cho Đấu giá vào Listing
export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  videoUrl?: string | null;     // Link video ngắn sản phẩm
  affiliateLink?: string | null;
  
  // --- SEO & TÌM KIẾM ---
  slug?: string;         
  keywords?: string[];   
  viewCount?: number;    

  // --- THÔNG TIN VỊ TRÍ ---
  location: string; 
  address?: string; 
  lat?: number | null;      
  lng?: number | null;      

  // --- NGƯỜI BÁN ---
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  
  // --- METADATA ---
  createdAt: string;
  updatedAt?: string;    
  
  status: ListingStatus;
  condition: 'new' | 'used';
  tier?: SubscriptionTier; 
  
  // --- THÔNG SỐ KỸ THUẬT ---
  attributes?: Record<string, any>;
  
  // --- [MỚI] TÍNH NĂNG ĐẤU GIÁ ---
  isAuction?: boolean;          // Có phải tin đấu giá không?
  auctionEndAt?: string;        // Thời gian kết thúc (ISO String)
  bidIncrement?: number;        // Bước giá tối thiểu
  bidsCount?: number;           // Tổng số lượt đấu giá
  highestBidderId?: string;     // ID người đang trả giá cao nhất
}

// [MỚI] Interface cho Lịch sử Đấu giá (Bid)
export interface Bid {
  id: string;
  listingId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  amount: number;
  createdAt: string;
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
  text: string;           // Nội dung hiển thị tóm tắt hoặc nội dung chính
  timestamp: string;      // ISO String
  
  // Phân loại tin nhắn
  type: MessageType;      
  
  // Dữ liệu riêng cho từng loại:
  imageUrl?: string;      // Dùng khi type = 'image'
  
  location?: {            // Dùng khi type = 'location'
    lat: number;
    lng: number;
    address?: string;
  };

  offerId?: string;       // Dùng khi type = 'offer' (Mặc cả)
  
  swapData?: {            // Dùng khi type = 'swap' (Đổi đồ)
    offeredItemName: string;
    offeredItemImage: string;
    cashTopUp: number;    // Số tiền bù thêm (dương) hoặc nhận lại (âm)
    status?: 'accepted' | 'rejected';
  };

  metadata?: any;         // Dữ liệu mở rộng (ví dụ: reply story)
  isSystem?: boolean;     // Tin nhắn thông báo từ hệ thống
}

export interface ChatRoom {
  id: string;
  
  // Thông tin sản phẩm đang chat
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;

  // Thành viên tham gia
  participantIds: string[];
  participantsData?: Record<string, { 
    name: string; 
    avatar: string 
  }>;

  // Nội dung chat
  messages: Message[];
  
  // Metadata hiển thị danh sách
  lastMessage?: string;
  lastUpdate: string;     // Để sắp xếp tin mới nhất lên đầu
  seenBy?: string[];      // Mảng chứa ID những người đã xem tin cuối
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
export interface Story {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  videoUrl: string;       // (Ta vẫn dùng trường này để lưu link ảnh hoặc video)
  mediaType: 'image' | 'video'; // <--- THÊM DÒNG NÀY
  createdAt: number;
  expiresAt: number;
  views: number;
}