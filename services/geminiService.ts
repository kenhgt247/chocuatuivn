import { GoogleGenAI } from "@google/genai";

// ==========================================================================
// 1. ĐỊNH NGHĨA INTERFACE
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

const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || "";
};

// ==========================================================================
// 2. CÁC HÀM GỌI API (SỬ DỤNG @google/genai)
// ==========================================================================

// --- HÀM 1: TÌM KIẾM BẰNG HÌNH ẢNH (Khôi phục hàm này để sửa lỗi Build) ---
export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "";

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Convert ảnh
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
    
    // Gọi model
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
            { text: "Nhìn vào ảnh và trả về đúng 1 từ khóa ngắn gọn nhất để tìm kiếm sản phẩm này trên chợ đồ cũ. Ví dụ: 'iPhone 13', 'Xe Vision', 'Tủ lạnh Toshiba'. Không thêm dấu câu." }
          ]
        }
      ]
    });

    const text = response.text();
    return text ? text.trim().toLowerCase() : "";
  } catch (error) {
    console.error("Lỗi AI Search:", error);
    return "";
  }
};

// --- HÀM 2: PHÂN TÍCH ĐĂNG TIN (LOGIC ĐẲNG CẤP) ---
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
    
    // Convert ảnh
    const imageParts = imagesBase64.map(base64 => ({
      inlineData: {
        data: base64.split(',')[1] || base64,
        mimeType: "image/jpeg",
      },
    }));

    const prompt = `
    Vai trò: Bạn là một chuyên gia buôn bán đồ cũ lão làng ("Thợ") tại Việt Nam.
    Nhiệm vụ: Nhìn ảnh, thẩm định giá và viết bài đăng bán giúp người dùng.

    YÊU CẦU ĐẶC BIỆT:
    1. ĐỊNH GIÁ (BẮT BUỘC):
       - Phải ước lượng ra con số VNĐ cụ thể. KHÔNG trả về 0.
       - fastSell: Giá rẻ để bay nhanh.
       - highProfit: Giá thách cưới (cao hơn 15-20%).

    2. SOI ẢNH:
       - Soi kỹ ánh sáng, phông nền. Đưa lời khuyên cụ thể để chụp đẹp hơn.

    3. CONTENT:
       - Tiêu đề: Giật tít, có icon (🔥, ⚡).
       - Mô tả: Văn phong tự nhiên, nhấn mạnh lợi ích.

    DANH MỤC:
    ${CATEGORY_MAP_PROMPT}
    `;

    // Gọi model với cấu hình JSON Schema chuẩn cho @google/genai
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        { role: 'user', parts: [...imageParts, { text: prompt }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT", // Dùng chuỗi "OBJECT", không dùng SchemaType
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

    const text = response.text();
    if (!text) return defaultData;
    return JSON.parse(text) as ListingAnalysis;

  } catch (error) {
    console.error("Lỗi AI Service:", error);
    return defaultData;
  }
};
