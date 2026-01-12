import { GoogleGenAI, Type } from "@google/genai";

// ==========================================================================
// 1. ĐỊNH NGHĨA INTERFACE (FULL ĐẦY ĐỦ CÁC NGÀNH HÀNG)
// ==========================================================================
export interface ListingAnalysis {
  category: string;
  suggestedPrice: number;
  description: string;
  title: string;
  condition: 'new' | 'used';
  isProhibited: boolean;
  prohibitedReason?: string;
  attributes?: {
    // --- Xe cộ ---
    mileage?: string;      // Số Km
    year?: string;         // Năm SX
    gearbox?: string;      // Hộp số
    fuel?: string;         // Nhiên liệu
    carType?: string;      // Kiểu dáng
    seatCount?: string;    // Số chỗ
    
    // --- Bất động sản ---
    area?: string;         // Diện tích
    bedrooms?: string;     // Số phòng ngủ
    bathrooms?: string;    // Số WC
    direction?: string;    // Hướng nhà
    legal?: string;        // Pháp lý
    propertyType?: string; // Loại hình

    // --- Đồ điện tử ---
    battery?: string;      // Pin (%)
    storage?: string;      // Bộ nhớ trong
    ram?: string;          // RAM
    color?: string;        // Màu sắc
    warranty?: string;     // Bảo hành

    // --- Điện lạnh ---
    capacity?: string;     // Công suất
    inverter?: string;     // Tiết kiệm điện

    // --- Thú cưng ---
    breed?: string;        // Giống loài
    age?: string;          // Độ tuổi
    gender?: string;       // Giới tính

    // --- Đồ gia dụng / Nội thất ---
    material?: string;     // Chất liệu
    size?: string;         // Kích thước

    // --- Thời trang / Đồ cá nhân ---
    brand?: string;        // Thương hiệu
    personalSize?: string; // Size quần áo/giày

    // --- Việc làm ---
    salary?: string;       // Mức lương
    jobType?: string;      // Hình thức làm việc
    experience?: string;   // Kinh nghiệm

    [key: string]: any;
  };
}

// ==========================================================================
// 2. CẤU HÌNH & HELPER
// ==========================================================================

const CATEGORY_MAP_PROMPT = `
Danh mục ID và Tên:
1: Bất động sản
2: Xe cộ
3: Đồ điện tử (Điện thoại, Laptop, Loa...)
4: Đồ gia dụng, nội thất
5: Giải trí, Thể thao, Sở thích
6: Đồ dùng cá nhân (Quần áo, Giày dép...)
7: Mẹ và bé
8: Thú cưng
9: Đồ ăn, thực phẩm
10: Tủ lạnh, máy lạnh, máy giặt (Điện lạnh)
11: Việc làm
12: Dịch vụ, Du lịch
13: Các loại khác
`;

// Lấy API Key: Ưu tiên biến môi trường VITE_ theo chuẩn React/Vite
const getApiKey = () => {
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || (process as any).env?.API_KEY || "";
};

// [QUAN TRỌNG] Hàm lấy text an toàn để tránh lỗi "text is not a function"
const safeGetText = (response: any): string => {
  try {
    // Cách 1: Dùng hàm text() chuẩn của SDK mới nếu có
    if (typeof response.text === 'function') {
      return response.text();
    }
    // Cách 2: Lấy trực tiếp từ cấu trúc JSON (Fallback)
    if (response.candidates && response.candidates.length > 0) {
      const firstCandidate = response.candidates[0];
      if (firstCandidate.content && firstCandidate.content.parts && firstCandidate.content.parts.length > 0) {
        return firstCandidate.content.parts[0].text || "";
      }
    }
    return "";
  } catch (e) {
    console.error("Lỗi trích xuất text từ response AI:", e);
    return "";
  }
};

// ==========================================================================
// 3. CÁC HÀM XỬ LÝ CHÍNH (SỬ DỤNG GEMINI 3.0)
// ==========================================================================

// Hàm 1: Nhận diện từ khóa (Dùng model 3.0 Flash)
export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "";

  try {
    const ai = new GoogleGenAI({ apiKey });
    // Cắt header base64 nếu có để tránh lỗi payload
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

    const response = await ai.models.generateContent({
      model: 'gemini-3.0-flash', 
      contents: {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: "Mô tả sản phẩm này trong 3-5 từ khóa tiếng Việt ngắn gọn. Chỉ trả về từ khóa." }
        ]
      }
    });
    
    return safeGetText(response).trim();
  } catch (error) {
    console.warn("Lỗi nhận diện ảnh tìm kiếm (Bỏ qua):", error);
    return "";
  }
};

// Hàm 2: Phân tích chi tiết & bóc tách thông số (Dùng model 3.0 Flash + Full Schema)
export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  const apiKey = getApiKey();
  
  // Kiểm tra Key trước khi gọi để không crash app
  if (!apiKey) {
    console.log("⚠️ Bỏ qua AI: Chưa cấu hình API Key.");
    return { title: '', description: '', category: '13', suggestedPrice: 0, condition: 'used', isProhibited: false };
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
      model: 'gemini-3.0-flash', // Dùng Gemini 3.0 cho Key trả phí
      
      contents: {
        role: 'user',
        parts: [
          ...imageParts,
          { text: `Phân tích sản phẩm đăng tin rao vặt. ${CATEGORY_MAP_PROMPT}
          Yêu cầu: Trả về JSON hợp lệ khớp với Schema chi tiết đã định nghĩa.` }
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
            category: { type: Type.STRING, description: "ID danh mục từ 1-13" },
            suggestedPrice: { type: Type.NUMBER },
            condition: { type: Type.STRING },
            description: { type: Type.STRING },
            
            // --- FULL SCHEMA ATTRIBUTES (KHỚP 100% VỚI INTERFACE) ---
            attributes: {
              type: Type.OBJECT,
              properties: {
                // Xe cộ
                mileage: { type: Type.STRING },
                year: { type: Type.STRING },
                gearbox: { type: Type.STRING },
                fuel: { type: Type.STRING },
                carType: { type: Type.STRING },
                seatCount: { type: Type.STRING },
                
                // Bất động sản
                area: { type: Type.STRING },
                bedrooms: { type: Type.STRING },
                bathrooms: { type: Type.STRING },
                direction: { type: Type.STRING },
                legal: { type: Type.STRING },
                propertyType: { type: Type.STRING },

                // Đồ điện tử
                battery: { type: Type.STRING },
                storage: { type: Type.STRING },
                ram: { type: Type.STRING },
                color: { type: Type.STRING },
                warranty: { type: Type.STRING },

                // Điện lạnh
                capacity: { type: Type.STRING },
                inverter: { type: Type.STRING },

                // Thú cưng
                breed: { type: Type.STRING },
                age: { type: Type.STRING },
                gender: { type: Type.STRING },

                // Nội thất/Đồ dùng
                material: { type: Type.STRING },
                size: { type: Type.STRING },

                // Thời trang
                brand: { type: Type.STRING },
                personalSize: { type: Type.STRING },

                // Việc làm
                salary: { type: Type.STRING },
                jobType: { type: Type.STRING },
                experience: { type: Type.STRING }
              }
            }
          },
          required: ["title", "category", "suggestedPrice", "condition", "description"]
        }
      }
    });

    const rawText = safeGetText(response);
    if (!rawText) throw new Error("AI trả về dữ liệu rỗng");

    // Clean JSON string (xóa markdown ```json nếu có)
    const cleanJson = rawText.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson) as ListingAnalysis;

  } catch (error) {
    console.error("❌ Lỗi phân tích AI:", error);
    // Trả về dữ liệu an toàn để người dùng vẫn nhập tay được
    return { title: '', description: '', category: '13', suggestedPrice: 0, condition: 'used', isProhibited: false };
  }
};
