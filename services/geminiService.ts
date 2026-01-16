import { GoogleGenAI } from "@google/genai";

// ==========================================================================
// 1. ĐỊNH NGHĨA INTERFACE CHUẨN
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
    fastSell: number;    // Giá bán nhanh (Rẻ hơn 10-15%)
    suggested: number;   // Giá thị trường
    highProfit: number;  // Giá kỳ vọng cao (Đắt hơn 10-15%)
    marketAnalysis: string;
  };

  qualityCheck: {
    score: number;
    tips: string;
    issues: string[];
  };

  seoTags: string[];
  keySellingPoints: string[];
  attributes: Record<string, any>; // Lưu hãng, màu sắc, xuất xứ...
  
  isProhibited: boolean;
  prohibitedReason?: string;
}

// DANH MỤC HỆ THỐNG (Cần mapping chính xác với Database của bạn)
const CATEGORY_MAP_PROMPT = `
HÃY CHỌN CHÍNH XÁC 1 MÃ (SLUG) TỪ DANH SÁCH SAU ĐÂY:
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

// HÀM HỖ TRỢ: Lấy text an toàn từ mọi cấu trúc phản hồi của Google
const safeGetText = (response: any): string => {
  try {
    if (typeof response.text === 'function') return response.text();
    if (response.candidates?.[0]?.content?.parts?.[0]?.text) 
        return response.candidates[0].content.parts[0].text;
    return JSON.stringify(response);
  } catch (e) {
    console.error("Lỗi đọc response AI:", e);
    return "";
  }
};

// HÀM HỖ TRỢ: Làm sạch JSON (Loại bỏ Markdown ```json ... ```)
const cleanJson = (text: string): string => {
  if (!text) return "";
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// ==========================================================================
// 2. CÁC HÀM GỌI API (SỬ DỤNG GEMINI 1.5 PRO - BẢN TRẢ PHÍ MẠNH NHẤT)
// ==========================================================================

// Hàm 1: Tìm kiếm bằng hình ảnh (Dùng cho thanh tìm kiếm)
export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
    
    // Tìm kiếm chỉ cần Flash cho nhanh
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash', 
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: "Trả về duy nhất 1 cụm từ khóa chính xác để tìm mua sản phẩm trong ảnh này tại Việt Nam. Ví dụ: 'iPhone 14 Pro Max', 'Tủ lạnh Toshiba'. Không thêm dấu câu." }
        ]
      }]
    });

    return safeGetText(response).trim().toLowerCase();
  } catch (error) {
    return "";
  }
};

// Hàm 2: Phân tích đăng tin (Dùng model PRO cho độ chính xác cao)
export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  const apiKey = getApiKey();
  
  // Dữ liệu mặc định nếu AI lỗi
  const defaultData: ListingAnalysis = { 
    title: '', description: '', category: 'khac', suggestedPrice: 0, 
    condition: 'good', isProhibited: false, attributes: {}, seoTags: [],
    pricingStrategy: { min: 0, max: 0, fastSell: 0, suggested: 0, highProfit: 0, marketAnalysis: '' },
    qualityCheck: { score: 50, tips: 'Hãy chụp rõ nét hơn', issues: [] }, keySellingPoints: []
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

    const prompt = `
    Vai trò: Bạn là Chuyên gia Thẩm định giá & Copywriter số 1 Việt Nam.
    Nhiệm vụ: Phân tích ảnh sản phẩm để tạo tin đăng bán hàng chuyên nghiệp.

    QUY TRÌNH SUY LUẬN (BẮT BUỘC):
    1. Nhận diện vật thể chính.
    2. Xác định Danh mục (Category) chính xác nhất từ danh sách cung cấp. (Ví dụ: Thấy Tivi -> Phải chọn 'tivi-am-thanh').
    3. Ước lượng giá trị thực tế tại thị trường đồ cũ Việt Nam (VNĐ).

    YÊU CẦU ĐẦU RA (JSON):
    - category: Chọn 1 slug từ danh sách bên dưới.
    - suggestedPrice: Giá trung bình (Số nguyên, > 0).
    - fastSell: Giá bán nhanh (Thấp hơn 15%).
    - highProfit: Giá bán lời (Cao hơn 15%).
    - title: Tiêu đề hấp dẫn, chứa Tên SP + Tình trạng.
    - description: Mô tả chi tiết, chia dòng, nêu bật ưu điểm.
    - attributes: Trích xuất thông số (Hãng, Màu, Dung lượng...).

    DANH SÁCH DANH MỤC CHUẨN:
    ${CATEGORY_MAP_PROMPT}
    `;

    // Sử dụng Model Pro 1.5 cho kết quả tốt nhất
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-pro', 
      contents: [
        { role: 'user', parts: [...imageParts, { text: prompt }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            isProhibited: { type: "BOOLEAN" },
            prohibitedReason: { type: "STRING" },
            category: { type: "STRING" }, // Quan trọng: AI phải trả về String khớp danh mục
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
          required: ["title", "category", "suggestedPrice", "description", "condition", "pricingStrategy", "qualityCheck"]
        }
      }
    });

    const rawText = safeGetText(response);
    const jsonText = cleanJson(rawText);

    if (!jsonText) return defaultData;
    
    const parsedData = JSON.parse(jsonText) as ListingAnalysis;
    
    // Validate dữ liệu quan trọng trước khi trả về
    if (!parsedData.pricingStrategy) {
        parsedData.pricingStrategy = { min: 0, max: 0, fastSell: 0, suggested: 0, highProfit: 0, marketAnalysis: '' };
    }
    // Nếu AI lười trả về 0, ta fallback sang giá gợi ý
    if (parsedData.pricingStrategy.fastSell === 0 && parsedData.suggestedPrice > 0) {
        parsedData.pricingStrategy.fastSell = parsedData.suggestedPrice * 0.85;
        parsedData.pricingStrategy.suggested = parsedData.suggestedPrice;
        parsedData.pricingStrategy.highProfit = parsedData.suggestedPrice * 1.15;
    }

    return parsedData;

  } catch (error) {
    console.error("Lỗi AI Analysis:", error);
    return defaultData;
  }
};
