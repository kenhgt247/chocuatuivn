import { GoogleGenerativeAI } from "@google/generative-ai";

// ==========================================================================
// 1. CẤU HÌNH AI - GEMINI 2.0 FLASH (SIÊU TỐC ĐỘ)
// ==========================================================================
const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || "";
};

// Sử dụng model 2.0 cho cả 2 tác vụ vì nó vừa nhanh vừa thông minh
const MODEL_NAME = "gemini-2.0-flash";

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

// Prompt danh mục (Giữ nguyên để AI chọn đúng database của bạn)
const CATEGORY_MAP_PROMPT = `
HÃY CHỌN CHÍNH XÁC 1 MÃ (SLUG) TỪ DANH SÁCH SAU:
- Bất động sản: 'can-ho-chung-cu', 'nha-o', 'dat', 'phong-tro', 'van-phong'
- Xe cộ: 'o-to', 'xe-may', 'xe-dien', 'xe-tai', 'xe-dap'
- Đồ điện tử: 'dien-thoai', 'laptop', 'may-tinh-bang', 'may-anh', 'tivi-am-thanh', 'phu-kien-dt', 'linh-kien'
- Gia dụng & Nội thất: 'tu-lanh', 'may-lanh', 'may-giat', 'ban-ghe', 'giuong-nem', 'dung-cu-bep', 'cay-canh'
- Thời trang: 'quan-ao', 'dong-ho', 'giay-dep', 'tui-xach', 'nuoc-hoa'
- Mẹ và Bé: 'me-va-be', 'do-choi'
- Thú cưng: 'thu-cung', 'phu-kien-thu-cung', 'ga', 'cho', 'meo'
- Việc làm & Dịch vụ: 'viec-lam', 'dich-vu'
- Khác: 'khac'
`;

// --- HÀM HỖ TRỢ XỬ LÝ JSON ---
const cleanJson = (text: string): string => {
  if (!text) return "";
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// ==========================================================================
// 3. CÁC HÀM GỌI API (GEMINI 2.0)
// ==========================================================================

// HÀM 1: TÌM KIẾM SẢN PHẨM
export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
    
    // Gemini 2.0 rất giỏi hiểu ngữ cảnh ngắn gọn
    const result = await model.generateContent([
      "Trả về duy nhất 1 cụm từ khóa chính xác tên sản phẩm để tìm mua. Ví dụ: 'iPhone 14 Pro Max'. Không giải thích.",
      { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } },
    ]);

    return result.response.text().trim();
  } catch (error) {
    console.error(`Lỗi model ${MODEL_NAME}:`, error);
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
    
    // Cấu hình JSON Mode cho Gemini 2.0
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const imageParts = imagesBase64.map(base64 => ({
      inlineData: { data: base64.split(',')[1] || base64, mimeType: "image/jpeg" },
    }));

    const prompt = `
    Bạn là Chuyên gia Thẩm định giá (Sử dụng engine Gemini 2.0).
    Hãy phân tích ảnh và trả về JSON chuẩn xác:

    1. CATEGORY: Chọn đúng mã (slug) từ: ${CATEGORY_MAP_PROMPT}
    2. PRICE: Định giá VNĐ thực tế theo thị trường đồ cũ Việt Nam.
    3. CONTENT: Tiêu đề thu hút, mô tả chi tiết tình trạng.

    Output JSON Format:
    {
      "category": "...",
      "title": "...",
      "description": "...",
      "suggestedPrice": 0,
      "condition": "new/like_new/good/fair/poor",
      "pricingStrategy": {
         "min": 0, "max": 0, "fastSell": 0, "suggested": 0, "highProfit": 0,
         "marketAnalysis": "..."
      },
      "attributes": { "brand": "...", "color": "..." },
      "qualityCheck": { "score": 0, "tips": "...", "issues": [] },
      "seoTags": [],
      "isProhibited": false
    }
    `;

    const result = await model.generateContent([prompt, ...imageParts]);
    const jsonText = cleanJson(result.response.text());

    if (!jsonText) return defaultData;
    
    const finalData = JSON.parse(jsonText) as ListingAnalysis;
    
    // Logic tính giá dự phòng (Fallback Pricing)
    if (!finalData.pricingStrategy || finalData.suggestedPrice > 0) {
        const p = finalData.suggestedPrice || 0;
        if (!finalData.pricingStrategy) {
             finalData.pricingStrategy = {
                min: p * 0.8, max: p * 1.2, fastSell: p * 0.9, suggested: p, highProfit: p * 1.1, marketAnalysis: "Định giá tự động"
            };
        }
        // Đảm bảo không bị giá = 0
        if (p > 0) {
            if(!finalData.pricingStrategy.fastSell) finalData.pricingStrategy.fastSell = p * 0.9;
            if(!finalData.pricingStrategy.highProfit) finalData.pricingStrategy.highProfit = p * 1.1;
        }
    }

    return finalData;

  } catch (error) {
    console.error(`Lỗi AI Service (${MODEL_NAME}):`, error);
    return defaultData;
  }
};
