import { GoogleGenAI, Type } from "@google/genai";

// ==========================================================================
// 1. ĐỊNH NGHĨA INTERFACE NÂNG CẤP (Thêm các trường thông minh)
// ==========================================================================
export interface ListingAnalysis {
  category: string;
  suggestedPrice: number;
  minPrice: number; // [MỚI] Giá thấp nhất thị trường
  maxPrice: number; // [MỚI] Giá cao nhất thị trường
  title: string;
  description: string; // Viết chuẩn SEO, hấp dẫn hơn
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  isProhibited: boolean;
  prohibitedReason?: string;
  attributes: Record<string, any>;
  seoTags: string[]; // [MỚI] Hashtag để tìm kiếm (vd: #iphone, #giare)
  sellingTips: string; // [MỚI] AI tư vấn cách chụp ảnh/bán nhanh hơn
}

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
// 2. CÁC HÀM GỌI API (Giữ nguyên thư viện, Nâng cấp Prompt)
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
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: "Xác định vật thể chính trong ảnh để tìm kiếm. Trả về: 'Tên vật thể + Thương hiệu + Màu sắc' (nếu rõ). Ví dụ: 'iPhone 13 xanh', 'Váy hoa nhí'. Ngắn gọn dưới 6 từ." }
        ]
      }
    });
    
    return safeGetText(response).trim().toLowerCase();
  } catch (error) {
    console.error("Lỗi AI Search:", error);
    return "";
  }
};

export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  const apiKey = getApiKey();
  // Return default data nếu lỗi
  const defaultData: ListingAnalysis = { 
    title: '', description: '', category: 'khac', suggestedPrice: 0, minPrice: 0, maxPrice: 0,
    condition: 'good', isProhibited: false, attributes: {}, seoTags: [], sellingTips: '' 
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
          { text: `Bạn là một chuyên gia thẩm định giá và Copywriter bán hàng số 1 tại Việt Nam.
          Nhiệm vụ: Phân tích ảnh để tạo tin đăng bán hàng hấp dẫn và chuyên nghiệp.

          ${CATEGORY_MAP_PROMPT}
          
          YÊU CẦU ĐẦU RA (OUTPUT):
          1. Title: Giật tít hấp dẫn, gồm: Tên SP + Hãng + Tình trạng nổi bật.
          2. Description: Viết mô tả bán hàng có cảm xúc, chia đoạn rõ ràng (Mở bài - Thân bài thông số - Kết bài cam kết).
          3. Price: 
             - suggestedPrice: Giá trung bình.
             - minPrice/maxPrice: Khoảng giá thấp nhất và cao nhất thị trường đồ cũ hiện nay.
          4. Condition: Đánh giá thật kỹ tình trạng qua ảnh ('new', 'like_new', 'good', 'fair', 'poor').
          5. SellingTips: Nhìn vào ảnh và đưa ra lời khuyên để người dùng chụp ảnh đẹp hơn hoặc bán nhanh hơn (Vd: "Nên chụp thêm ảnh tem mác", "Lau sạch bụi ở ống kính").
          6. SeoTags: 5-7 từ khóa hashtag liên quan để dễ tìm kiếm.
          7. Attributes: Trích xuất thông số kỹ thuật quan trọng nhất (Ram, Ổ cứng, ODO, Dung tích...).
          ` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT, // Giữ nguyên Type của @google/genai
          properties: {
            isProhibited: { type: Type.BOOLEAN },
            prohibitedReason: { type: Type.STRING },
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            suggestedPrice: { type: Type.NUMBER },
            minPrice: { type: Type.NUMBER }, // Mới
            maxPrice: { type: Type.NUMBER }, // Mới
            condition: { type: Type.STRING, enum: ['new', 'like_new', 'good', 'fair', 'poor'] },
            description: { type: Type.STRING },
            sellingTips: { type: Type.STRING }, // Mới: Lời khuyên bán hàng
            seoTags: { type: Type.ARRAY, items: { type: Type.STRING } }, // Mới: Hashtag
            attributes: {
              type: Type.OBJECT,
              properties: {
                brand: { type: Type.STRING },
                model: { type: Type.STRING },
                year: { type: Type.STRING },
                origin: { type: Type.STRING },
                color: { type: Type.STRING },
                material: { type: Type.STRING },
                size: { type: Type.STRING },
                capacity: { type: Type.STRING },
                status_detail: { type: Type.STRING },
                warranty: { type: Type.STRING }
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
