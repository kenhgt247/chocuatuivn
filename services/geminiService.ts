import { GoogleGenAI, Type } from "@google/genai";

// ==========================================================================
// 1. ĐỊNH NGHĨA INTERFACE "ĐẲNG CẤP"
// ==========================================================================
export interface ListingAnalysis {
  category: string;
  title: string;
  description: string; // Nội dung bán hàng chuẩn AIDA (Attention - Interest - Desire - Action)
  
  // [MỚI] Chiến lược giá thông minh
  pricing: {
    suggested: number;   // Giá đề xuất cân bằng
    fastSell: number;    // Giá "xả lỗ" để bay nhanh trong 24h
    highProfit: number;  // Giá "thách cưới" dành cho khách không vội
    marketRange: string; // Vd: "5.000.000 - 6.500.000 đ"
    currency: string;
  };

  // [MỚI] Thẩm định chất lượng tin đăng
  qualityCheck: {
    score: number;       // Chấm điểm ảnh trên thang 100
    issues: string[];    // Các vấn đề (Vd: Ảnh ngược sáng, Thiếu góc chụp đáy)
    tips: string;        // Lời khuyên cụ thể để cải thiện
  };

  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  isProhibited: boolean;
  prohibitedReason?: string;
  
  // [MỚI] SEO & Marketing
  seoTags: string[];     // Hashtag
  keySellingPoints: string[]; // 3 điểm "ăn tiền" nhất của sản phẩm này

  attributes: Record<string, any>;
}

// Map danh mục giữ nguyên
const CATEGORY_MAP_PROMPT = `
1. Bất động sản: 'can-ho-chung-cu', 'nha-o', 'dat', 'phong-tro', 'van-phong'
2. Xe cộ: 'o-to', 'xe-may', 'xe-dien', 'xe-tai', 'xe-dap', 'phu-tung-xe'
3. Đồ điện tử: 'dien-thoai', 'may-tinh-bang', 'laptop', 'may-tinh-de-ban', 'may-anh', 'tivi-am-thanh', 'thiet-bi-thong-minh', 'phu-kien-dt', 'linh-kien'
4. Việc làm: 'ban-hang', 'nhan-vien-phuc-vu', 'tai-xe-giao-hang', 'tap-vu', 'pha-che', 'phu-bep', 'nhan-vien-kinh-doanh', 'cong-nhan', 'bao-ve'
5. Thú cưng: 'ga', 'cho', 'chim', 'meo', 'thu-cung-khac', 'phu-kien-thu-cung'
6. Điện lạnh: 'tu-lanh', 'may-lanh', 'may-giat'
7. Nội thất & Gia dụng: 'ban-ghe', 'tu-ke', 'giuong-nem', 'bep-lo', 'dung-cu-bep', 'cay-canh'
8. Thời trang: 'quan-ao', 'dong-ho', 'giay-dep', 'tui-xach', 'nuoc-hoa'
9. Giải trí & Thể thao: 'nhac-cu', 'sach', 'do-the-thao', 'suu-tam'
10. Mẹ và Bé: 'me-va-be'
11. Dịch vụ: 'dich-vu-don-nha', 'dich-vu-chuyen-nha', 'dich-vu-sua-chua'
12. Khác: 'khac'
`;

const getApiKey = () => {
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || (process as any).env?.API_KEY || "";
};

const safeGetText = (response: any): string => {
  try {
    if (typeof response.text === 'function') return response.text();
    if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.candidates[0].content.parts[0].text;
    }
    return "";
  } catch (e) {
    console.error("Lỗi đọc text từ AI:", e);
    return "";
  }
};

// ==========================================================================
// 2. CÁC HÀM GỌI API (NÂNG CẤP PROMPT SIÊU CẤP)
// ==========================================================================

export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', 
      contents: {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: "Bạn là chuyên gia tìm kiếm. Hãy nhìn ảnh và đưa ra 1 từ khóa chính xác nhất để tìm mua món này trên chợ đồ cũ. Ví dụ: 'iphone 14 pro max', 'tủ lạnh toshiba 180l'. Không dài dòng." }
        ]
      }
    });
    
    return safeGetText(response).trim().toLowerCase();
  } catch (error) {
    return "";
  }
};

export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  const apiKey = getApiKey();
  // Default data phòng khi lỗi
  const defaultData: any = { 
    title: '', description: '', category: 'khac', 
    pricing: { suggested: 0, fastSell: 0, highProfit: 0, marketRange: '0 - 0', currency: 'VNĐ' },
    condition: 'good', isProhibited: false, attributes: {}, seoTags: [], 
    qualityCheck: { score: 50, issues: [], tips: '' }, keySellingPoints: []
  };

  if (!apiKey) return defaultData;

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const imageParts = imagesBase64.map(base64 => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64.split(',')[1] || base64,
      }
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', // Model này cực nhanh và thông minh
      
      contents: {
        role: 'user',
        parts: [
          ...imageParts,
          { text: `
          Vai trò: Bạn là "Vua Bán Hàng" trên sàn thương mại điện tử C2C tại Việt Nam.
          Nhiệm vụ: Phân tích ảnh sản phẩm và tạo ra bộ thông tin đăng bán tối ưu nhất để "chốt đơn" ngay lập tức.

          1. PHÂN TÍCH HÌNH ẢNH (Image Audit):
             - Đánh giá chất lượng ảnh (ánh sáng, góc chụp, độ nét).
             - Chỉ ra lỗi khiến khách hàng không dám mua (nếu có).

          2. ĐỊNH GIÁ CHIẾN LƯỢC (Strategic Pricing):
             - Xác định model, thương hiệu, độ mới.
             - Đưa ra 3 mức giá: Giá bán nhanh (Rẻ), Giá đề xuất (Vừa), Giá cao (Lời nhiều).

          3. VIẾT CONTENT "THÔI MIÊN" (Copywriting):
             - Title: Phải có icon, giật tít, chứa từ khóa đắt giá (Vd: "🔥 Pas nhanh...").
             - Description: Viết có cảm xúc, chia đoạn, dùng emoji, tập trung vào lợi ích (Vd: "Máy chạy êm ru", "Tiết kiệm điện").

          DANH MỤC HỆ THỐNG:
          ${CATEGORY_MAP_PROMPT}
          
          OUTPUT JSON FORMAT (Bắt buộc đúng Schema):
          ` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isProhibited: { type: Type.BOOLEAN },
            prohibitedReason: { type: Type.STRING },
            category: { type: Type.STRING },
            
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            
            condition: { type: Type.STRING, enum: ['new', 'like_new', 'good', 'fair', 'poor'] },
            
            // [MỚI] Cấu trúc giá thông minh
            pricing: {
              type: Type.OBJECT,
              properties: {
                suggested: { type: Type.NUMBER }, // Giá chuẩn
                fastSell: { type: Type.NUMBER },  // Giá bán gấp (rẻ hơn 10-15%)
                highProfit: { type: Type.NUMBER }, // Giá bán thong thả (cao hơn 10%)
                marketRange: { type: Type.STRING }, // Khoảng giá thị trường
                currency: { type: Type.STRING }
              }
            },

            // [MỚI] Thẩm định chất lượng tin đăng
            qualityCheck: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER }, // Điểm số ảnh (0-100)
                issues: { type: Type.ARRAY, items: { type: Type.STRING } }, // Lỗi của ảnh
                tips: { type: Type.STRING } // Lời khuyên cụ thể
              }
            },

            // Marketing
            keySellingPoints: { type: Type.ARRAY, items: { type: Type.STRING } }, // 3 điểm mạnh nhất
            seoTags: { type: Type.ARRAY, items: { type: Type.STRING } },

            attributes: {
              type: Type.OBJECT,
              properties: {
                brand: { type: Type.STRING },
                model: { type: Type.STRING },
                origin: { type: Type.STRING },
                year: { type: Type.STRING },
                color: { type: Type.STRING },
                usage: { type: Type.STRING }, // Thời gian đã sử dụng
                battery: { type: Type.STRING }, // Pin (nếu có)
                status_detail: { type: Type.STRING }, // Mô tả kỹ vết xước
                warranty: { type: Type.STRING }
              }
            }
          },
          required: ["title", "category", "pricing", "description", "condition", "qualityCheck"]
        }
      }
    });

    const rawText = safeGetText(response);
    if (!rawText) throw new Error("AI trả về rỗng");

    return JSON.parse(rawText) as ListingAnalysis;
  } catch (error) {
    console.error("Lỗi AI:", error);
    return defaultData;
  }
};
