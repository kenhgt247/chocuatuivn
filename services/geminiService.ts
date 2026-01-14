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

// [CẬP NHẬT] MAP DANH MỤC KHỚP VỚI CẤU TRÚC MỚI CỦA BẠN
const CATEGORY_MAP_PROMPT = `
HÃY PHÂN TÍCH ẢNH VÀ CHỌN CHÍNH XÁC MỘT TRONG CÁC ID (SLUG) DƯỚI ĐÂY.
Cố gắng chọn danh mục con cụ thể nhất có thể.

1. Bất động sản: 'can-ho-chung-cu', 'nha-o', 'dat', 'phong-tro', 'van-phong'

2. Xe cộ: 'o-to', 'xe-may', 'xe-dien', 'xe-tai', 'xe-dap', 'phu-tung-xe'

3. Đồ điện tử:
   - 'dien-thoai'
   - 'may-tinh-bang'
   - 'laptop'
   - 'may-tinh-de-ban'
   - 'may-anh'
   - 'tivi-am-thanh'
   - 'thiet-bi-thong-minh' (Smartwatch)
   - 'phu-kien-dt' (Tai nghe, Sạc, Chuột...)
   - 'linh-kien' (RAM, CPU...)

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
