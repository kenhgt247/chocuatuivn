import { GoogleGenAI } from "@google/genai";

// 1. Interface (Giữ nguyên)
export interface ListingAnalysis {
  category: string;
  title: string;
  description: string;
  suggestedPrice: number;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  pricingStrategy: {
    min: number;
    max: number;
    fastSell: number;
    suggested: number;
    highProfit: number;
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

const getApiKey = () => import.meta.env.VITE_GEMINI_API_KEY || "";

// HÀM HỖ TRỢ: Lấy text an toàn từ mọi cấu trúc phản hồi
const safeGetText = (response: any): string => {
  try {
    // Trường hợp 1: Có hàm text()
    if (typeof response.text === 'function') return response.text();
    // Trường hợp 2: Cấu trúc data.candidates
    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) 
        return response.data.candidates[0].content.parts[0].text;
    // Trường hợp 3: Cấu trúc candidates trực tiếp
    if (response.candidates?.[0]?.content?.parts?.[0]?.text) 
        return response.candidates[0].content.parts[0].text;
    
    return JSON.stringify(response); // Fallback
  } catch (e) {
    console.error("Lỗi đọc response:", e);
    return "";
  }
};

// HÀM HỖ TRỢ: Làm sạch JSON (Xóa dấu ```json ... ```)
const cleanJson = (text: string): string => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// 2. Main Functions
export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "";
  try {
    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } }, { text: "1 từ khóa tìm kiếm sản phẩm này. Vd: 'iPhone 13'. Không dấu câu." }] }]
    });
    return safeGetText(response).trim().toLowerCase();
  } catch (error) { return ""; }
};

export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  const apiKey = getApiKey();
  const defaultData: any = { 
    title: '', description: '', category: 'khac', suggestedPrice: 0, 
    condition: 'good', isProhibited: false, attributes: {}, seoTags: [],
    pricingStrategy: { min: 0, max: 0, fastSell: 0, suggested: 0, highProfit: 0, marketAnalysis: 'Chưa xác định' },
    qualityCheck: { score: 50, tips: 'Cần thêm thông tin', issues: [] }, keySellingPoints: []
  };

  if (!apiKey) return defaultData;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const imageParts = imagesBase64.map(base64 => ({
      inlineData: { data: base64.split(',')[1] || base64, mimeType: "image/jpeg" },
    }));

   const prompt = `
    Vai trò: Bạn là một "Chiến thần Sales" trên chợ đồ cũ Việt Nam.
    Nhiệm vụ: Nhìn ảnh sản phẩm và TỰ ĐỘNG ĐIỀN thông tin để bán được hàng ngay lập tức.

    1. TƯ DUY VỀ GIÁ (Cực kỳ quan trọng):
       - Nhìn kỹ thương hiệu, độ mới, trầy xước.
       - BẮT BUỘC trả về con số VNĐ (Ví dụ: 12500000). Không được trả về 0.
       - fastSell: Giá "xả lỗ" để bay trong ngày.
       - suggested: Giá "thuận mua vừa bán".
       - highProfit: Giá "thách cưới" cho khách sộp.

    2. VIẾT NỘI DUNG (Phải hay, không được như robot):
       - Tiêu đề: Giật tít, kèm icon, viết hoa tên Model. (Vd: "🔥 PASS NHANH Honda Vision 2021 Chính Chủ - Còn Mới Keng")
       - Mô tả:
         + Mở đầu: Lý do bán (lên đời, không dùng...) nghe cho tự nhiên.
         + Thân bài: Gạch đầu dòng các ưu điểm (Mới 99%, Máy êm, Fullbox...).
         + Kết bài: Kêu gọi hành động (Fix nhẹ xăng xe cho anh em nhiệt tình).

    DANH MỤC: ${CATEGORY_MAP_PROMPT}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ role: 'user', parts: [...imageParts, { text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
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
    const jsonText = cleanJson(rawText); // Làm sạch trước khi parse
    
    if (!jsonText) return defaultData;
    return JSON.parse(jsonText) as ListingAnalysis;

  } catch (error) {
    console.error("Lỗi AI Service:", error);
    return defaultData;
  }
};
