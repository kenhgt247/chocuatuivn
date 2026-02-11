import { GoogleGenerativeAI } from "@google/generative-ai";

// ==========================================================================
// 1. CẤU HÌNH AI & MÔ HÌNH
// ==========================================================================
const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || "";
};

// Dùng Flash cho tác vụ cần tốc độ nhanh (Search)
const MODEL_FAST = "gemini-1.5-flash";

// Dùng Pro cho tác vụ cần độ chính xác cao (Phân tích ảnh, định giá) - Tốt cho bản trả phí
const MODEL_SMART = "gemini-1.5-pro";

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
    min: number;
    max: number;
    fastSell: number;    // Giá bán nhanh
    suggested: number;   // Giá đề xuất
    highProfit: number;  // Giá mong muốn cao
    marketAnalysis: string;
  };

  qualityCheck: {
    score: number;
    tips: string;
    issues: string[];
  };

  seoTags: string[];
  keySellingPoints: string[];
  attributes: Record<string, any>;
  
  isProhibited: boolean;
  prohibitedReason?: string;
}

// DANH SÁCH DANH MỤC (Prompt Context)
const CATEGORY_MAP_PROMPT = `
HÃY CHỌN CHÍNH XÁC 1 MÃ (SLUG) TỪ DANH SÁCH SAU:
- Bất động sản: 'can-ho-chung-cu', 'nha-o', 'dat', 'phong-tro', 'van-phong'
- Xe cộ: 'o-to', 'xe-may', 'xe-dien', 'xe-tai', 'xe-dap', 'phu-tung-xe'
- Đồ điện tử: 'dien-thoai', 'may-tinh-bang', 'laptop', 'may-tinh-de-ban', 'may-anh', 'tivi-am-thanh', 'thiet-bi-thong-minh', 'phu-kien-dt', 'linh-kien'
- Việc làm: 'ban-hang', 'nhan-vien-phuc-vu', 'tai-xe-giao-hang', 'tap-vu', 'pha-che', 'phu-bep', 'nhan-vien-kinh-doanh', 'cong-nhan', 'bao-ve'
- Thú cưng: 'ga', 'cho', 'chim', 'meo', 'thu-cung-khac', 'phu-kien-thu-cung'
- Điện lạnh: 'tu-lanh', 'may-lanh', 'may-giat', 'dien-lanh-khac'
- Nội thất & Gia dụng: 'ban-ghe', 'tu-ke', 'giuong-nem', 'bep-lo', 'dung-cu-bep', 'cay-canh'
- Thời trang: 'quan-ao', 'dong-ho', 'giay-dep', 'tui-xach', 'nuoc-hoa', 'phu-kien-thoi-trang'
- Giải trí & Thể thao: 'nhac-cu', 'sach', 'do-the-thao', 'suu-tam', 'so-thich-khac'
- Mẹ và Bé: 'me-va-be', 'do-choi'
- Dịch vụ: 'dich-vu-don-nha', 'dich-vu-chuyen-nha', 'dich-vu-sua-chua'
- Khác: 'khac'
`;

// --- HÀM HỖ TRỢ ---
const cleanJson = (text: string): string => {
  if (!text) return "";
  // Xóa markdown code block để lấy JSON thuần
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// ==========================================================================
// 3. CÁC HÀM GỌI API (ĐÃ FIX LỖI & DÙNG THƯ VIỆN CHUẨN)
// ==========================================================================

// HÀM 1: TÌM KIẾM SẢN PHẨM
export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("Thiếu API Key Gemini");
    return "";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Sử dụng Flash cho nhanh
    const model = genAI.getGenerativeModel({ model: MODEL_FAST });

    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
    
    const result = await model.generateContent([
      "Trả về duy nhất 1 cụm từ khóa chính xác, ngắn gọn để tìm mua sản phẩm này trên sàn thương mại điện tử. Ví dụ: 'iPhone 14 Pro Max', 'Honda Vision'. Không giải thích gì thêm.",
      {
        inlineData: {
          data: cleanBase64,
          mimeType: "image/jpeg",
        },
      },
    ]);

    return result.response.text().trim();
  } catch (error) {
    console.error("Lỗi identifyProductForSearch:", error);
    return "";
  }
};

// HÀM 2: PHÂN TÍCH ĐĂNG TIN
export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  const apiKey = getApiKey();
  
  // Dữ liệu mặc định (Fallback)
  const defaultData: ListingAnalysis = { 
    title: '', description: '', category: 'khac', suggestedPrice: 0, 
    condition: 'good', isProhibited: false, attributes: {}, seoTags: [],
    pricingStrategy: { min: 0, max: 0, fastSell: 0, suggested: 0, highProfit: 0, marketAnalysis: '' },
    qualityCheck: { score: 50, tips: 'Cần ảnh rõ hơn', issues: [] }, keySellingPoints: []
  };

  if (!apiKey) return defaultData;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Sử dụng Pro cho thông minh (ưu đãi bản trả phí)
    // Cấu hình responseMimeType: "application/json" để AI trả về JSON chuẩn
    const model = genAI.getGenerativeModel({ 
      model: MODEL_SMART,
      generationConfig: {
        responseMimeType: "application/json", 
      }
    });
    
    const imageParts = imagesBase64.map(base64 => ({
      inlineData: {
        data: base64.split(',')[1] || base64,
        mimeType: "image/jpeg",
      },
    }));

    const prompt = `
    Vai trò: Bạn là Chuyên gia Thẩm định giá đồ cũ số 1 Việt Nam.
    Nhiệm vụ: Phân tích các hình ảnh sản phẩm và trả về dữ liệu JSON để điền form đăng bán tự động.

    YÊU CẦU QUAN TRỌNG:
    1. CATEGORY: Phải chọn CHÍNH XÁC 1 mã (slug) từ danh sách sau:
       ${CATEGORY_MAP_PROMPT}
       
    2. CONDITION & PRICE: Nhìn kỹ độ trầy xước, cũ mới để đánh giá 'condition' và đưa ra giá 'suggestedPrice' (VNĐ) sát thực tế thị trường đồ cũ Việt Nam.
    
    3. CONTENT:
       - title: Ngắn gọn, bao gồm Tên sản phẩm + Đặc điểm nổi bật/Tình trạng.
       - description: Viết hay, chia đoạn, mô tả kỹ tình trạng.

    CẤU TRÚC JSON TRẢ VỀ (Không được thừa thiếu trường nào):
    {
      "category": "...",
      "title": "...",
      "description": "...",
      "suggestedPrice": 0,
      "condition": "new/like_new/good/fair/poor",
      "pricingStrategy": {
         "min": 0,
         "max": 0,
         "fastSell": 0,
         "suggested": 0,
         "highProfit": 0,
         "marketAnalysis": "..."
      },
      "attributes": { "brand": "...", "color": "...", "origin": "..." },
      "qualityCheck": { 
         "score": 0, 
         "tips": "...", 
         "issues": ["..."] 
      },
      "keySellingPoints": ["..."],
      "seoTags": ["..."],
      "isProhibited": false
    }
    `;

    const result = await model.generateContent([prompt, ...imageParts]);
    const rawText = result.response.text();
    const jsonText = cleanJson(rawText);

    if (!jsonText) return defaultData;
    
    // Parse dữ liệu
    const finalData = JSON.parse(jsonText) as ListingAnalysis;
    
    // --- Logic Xử lý Hậu kỳ (Post-processing) ---
    // Đảm bảo pricingStrategy luôn có dữ liệu hợp lệ
    const basePrice = finalData.suggestedPrice || 0;

    if (!finalData.pricingStrategy || basePrice > 0) {
        // Nếu AI tính thiếu hoặc sai, ta tự tính toán lại dựa trên giá gợi ý
        if (!finalData.pricingStrategy) {
             finalData.pricingStrategy = {
                min: basePrice * 0.8,
                max: basePrice * 1.2,
                fastSell: basePrice * 0.9,
                suggested: basePrice,
                highProfit: basePrice * 1.1,
                marketAnalysis: "Định giá dựa trên dữ liệu thị trường"
            };
        }
        
        // Đảm bảo không có giá nào bằng 0 nếu giá gốc > 0
        if (basePrice > 0) {
            if (!finalData.pricingStrategy.fastSell) finalData.pricingStrategy.fastSell = basePrice * 0.9;
            if (!finalData.pricingStrategy.highProfit) finalData.pricingStrategy.highProfit = basePrice * 1.1;
            if (!finalData.pricingStrategy.min) finalData.pricingStrategy.min = basePrice * 0.8;
            if (!finalData.pricingStrategy.max) finalData.pricingStrategy.max = basePrice * 1.2;
        }
    }

    return finalData;

  } catch (error) {
    console.error("Lỗi AI Service:", error);
    // Trả về dữ liệu rỗng để app không bị crash
    return defaultData;
  }
};