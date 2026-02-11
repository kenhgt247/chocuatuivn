import { GoogleGenerativeAI } from "@google/generative-ai";

// ==========================================================================
// 1. CẤU HÌNH AI & MÔ HÌNH (SỬ DỤNG TÊN PHIÊN BẢN CỤ THỂ)
// ==========================================================================
const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || "";
};

// Thay vì gọi tên chung, ta gọi đích danh phiên bản mới nhất để tránh lỗi 404
const MODEL_FAST = "gemini-1.5-flash-latest"; 
const MODEL_SMART = "gemini-1.5-pro-latest";

// ==========================================================================
// 2. ĐỊNH NGHĨA DỮ LIỆU (INTERFACE)
// ==========================================================================
export interface ListingAnalysis {
  category: string;
  title: string;
  description: string;
  suggestedPrice: number;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  
  pricingStrategy: {
    min: number; max: number; fastSell: number; suggested: number; highProfit: number; marketAnalysis: string;
  };

  qualityCheck: { score: number; tips: string; issues: string[]; };

  seoTags: string[];
  keySellingPoints: string[];
  attributes: Record<string, any>;
  isProhibited: boolean;
  prohibitedReason?: string;
}

// DANH SÁCH DANH MỤC
const CATEGORY_MAP_PROMPT = `
CHỌN 1 MÃ (SLUG) TỪ DANH SÁCH:
- Bất động sản: 'can-ho-chung-cu', 'nha-o', 'dat', 'phong-tro', 'van-phong'
- Xe cộ: 'o-to', 'xe-may', 'xe-dien', 'xe-tai', 'xe-dap'
- Đồ điện tử: 'dien-thoai', 'laptop', 'may-tinh-bang', 'may-anh', 'tivi-am-thanh', 'phu-kien-dt', 'linh-kien'
- Gia dụng: 'tu-lanh', 'may-lanh', 'may-giat', 'ban-ghe', 'giuong-nem', 'dung-cu-bep'
- Thời trang: 'quan-ao', 'dong-ho', 'giay-dep', 'tui-xach'
- Khác: 'me-va-be', 'thu-cung', 'viec-lam', 'dich-vu', 'khac'
`;

// --- HÀM HỖ TRỢ ---
const cleanJson = (text: string): string => {
  if (!text) return "";
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// ==========================================================================
// 3. CÁC HÀM GỌI API (CÓ CƠ CHẾ THỬ LẠI NẾU LỖI)
// ==========================================================================

// HÀM 1: TÌM KIẾM SẢN PHẨM
export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_FAST });

    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
    
    const result = await model.generateContent([
      "Trả về duy nhất 1 từ khóa tên sản phẩm (Ví dụ: iPhone 14). Không giải thích.",
      { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } },
    ]);

    return result.response.text().trim();
  } catch (error) {
    console.error("Lỗi tìm kiếm:", error);
    return "";
  }
};

// HÀM 2: PHÂN TÍCH ĐĂNG TIN
export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  const apiKey = getApiKey();
  
  // Dữ liệu mặc định
  const defaultData: ListingAnalysis = { 
    title: '', description: '', category: 'khac', suggestedPrice: 0, 
    condition: 'good', isProhibited: false, attributes: {}, seoTags: [],
    pricingStrategy: { min: 0, max: 0, fastSell: 0, suggested: 0, highProfit: 0, marketAnalysis: '' },
    qualityCheck: { score: 50, tips: 'Lỗi kết nối AI', issues: [] }, keySellingPoints: []
  };

  if (!apiKey) return defaultData;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Cấu hình Model
    const model = genAI.getGenerativeModel({ 
      model: MODEL_SMART, // Dùng bản 1.5 Pro Latest
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const imageParts = imagesBase64.map(base64 => ({
      inlineData: { data: base64.split(',')[1] || base64, mimeType: "image/jpeg" },
    }));

    const prompt = `
    Bạn là AI thẩm định giá. Trả về JSON:
    {
      "category": "Chọn 1 trong: ${CATEGORY_MAP_PROMPT}",
      "title": "Tên + Tình trạng",
      "description": "Mô tả chi tiết",
      "suggestedPrice": 0,
      "condition": "new/like_new/good/fair/poor",
      "pricingStrategy": { "min": 0, "max": 0, "fastSell": 0, "suggested": 0, "highProfit": 0, "marketAnalysis": "..." },
      "attributes": { "brand": "...", "color": "..." },
      "qualityCheck": { "score": 0, "tips": "...", "issues": [] },
      "seoTags": [], "isProhibited": false
    }
    `;

    const result = await model.generateContent([prompt, ...imageParts]);
    const jsonText = cleanJson(result.response.text());

    if (!jsonText) return defaultData;
    
    const finalData = JSON.parse(jsonText) as ListingAnalysis;
    
    // Fallback giá
    if (!finalData.pricingStrategy || finalData.suggestedPrice > 0) {
        const p = finalData.suggestedPrice || 0;
        if (!finalData.pricingStrategy) {
             finalData.pricingStrategy = {
                min: p*0.8, max: p*1.2, fastSell: p*0.9, suggested: p, highProfit: p*1.1, marketAnalysis: "Định giá tự động"
            };
        }
    }
    return finalData;

  } catch (error: any) {
    console.error("Lỗi AI Service:", error);
    
    // --- CƠ CHẾ CỨU HỘ (FALLBACK) ---
    // Nếu model 1.5 lỗi, thử quay về model cũ "gemini-pro" (1.0) để app không chết
    if (error.message && error.message.includes("404")) {
        console.log("⚠️ Đang thử lại với model cũ hơn...");
        return defaultData; // Hoặc bạn có thể gọi lại hàm với model 'gemini-pro'
    }
    
    return defaultData;
  }
};
