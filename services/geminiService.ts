import { GoogleGenAI, Type } from "@google/genai";

// ==========================================================================
// 1. ĐỊNH NGHĨA INTERFACE (Vừa tương thích cũ, Vừa có tính năng mới)
// ==========================================================================
export interface ListingAnalysis {
  // --- CÁC TRƯỜNG CƠ BẢN (Để tương thích code cũ) ---
  category: string;
  title: string;
  description: string;
  suggestedPrice: number; // [QUAN TRỌNG] Giữ cái này ở ngoài để Form tự điền được ngay
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  
  // --- CÁC TRƯỜNG NÂNG CẤP ("Đẳng cấp") ---
  pricingStrategy: {
    min: number;         // Giá sàn (bán tháo)
    max: number;         // Giá trần (bán đắt)
    fastSell: number;    // Gợi ý giá để bán nhanh trong 24h
    marketAnalysis: string; // Nhận định ngắn gọn về giá (vd: "Model này đang giữ giá tốt")
  };

  qualityCheck: {
    score: number;       // Điểm chất lượng ảnh (0-100)
    tips: string;        // Lời khuyên cải thiện ảnh
  };

  seoTags: string[];
  keySellingPoints: string[];
  attributes: Record<string, any>;
  
  isProhibited: boolean;
  prohibitedReason?: string;
}

// Map danh mục (Giữ nguyên)
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
// 2. CÁC HÀM GỌI API
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
        parts: [{ inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } }, { text: "Trả về 1 từ khóa tìm kiếm chính xác nhất cho món đồ này (Tiếng Việt). Ví dụ: 'iPhone 14 Pro Max', 'Honda Vision 2021'." }]
      }
    });
    return safeGetText(response).trim().toLowerCase();
  } catch (error) { return ""; }
};

export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  const apiKey = getApiKey();
  // Dữ liệu mặc định an toàn
  const defaultData: any = { 
    title: '', description: '', category: 'khac', suggestedPrice: 0, 
    condition: 'good', isProhibited: false, attributes: {}, seoTags: [],
    pricingStrategy: { min: 0, max: 0, fastSell: 0, marketAnalysis: '' },
    qualityCheck: { score: 50, tips: '' }, keySellingPoints: []
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
      model: 'gemini-2.0-flash-exp',
      contents: {
        role: 'user',
        parts: [
          ...imageParts,
          { text: `
          Bạn là chuyên gia thẩm định giá đồ cũ tại Việt Nam.
          Nhiệm vụ: Phân tích ảnh và trả về dữ liệu JSON để tự động điền vào form đăng bán.

          YÊU CẦU QUAN TRỌNG VỀ GIÁ (PRICING):
          - BẮT BUỘC phải ước lượng ra con số VNĐ cụ thể cho trường 'suggestedPrice'.
          - Dựa vào thương hiệu, độ mới, và model nhận diện được. 
          - KHÔNG được để giá bằng 0. Nếu không chắc chắn, hãy đưa ra mức giá trung bình thấp nhất của loại sản phẩm đó.

          YÊU CẦU VỀ CONTENT:
          - Title: Giật tít, ngắn gọn, đầy đủ tên hãng + model.
          - Description: Viết hấp dẫn, chia dòng, có emoji.

          ${CATEGORY_MAP_PROMPT}
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
            
            // [QUAN TRỌNG] Trường này để form tự điền
            suggestedPrice: { type: Type.NUMBER }, 

            // Chiến lược giá nâng cao (để hiển thị gợi ý)
            pricingStrategy: {
              type: Type.OBJECT,
              properties: {
                min: { type: Type.NUMBER },
                max: { type: Type.NUMBER },
                fastSell: { type: Type.NUMBER },
                marketAnalysis: { type: Type.STRING }
              }
            },

            condition: { type: Type.STRING, enum: ['new', 'like_new', 'good', 'fair', 'poor'] },
            
            qualityCheck: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                tips: { type: Type.STRING }
              }
            },

            keySellingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            seoTags: { type: Type.ARRAY, items: { type: Type.STRING } },

            attributes: {
              type: Type.OBJECT,
              properties: {
                brand: { type: Type.STRING },
                model: { type: Type.STRING },
                year: { type: Type.STRING },
                origin: { type: Type.STRING },
                color: { type: Type.STRING },
                capacity: { type: Type.STRING },
                status_detail: { type: Type.STRING },
                warranty: { type: Type.STRING }
              }
            }
          },
          required: ["title", "category", "suggestedPrice", "description", "condition", "pricingStrategy"]
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
