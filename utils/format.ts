import { Listing, Category } from '../types';

// ========================================================================
// 1. FORMATTING UTILS
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

/**
 * [QUAN TRỌNG] Hàm tạo từ khóa tìm kiếm (Full-Text Search Support)
 * Dùng để tạo mảng 'keywords' lưu vào Firestore.
 * Hỗ trợ tìm kiếm theo tiền tố (Prefix Search).
 * VD: "Xe Vios" -> ["xe", "vi", "vio", "vios"] => Gõ "vio" cũng tìm ra.
 */
export const generateKeywords = (title: string): string[] => {
  if (!title) return [];
  
  const cleanTitle = removeVietnameseTones(title);
  const words = cleanTitle.split(" ").filter(w => w.length > 0);
  
  let keywords: string[] = [];

  words.forEach(word => {
    // 1. Lưu từ gốc
    keywords.push(word);

    // 2. Lưu các tiền tố (Prefix) cho các từ quan trọng (dài hơn 2 ký tự)
    // Giúp tìm "iph" -> ra "iphone", "maz" -> ra "mazda"
    if (word.length > 2) {
       let currentPrefix = "";
       for (let i = 0; i < word.length; i++) {
          currentPrefix += word[i];
          // Chỉ lưu từ có độ dài >= 2 ký tự để tiết kiệm dung lượng
          if (currentPrefix.length >= 2) { 
             keywords.push(currentPrefix);
          }
       }
    }
  });

  // Loại bỏ từ trùng lặp
  return Array.from(new Set(keywords));
};

// Sử dụng slug từ DB nếu có (chuẩn SEO), nếu tin cũ chưa có slug thì tự tạo
export const getListingUrl = (listing: Listing): string => {
  const slug = listing.slug || slugify(listing.title);
  return `/san-pham/${slug}-${listing.id}`;
};

export const getCategoryUrl = (category: Category): string => {
  const slug = category.slug || slugify(category.name);
  return `/danh-muc/${slug}`;
};

// ========================================================================
// 3. SMART SEARCH ENGINE (CLIENT SIDE REFINEMENT)
// ========================================================================

/**
 * Thuật toán Levenshtein Distance
 * Tính số bước ít nhất để biến chuỗi a thành chuỗi b
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
 * Hỗ trợ: Khớp chính xác, đảo từ, và khớp mờ (Fuzzy).
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
      if (qToken.length > 3 && tToken.length > 3) {
        const dist = levenshteinDistance(qToken, tToken);
        const allowedErrors = qToken.length > 5 ? 2 : 1;
        return dist <= allowedErrors && Math.abs(qToken.length - tToken.length) <= allowedErrors;
      }
      
      return false;
    });
  });
};

/**
 * Tính điểm độ phù hợp (Relevance Score)
 * Dùng để sắp xếp lại kết quả sau khi lọc.
 */
export const calculateRelevanceScore = (targetText: string, searchQuery: string): number => {
  const cleanTarget = removeVietnameseTones(targetText);
  const cleanQuery = removeVietnameseTones(searchQuery);
  let score = 0;

  // 1. Khớp chính xác hoàn toàn (+100 điểm)
  if (cleanTarget === cleanQuery) return 100;

  // 2. Bắt đầu bằng từ khóa (+80 điểm)
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
      if (qToken.length > 3 && levenshteinDistance(qToken, tToken) <= 1) return true; 
      return false;
    })) {
      matchedWords++;
    }
  });

  score += (matchedWords / queryTokens.length) * 40;

  return score;
};
