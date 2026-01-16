import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

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
    fastSell: number;    // Giá bán nhanh (Rẻ)
    suggested: number;   // Giá hợp lý
    highProfit: number;  // Giá được giá
    marketAnalysis: string;
  };

  qualityCheck: {
    score: number;
    tips: string;        // Lời khuyên cụ thể (ngắn gọn)
    issues: string[];    // Các vấn đề tìm thấy
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
// 2. CÁC HÀM GỌI API
// ==========================================================================

export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  const apiKey = getApiKey();
  // Data mặc định phòng khi lỗi
  const defaultData: any = { 
    title: '', description: '', category: 'khac', suggestedPrice: 0, 
    condition: 'good', isProhibited: false, attributes: {}, seoTags: [],
    pricingStrategy: { min: 0, max: 0, fastSell: 0, suggested: 0, highProfit: 0, marketAnalysis: 'Chưa xác định được giá' },
    qualityCheck: { score: 50, tips: 'Cần thêm thông tin', issues: [] }, keySellingPoints: []
  };

  if (!apiKey) return defaultData;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // Bản Flash nhanh và ổn định nhất hiện tại
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            isProhibited: { type: SchemaType.BOOLEAN },
            prohibitedReason: { type: SchemaType.STRING },
            category: { type: SchemaType.STRING },
            title: { type: SchemaType.STRING },
            description: { type: SchemaType.STRING },
            suggestedPrice: { type: SchemaType.NUMBER },
            
            pricingStrategy: {
              type: SchemaType.OBJECT,
              properties: {
                min: { type: SchemaType.NUMBER },
                max: { type: SchemaType.NUMBER },
                fastSell: { type: SchemaType.NUMBER },
                suggested: { type: SchemaType.NUMBER },
                highProfit: { type: SchemaType.NUMBER },
                marketAnalysis: { type: SchemaType.STRING }
              }
            },
            
            condition: { type: SchemaType.STRING, enum: ['new', 'like_new', 'good', 'fair', 'poor'] },
            
            qualityCheck: {
              type: SchemaType.OBJECT,
              properties: {
                score: { type: SchemaType.NUMBER },
                tips: { type: SchemaType.STRING },
                issues: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
              }
            },
            
            keySellingPoints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            seoTags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            
            attributes: {
              type: SchemaType.OBJECT,
              properties: {
                brand: { type: SchemaType.STRING },
                model: { type: SchemaType.STRING },
                year: { type: SchemaType.STRING },
                origin: { type: SchemaType.STRING },
                color: { type: SchemaType.STRING },
                status_detail: { type: SchemaType.STRING },
                warranty: { type: SchemaType.STRING }
              }
            }
          },
          required: ["title", "category", "suggestedPrice", "description", "condition", "pricingStrategy", "qualityCheck"]
        }
      }
    });

    const imageParts = imagesBase64.map(base64 => ({
      inlineData: {
        data: base64.split(',')[1] || base64,
        mimeType: "image/jpeg",
      },
    }));

    // PROMPT CỰC MẠNH: ÉP AI PHẢI ĐOÁN GIÁ VÀ SOI LỖI ẢNH
    const prompt = `
    Vai trò: Bạn là một chuyên gia buôn bán đồ cũ lão làng ("Thợ") tại Việt Nam.
    Nhiệm vụ: Nhìn ảnh, thẩm định giá và viết bài đăng bán giúp người dùng.

    YÊU CẦU ĐẶC BIỆT:
    1. ĐỊNH GIÁ (BẮT BUỘC):
       - Phải ước lượng ra con số VNĐ cụ thể. Nếu không biết chính xác model, hãy đoán dựa trên ngoại hình.
       - TUYỆT ĐỐI KHÔNG TRẢ VỀ GIÁ = 0. Nếu khó quá, hãy lấy giá sàn của loại sản phẩm đó (Ví dụ: Xe máy cũ nát bèo nhất cũng 3 triệu).
       - fastSell: Giá rẻ để bay nhanh trong 24h.
       - highProfit: Giá thách cưới (cao hơn 15-20%).

    2. SOI ẢNH (Image Audit):
       - Soi kỹ ánh sáng, phông nền, độ nét.
       - Đưa ra lời khuyên "đanh thép" để người dùng chụp lại đẹp hơn. Ví dụ: "Ảnh tối om thế này khách chạy hết, mang ra nắng chụp lại đi".

    3. VIẾT CONTENT:
       - Tiêu đề: Giật tít, có icon (🔥, ⚡), viết hoa tên sản phẩm.
       - Mô tả: Văn phong tự nhiên, chân thực, nhấn mạnh vào lợi ích (Tiết kiệm xăng, máy êm, chưa sửa chữa...).

    DANH MỤC HỆ THỐNG:
    ${CATEGORY_MAP_PROMPT}
    `;

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    return JSON.parse(response.text()) as ListingAnalysis;

  } catch (error) {
    console.error("Lỗi AI Service:", error);
    return defaultData;
  }
};
