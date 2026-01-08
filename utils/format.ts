import { Listing, Category } from '../types';

// ========================================================================
// 1. FORMATTING UTILS (GIỮ NGUYÊN LOGIC CỦA BẠN)
// ========================================================================

export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(price);
};

export const formatTimeAgo = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Vừa xong';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
  return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
};

// ========================================================================
// 2. TEXT PROCESSING UTILS
// ========================================================================

/**
 * Hàm xóa dấu tiếng Việt, chuyển về chữ thường, xóa ký tự đặc biệt
 */
export const removeVietnameseTones = (str: string): string => {
  if (!str) return '';
  str = str.toLowerCase();
  str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  str = str.replace(/đ/g, 'd');
  // Xóa ký tự đặc biệt, chỉ giữ lại chữ cái và số
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
// 3. SMART SEARCH ENGINE (CỐT LÕI TÌM KIẾM THÔNG MINH)
// ========================================================================

/**
 * Thuật toán Levenshtein Distance
 * Tính số bước ít nhất để biến chuỗi a thành chuỗi b
 * Dùng để phát hiện lỗi chính tả (typo). VD: "evrest" -> "everest"
 */
const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // thay thế
          Math.min(
            matrix[i][j - 1] + 1,   // chèn
            matrix[i - 1][j] + 1    // xóa
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

/**
 * Kiểm tra xem một đoạn văn bản (target) có khớp với từ khóa tìm kiếm (query) không.
 * Hỗ trợ:
 * 1. Khớp chính xác.
 * 2. Khớp từng từ (đảo từ).
 * 3. Khớp mờ (Fuzzy Match) - Gõ sai chính tả vẫn tìm ra.
 */
export const isSearchMatch = (targetText: string, searchQuery: string): boolean => {
  if (!searchQuery) return true;
  if (!targetText) return false;

  const cleanTarget = removeVietnameseTones(targetText);
  const cleanQuery = removeVietnameseTones(searchQuery);

  // 1. Kiểm tra khớp tuyệt đối (Ưu tiên cao nhất)
  if (cleanTarget.includes(cleanQuery)) return true;

  // 2. Phân tách từ để so sánh (Token Matching)
  const queryTokens = cleanQuery.split(' ');
  const targetTokens = cleanTarget.split(' ');

  // Quy tắc: TẤT CẢ các từ trong query phải tìm thấy từ "tương tự" trong target
  return queryTokens.every(qToken => {
    return targetTokens.some(tToken => {
      // a. Khớp chính xác từ
      if (tToken.includes(qToken)) return true;

      // b. Khớp mờ (Fuzzy) dùng Levenshtein
      // Chỉ áp dụng cho từ có độ dài > 3 để tránh khớp sai các từ ngắn (vd: xe, la, ma)
      if (qToken.length > 3 && tToken.length > 3) {
        const dist = levenshteinDistance(qToken, tToken);
        
        // Cho phép sai số tùy theo độ dài từ:
        // - Từ 4-5 ký tự: cho sai 1 ký tự (vd: "iphone" -> "ipone")
        // - Từ > 5 ký tự: cho sai 2 ký tự (vd: "everest" -> "evrest")
        const allowedErrors = qToken.length > 5 ? 2 : 1;
        
        // Điều kiện: Khoảng cách edit nhỏ hơn cho phép VÀ độ dài 2 từ không chênh lệch quá nhiều
        return dist <= allowedErrors && Math.abs(qToken.length - tToken.length) <= allowedErrors;
      }
      
      return false;
    });
  });
};

/**
 * Tính điểm độ phù hợp (Relevance Score)
 * Dùng để sắp xếp: Tin khớp chính xác lên đầu, tin khớp mờ xuống dưới.
 */
export const calculateRelevanceScore = (targetText: string, searchQuery: string): number => {
  const cleanTarget = removeVietnameseTones(targetText);
  const cleanQuery = removeVietnameseTones(searchQuery);
  let score = 0;

  // 1. Khớp chính xác hoàn toàn (+100 điểm)
  if (cleanTarget === cleanQuery) return 100;

  // 2. Bắt đầu bằng từ khóa (+80 điểm) - VD tìm "iPhone" ra "iPhone 15" đầu tiên
  if (cleanTarget.startsWith(cleanQuery)) score += 80;

  // 3. Chứa cụm từ liên tục (+60 điểm)
  else if (cleanTarget.includes(cleanQuery)) score += 60;

  // 4. Tính điểm dựa trên số lượng từ khớp fuzzy
  const targetTokens = cleanTarget.split(' ');
  const queryTokens = cleanQuery.split(' ');
  
  let matchedWords = 0;
  queryTokens.forEach(qToken => {
    if (targetTokens.some(tToken => {
      if (tToken === qToken) return true; // Khớp chuẩn
      // Khớp mờ cho từ dài > 3 ký tự
      if (qToken.length > 3 && levenshteinDistance(qToken, tToken) <= 1) return true; 
      return false;
    })) {
      matchedWords++;
    }
  });

  // Cộng điểm dựa trên tỷ lệ số từ khớp (Max 40 điểm)
  score += (matchedWords / queryTokens.length) * 40;

  return score;
};
