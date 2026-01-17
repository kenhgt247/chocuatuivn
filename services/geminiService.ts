import { GoogleGenAI } from "@google/genai";

// ==========================================================================
// 1. ĐỊNH NGHĨA DỮ LIỆU (INTERFACE)
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
    fastSell: number;    // Giá bán nhanh (Rẻ)
    suggested: number;   // Giá hợp lý
    highProfit: number;  // Giá lời cao
    marketAnalysis: string;
  };

  qualityCheck: {
    score: number;
    tips: string;
    issues: string[];
  };

  seoTags: string[];
  keySellingPoints: string[];
  attributes: Record<string, any>; // Lưu hãng, màu, thông số...
  
  isProhibited: boolean;
  prohibitedReason?: string;
}

// DANH SÁCH MÃ DANH MỤC (Cần khớp chính xác với Database của bạn)
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

const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || "";
};

// --- CÁC HÀM HỖ TRỢ AN TOÀN (Giúp app không bị crash) ---

const safeGetText = (response: any): string => {
  try {
    if (typeof response.text === 'function') return response.text();
    // Xử lý cấu trúc dữ liệu mới của Google
    if (response.candidates?.[0]?.content?.parts?.[0]?.text) 
        return response.candidates[0].content.parts[0].text;
    return ""; 
  } catch (e) {
    console.error("Lỗi đọc text từ AI:", e);
    return "";
  }
};

const cleanJson = (text: string): string => {
  if (!text) return "";
  // Xóa các ký tự thừa để tránh lỗi JSON
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// ==========================================================================
// 2. CÁC HÀM GỌI API (LOGIC PRO VIP - MODEL 2.0 FLASH EXP)
// ==========================================================================

// HÀM 1: TÌM KIẾM SẢN PHẨM
export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
    
    // Dùng model 2.0 Flash Exp (Ổn định nhất cho bạn)
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', 
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: "Trả về duy nhất 1 cụm từ khóa chính xác để tìm mua sản phẩm này. Ví dụ: 'iPhone 14 Pro Max', 'Honda Vision'. Không dấu câu." }
        ]
      }]
    });

    return safeGetText(response).trim().toLowerCase();
  } catch (error) {
    return "";
  }
};

// HÀM 2: PHÂN TÍCH ĐĂNG TIN (Thông minh như chuyên gia)
export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  const apiKey = getApiKey();
  
  // Dữ liệu mặc định (Phòng khi lỗi)
  const defaultData: ListingAnalysis = { 
    title: '', description: '', category: 'khac', suggestedPrice: 0, 
    condition: 'good', isProhibited: false, attributes: {}, seoTags: [],
    pricingStrategy: { min: 0, max: 0, fastSell: 0, suggested: 0, highProfit: 0, marketAnalysis: '' },
    qualityCheck: { score: 50, tips: 'Cần ảnh rõ hơn', issues: [] }, keySellingPoints: []
  };

  if (!apiKey) return defaultData;

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const imageParts = imagesBase64.map(base64 => ({
      inlineData: {
        data: base64.split(',')[1] || base64,
        mimeType: "image/jpeg",
      },
    }));

    // CÂU LỆNH PRO VIP (BÍ QUYẾT ĐỂ AI THÔNG MINH HƠN)
    const prompt = `
    Vai trò: Bạn là Chuyên gia Thẩm định giá đồ cũ số 1 Việt Nam.
    Nhiệm vụ: Phân tích ảnh và trả về dữ liệu JSON chuẩn xác để điền form đăng bán.

    QUY TRÌNH SUY LUẬN (BẮT BUỘC):
    1. Nhìn ảnh -> Xác định vật thể -> Đối chiếu với danh sách Category bên dưới.
       (Ví dụ: Thấy Tivi -> Bắt buộc chọn 'tivi-am-thanh').
    2. Đánh giá độ mới -> Ước lượng giá VNĐ thực tế.

    YÊU CẦU ĐẦU RA:
    1. CATEGORY: Chọn CHÍNH XÁC 1 mã (slug) từ danh sách dưới.
    2. PRICE: Bắt buộc trả về số VNĐ > 0.
       - fastSell: Giá rẻ (để bán nhanh).
       - suggested: Giá thị trường.
       - highProfit: Giá cao.
    3. CONTENT: 
       - Tiêu đề: Giật tít, viết hoa Tên Sản Phẩm + Tình trạng.
       - Mô tả: Văn phong tự nhiên, chân thực, chia dòng rõ ràng.

    DANH SÁCH DANH MỤC CHUẨN:
    ${CATEGORY_MAP_PROMPT}
    `;

    // Gọi Model
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', 
      contents: [
        { role: 'user', parts: [...imageParts, { text: prompt }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT", // Dùng chuỗi "OBJECT" (Chuẩn mới)
          properties: {
            isProhibited: { type: "BOOLEAN" },
            prohibitedReason: { type: "STRING" },
            category: { type: "STRING" },
            title: { type: "STRING" },
            description: { type: "STRING" },
            suggestedPrice: { type: "NUMBER" },
            
            pricingStrategy: {
              type: "OBJECT",
              properties: {
                min: { type: "NUMBER" },
                max: { type: "NUMBER" },
                fastSell: { type: "NUMBER" },
                suggested: { type: "NUMBER" },
                highProfit: { type: "NUMBER" },
                marketAnalysis: { type: "STRING" }
              }
            },
            
            condition: { type: "STRING", enum: ['new', 'like_new', 'good', 'fair', 'poor'] },
            
            qualityCheck: {
              type: "OBJECT",
              properties: {
                score: { type: "NUMBER" },
                tips: { type: "STRING" },
                issues: { type: "ARRAY", items: { type: "STRING" } }
              }
            },
            
            keySellingPoints: { type: "ARRAY", items: { type: "STRING" } },
            seoTags: { type: "ARRAY", items: { type: "STRING" } },
            
            attributes: {
              type: "OBJECT",
              properties: {
                brand: { type: "STRING" },
                model: { type: "STRING" },
                year: { type: "STRING" },
                origin: { type: "STRING" },
                color: { type: "STRING" },
                capacity: { type: "STRING" },
                status_detail: { type: "STRING" },
                warranty: { type: "STRING" }
              }
            }
          },
          required: ["title", "category", "suggestedPrice", "description", "condition", "pricingStrategy"]
        }
      }
    });

    const rawText = safeGetText(response);
    const jsonText = cleanJson(rawText);

    if (!jsonText) return defaultData;
    
    // Parse dữ liệu
    const result = JSON.parse(jsonText) as ListingAnalysis;
    
    // Logic dự phòng: Nếu AI lười tính chiến lược giá, ta tự tính
    if (!result.pricingStrategy) {
        result.pricingStrategy = {
            min: result.suggestedPrice * 0.8,
            max: result.suggestedPrice * 1.2,
            fastSell: result.suggestedPrice * 0.9,
            suggested: result.suggestedPrice,
            highProfit: result.suggestedPrice * 1.1,
            marketAnalysis: "Dựa trên giá trung bình"
        };
    }

    // Đảm bảo không bị giá = 0
    if (result.pricingStrategy.fastSell === 0 && result.suggestedPrice > 0) {
       result.pricingStrategy.fastSell = result.suggestedPrice * 0.9;
       result.pricingStrategy.highProfit = result.suggestedPrice * 1.1;
    }

    return result;

  } catch (error) {
    console.error("Lỗi AI Service:", error);
    return defaultData;
  }
};
