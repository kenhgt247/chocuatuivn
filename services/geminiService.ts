import { GoogleGenAI, SchemaType } from "@google/genai";

// ==========================================================================
// 1. ĐỊNH NGHĨA INTERFACE NÂNG CAO
// ==========================================================================
export interface ListingAnalysis {
  category: string;
  suggestedPrice: number;
  minPrice: number; // [MỚI] Giá thấp nhất thị trường
  maxPrice: number; // [MỚI] Giá cao nhất thị trường
  title: string;
  description: string; // [NÂNG CẤP] Viết chuẩn SEO, chia đoạn
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor'; // [CHI TIẾT HƠN]
  isProhibited: boolean;
  prohibitedReason?: string;
  attributes: Record<string, any>;
  seoTags: string[]; // [MỚI] Hashtag để dễ tìm kiếm
  sellingTips: string; // [MỚI] AI tư vấn người dùng cần bổ sung gì
  confidenceScore: number; // [MỚI] Độ tự tin của AI (0-100%)
}

// Giữ nguyên Map danh mục của bạn (Rất tốt)
const CATEGORY_MAP_PROMPT = `
HÃY PHÂN TÍCH ẢNH VÀ CHỌN CHÍNH XÁC MỘT TRONG CÁC ID (SLUG) DƯỚI ĐÂY:
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
// 2. CÁC HÀM GỌI API (ĐÃ TỐI ƯU)
// ==========================================================================

// [NÂNG CẤP] Tìm kiếm thông minh hơn: Nhận diện cả Thương hiệu + Model
export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', // Model này nhanh và rẻ
      contents: {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: "Xác định vật thể chính trong ảnh để tìm kiếm mua sắm. Trả về dạng: 'Tên vật thể + Thương hiệu (nếu rõ) + Màu sắc'. Ví dụ: 'iPhone 13 Pro Max xanh', 'Giày Nike Air Jordan đỏ'. Ngắn gọn dưới 6 từ." }
        ]
      }
    });
    
    return safeGetText(response).trim().toLowerCase();
  } catch (error) {
    console.error("Lỗi AI Search:", error);
    return "";
  }
};

// [NÂNG CẤP] Hàm phân tích chính
export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  const apiKey = getApiKey();
  // Return default data nếu không có API Key
  const defaultData: ListingAnalysis = { 
    title: '', description: '', category: 'khac', suggestedPrice: 0, minPrice: 0, maxPrice: 0,
    condition: 'good', isProhibited: false, attributes: {}, seoTags: [], sellingTips: '', confidenceScore: 0
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
      model: 'gemini-2.0-flash-exp', // Dùng flash cho nhanh, nếu muốn cực thông minh hãy đổi sang 'gemini-1.5-pro'
      
      contents: {
        role: 'user',
        parts: [
          ...imageParts,
          { text: `Bạn là một chuyên gia thẩm định giá và Copywriter bán hàng đỉnh cao tại Việt Nam. 
          Nhiệm vụ: Phân tích ảnh sản phẩm để tạo tin đăng bán hàng hấp dẫn nhất.

          ${CATEGORY_MAP_PROMPT}
          
          YÊU CẦU ĐẶC BIỆT:
          1. Title: Phải Giật tít, bao gồm Tên + Hãng + Tình trạng + Đặc điểm nổi bật. (Vd: "Macbook Pro M1 2020 16GB - Máy đẹp keng, Pin trâu")
          2. Description: Viết theo cấu trúc bán hàng chuyên nghiệp:
             - Mở đầu: Cảm xúc, lý do bán (ngắn gọn).
             - Thân bài: Liệt kê chi tiết thông số kỹ thuật, tình trạng trầy xước (nếu có).
             - Kết bài: Cam kết, kêu gọi hành động.
          3. Price: Đưa ra mức giá trung bình thị trường đồ cũ tại Việt Nam (VNĐ).
          4. SellingTips: Nhìn vào ảnh và khuyên người dùng nên làm gì để bán nhanh hơn (Vd: "Ảnh hơi tối, nên chụp thêm tem mác...").
          5. Attributes: Chỉ trích xuất các thông số thực sự quan trọng với loại sản phẩm đó.
          ` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            isProhibited: { type: SchemaType.BOOLEAN },
            prohibitedReason: { type: SchemaType.STRING },
            title: { type: SchemaType.STRING },
            category: { type: SchemaType.STRING },
            suggestedPrice: { type: SchemaType.NUMBER },
            minPrice: { type: SchemaType.NUMBER },
            maxPrice: { type: SchemaType.NUMBER },
            condition: { type: SchemaType.STRING, enum: ['new', 'like_new', 'good', 'fair', 'poor'] },
            description: { type: SchemaType.STRING },
            seoTags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            sellingTips: { type: SchemaType.STRING },
            confidenceScore: { type: SchemaType.NUMBER },
            attributes: {
              type: SchemaType.OBJECT,
              properties: {
                brand: { type: SchemaType.STRING },
                model: { type: SchemaType.STRING },
                origin: { type: SchemaType.STRING }, // Xuất xứ
                year: { type: SchemaType.STRING },
                color: { type: SchemaType.STRING },
                material: { type: SchemaType.STRING }, // Chất liệu (quan trọng cho thời trang/nội thất)
                size: { type: SchemaType.STRING }, // Kích thước/Size quần áo
                capacity: { type: SchemaType.STRING }, // Dung lượng (GB, Lít, Kg)
                status_detail: { type: SchemaType.STRING }, // Mô tả chi tiết tình trạng (vd: xước dăm, fullbox)
                warranty: { type: SchemaType.STRING } // Còn bảo hành không
              }
            }
          },
          required: ["title", "category", "suggestedPrice", "description", "condition", "seoTags"]
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
