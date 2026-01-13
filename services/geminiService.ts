import { GoogleGenAI, Type } from "@google/genai";

// ==========================================================================
// 1. ĐỊNH NGHĨA INTERFACE
// ==========================================================================
export interface ListingAnalysis {
  category: string; // Quan trọng: Phải là ID danh mục con (vd: xe-may, dien-thoai)
  suggestedPrice: number;
  description: string;
  title: string;
  condition: 'new' | 'used';
  isProhibited: boolean;
  prohibitedReason?: string;
  attributes?: Record<string, any>; // Lưu dynamic fields
}

// [QUAN TRỌNG] MAP DANH MỤC KHỚP VỚI CONSTANTS.TS
// Chúng ta dạy AI biết các ID chính xác của hệ thống
const CATEGORY_MAP_PROMPT = `
HÃY CHỌN CHÍNH XÁC MỘT TRONG CÁC CATEGORY_ID DƯỚI ĐÂY (Ưu tiên danh mục con cụ thể):

- Bất động sản: 'can-ho-chung-cu', 'nha-o', 'dat', 'phong-tro'
- Xe cộ: 'xe-may', 'o-to', 'xe-dien', 'xe-dap'
- Đồ điện tử: 'dien-thoai', 'laptop', 'may-tinh-bang', 'tivi-am-thanh'
- Việc làm: 'ban-hang', 'nhan-vien-phuc-vu', 'tai-xe-giao-hang', 'bao-ve'
- Thú cưng: 'cho', 'meo', 'ga', 'chim'
- Điện lạnh: 'tu-lanh', 'may-lanh', 'may-giat'
- Thời trang: 'quan-ao', 'giay-dep', 'dong-ho', 'tui-xach'
- Mẹ và bé: 'me-va-be'
- Nội thất: 'noi-that'
- Giải trí: 'giai-tri'
- Khác: 'khac'
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
// 2. CÁC HÀM GỌI API
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
          { text: "Chỉ trả về 1 hoặc 2 danh từ tiếng Việt ngắn gọn nhất đại diện cho vật thể chính trong ảnh để tìm kiếm. Ví dụ: 'xe máy', 'áo', 'điện thoại', 'tủ lạnh'. Không thêm mô tả, không thêm dấu câu." }
        ]
      }
    });
    
    // safeGetText sẽ lấy nội dung và .trim() sẽ loại bỏ khoảng trắng dư thừa
    const result = safeGetText(response).trim().toLowerCase();
    return result;
  } catch (error) {
    console.error("Lỗi AI Search:", error);
    return "";
  }
};

export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { title: '', description: '', category: 'khac', suggestedPrice: 0, condition: 'used', isProhibited: false };
  }

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
          { text: `Phân tích ảnh sản phẩm để đăng tin bán hàng.
          ${CATEGORY_MAP_PROMPT}
          
          Yêu cầu:
          1. Category: BẮT BUỘC trả về đúng chuỗi ID trong danh sách trên (Ví dụ: trả về 'xe-may', KHÔNG trả về 'Xe máy' hay số 2).
          2. Attributes: Trích xuất thông số kỹ thuật khớp với loại sản phẩm (Ví dụ: Xe thì cần mileage, year, brand. Điện thoại thì cần battery, storage, brand).
          3. Title: Ngắn gọn, hấp dẫn, bao gồm tên hãng và model.
          4. Price: Số nguyên VNĐ (ước lượng).
          ` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isProhibited: { type: Type.BOOLEAN },
            prohibitedReason: { type: Type.STRING },
            title: { type: Type.STRING },
            category: { type: Type.STRING }, // AI sẽ trả về ID dạng string (xe-may)
            suggestedPrice: { type: Type.NUMBER },
            condition: { type: Type.STRING },
            description: { type: Type.STRING },
            attributes: {
              type: Type.OBJECT,
              properties: {
                // Mapping toàn bộ key có thể có
                brand: { type: Type.STRING },
                model: { type: Type.STRING },
                year: { type: Type.STRING }, // AI trả string để an toàn
                mileage: { type: Type.STRING },
                storage: { type: Type.STRING },
                ram: { type: Type.STRING },
                color: { type: Type.STRING },
                area: { type: Type.STRING },
                bedrooms: { type: Type.STRING },
                direction: { type: Type.STRING },
                salary: { type: Type.STRING },
                jobType: { type: Type.STRING },
                breed: { type: Type.STRING },
                age: { type: Type.STRING },
                capacity: { type: Type.STRING }
              }
            }
          },
          required: ["title", "category", "suggestedPrice", "description"]
        }
      }
    });

    const rawText = safeGetText(response);
    if (!rawText) throw new Error("AI trả về rỗng");

    return JSON.parse(rawText) as ListingAnalysis;
  } catch (error) {
    console.error("Lỗi AI:", error);
    return { 
      title: '', description: '', category: 'khac', suggestedPrice: 0, 
      condition: 'used', isProhibited: false 
    };
  }
};