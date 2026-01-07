import { Listing, Category } from '../types';

// ========================================================================
// 1. FORMATTING UTILS (GIỮ NGUYÊN)
// ========================================================================

export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(price);
};

export const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Vừa xong';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
  return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
};

// ========================================================================
// 2. TEXT PROCESSING UTILS (LOGIC TÌM KIẾM THÔNG MINH MỚI)
// ========================================================================

/**
 * Hàm xóa dấu tiếng Việt, chuyển về chữ thường, xóa ký tự đặc biệt
 * Input: "Điện Thoại iPhone 15!"
 * Output: "dien thoai iphone 15"
 */
export const removeVietnameseTones = (str: string): string => {
  if (!str) return '';
  str = str.toLowerCase();
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  // Xóa ký tự đặc biệt, giữ lại chữ cái, số và khoảng trắng
  str = str.replace(/[^a-z0-9\s]/g, '');
  // Xóa khoảng trắng thừa
  return str.replace(/\s+/g, ' ').trim();
};

export const slugify = (text: string): string => {
  return removeVietnameseTones(text).replace(/\s+/g, '-');
};

export const getListingUrl = (listing: Listing): string => {
  const slug = slugify(listing.title);
  return `/san-pham/${slug}-${listing.id}`;
};

export const getCategoryUrl = (category: Category): string => {
  const slug = category.slug || slugify(category.name);
  return `/danh-muc/${slug}`;
};

// ========================================================================
// 3. SMART SEARCH ENGINE (CỐT LÕI)
// ========================================================================

/**
 * Kiểm tra xem một đoạn văn bản (target) có khớp với từ khóa tìm kiếm (query) không.
 * Hỗ trợ: Không dấu, sai hoa thường, đảo trật tự từ.
 * * Ví dụ: 
 * Target: "Bán xe máy Honda Vision màu đỏ"
 * Query: "xe honda do" -> TRUE
 */
export const isSearchMatch = (targetText: string, searchQuery: string): boolean => {
  if (!searchQuery) return true;
  if (!targetText) return false;

  // 1. Chuẩn hóa cả hai về dạng: 'ban xe may honda vision mau do'
  const cleanTarget = removeVietnameseTones(targetText);
  const cleanQuery = removeVietnameseTones(searchQuery);

  // 2. Kiểm tra khớp tuyệt đối (nhanh nhất)
  // VD: Query "vision" nằm trọn trong Target
  if (cleanTarget.includes(cleanQuery)) return true;

  // 3. Kiểm tra khớp từng từ khóa (Token Matching) - Xử lý "gõ dài gõ ngắn"
  // VD: Query "honda do" -> Tách thành ["honda", "do"]
  const queryTokens = cleanQuery.split(' ');
  
  // Kiểm tra xem MỌI từ trong query có xuất hiện trong target không
  // Nếu user gõ "honda do", thì target phải có chữ "honda" VÀ chữ "do"
  const isAllTokensFound = queryTokens.every(token => cleanTarget.includes(token));

  return isAllTokensFound;
};

/**
 * Tính điểm độ phù hợp (Relevance Score) - Dùng để sắp xếp kết quả
 * Điểm càng cao càng hiển thị lên đầu.
 */
export const calculateRelevanceScore = (targetText: string, searchQuery: string): number => {
  const cleanTarget = removeVietnameseTones(targetText);
  const cleanQuery = removeVietnameseTones(searchQuery);

  if (cleanTarget === cleanQuery) return 100; // Khớp hoàn toàn 100%
  if (cleanTarget.startsWith(cleanQuery)) return 80; // Bắt đầu bằng từ khóa
  if (cleanTarget.includes(cleanQuery)) return 60; // Chứa nguyên cụm từ khóa

  // Khớp từng từ
  const queryTokens = cleanQuery.split(' ');
  let matchCount = 0;
  queryTokens.forEach(token => {
    if (cleanTarget.includes(token)) matchCount++;
  });

  // Điểm = Tỷ lệ số từ khớp / Tổng số từ tìm kiếm * 40
  return (matchCount / queryTokens.length) * 40;
};