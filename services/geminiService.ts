import { GoogleGenAI, Type } from "@google/genai";

// 1. Định nghĩa Interface kết quả trả về (Đầy đủ mọi trường như Chợ Tốt)
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

// Lấy API Key: Ưu tiên biến môi trường Vite, fallback sang process.env (như code cũ của bạn)
const getApiKey = () => {
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || (process as any).env?.API_KEY || "";
};

// 2. Hàm nhận diện từ khóa (Dùng model Flash cho nhanh)
export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64.split(',')[1] || imageBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Giữ nguyên model 3 flash
      contents: {
        parts: [
          imagePart,
          { text: "Mô tả sản phẩm này trong 2-3 từ khóa ngắn gọn để tìm kiếm mua bán. Chỉ trả về từ khóa." }
        ]
      }
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Image Recognition Error:", error);
    return "";
  }
};

// 3. Hàm phân tích chi tiết & bóc tách thông số (Dùng model Pro 3 + Schema JSON)
export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const imageParts = imagesBase64.map(base64 => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64.split(',')[1] || base64,
      }
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Giữ nguyên model 3 pro để suy luận sâu
      contents: {
        parts: [
          ...imageParts,
          { text: `Phân tích sản phẩm chuyên nghiệp để đăng tin rao vặt tương tự Chợ Tốt.
          ${CATEGORY_MAP_PROMPT}
          
          Yêu cầu:
          1. Kiểm tra hàng cấm (Vũ khí, chất kích thích, động vật quý hiếm...).
          2. Chọn ID danh mục (1-13) chính xác nhất.
          3. Đề xuất Tiêu đề hấp dẫn và Giá bán sát thực tế (VNĐ).
          4. Xác định Tình trạng (new/used).
          5. Viết Mô tả ngắn gọn, đầy đủ ưu điểm.
          6. TRÍCH XUẤT THÔNG SỐ KỸ THUẬT (attributes) dựa trên hình ảnh:
             - Xe cộ: Nhìn bảng đồng hồ đoán ODO, nhìn cần số đoán Hộp số, nhìn đuôi xe đoán Kiểu dáng.
             - Bất động sản: Đọc thông tin trên biển bán nhà (nếu có) để lấy Diện tích, Hướng.
             - Đồ điện tử: Đọc màn hình giới thiệu để lấy Pin, Bộ nhớ.
             - Thú cưng: Nhận diện Giống loài (Poodle, Corgi...), Độ tuổi.
             - Việc làm: Đọc nội dung tuyển dụng để lấy Lương, Kinh nghiệm.
          ` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        // Bật thinkingBudget để model suy luận kỹ hơn về các chi tiết nhỏ trong ảnh
        thinkingConfig: { thinkingBudget: 32768 }, 
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
            // --- ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT: SCHEMA CHO CÁC TRƯỜNG DỮ LIỆU ---
            attributes: {
              type: Type.OBJECT,
              properties: {
                // Xe cộ
                mileage: { type: Type.STRING, description: "Số ODO" },
                year: { type: Type.STRING, description: "Năm sản xuất" },
                gearbox: { type: Type.STRING, description: "Tự động/Số sàn" },
                fuel: { type: Type.STRING, description: "Xăng/Dầu/Điện" },
                carType: { type: Type.STRING, description: "Sedan/SUV/Hatchback..." },
                seatCount: { type: Type.STRING, description: "Số chỗ ngồi" },
                
                // Bất động sản
                area: { type: Type.STRING, description: "Diện tích m2" },
                bedrooms: { type: Type.STRING, description: "Số phòng ngủ" },
                bathrooms: { type: Type.STRING, description: "Số WC" },
                direction: { type: Type.STRING, description: "Hướng nhà" },
                legal: { type: Type.STRING, description: "Sổ đỏ/Sổ hồng" },
                propertyType: { type: Type.STRING, description: "Nhà ở/Chung cư/Đất" },

                // Đồ điện tử
                battery: { type: Type.STRING, description: "Pin %" },
                storage: { type: Type.STRING, description: "Bộ nhớ trong" },
                ram: { type: Type.STRING, description: "RAM" },
                color: { type: Type.STRING, description: "Màu sắc" },
                warranty: { type: Type.STRING, description: "Bảo hành" },

                // Điện lạnh
                capacity: { type: Type.STRING, description: "Công suất" },
                inverter: { type: Type.STRING, description: "Có/Không" },

                // Thú cưng
                breed: { type: Type.STRING, description: "Giống loài" },
                age: { type: Type.STRING, description: "Tuổi" },
                gender: { type: Type.STRING, description: "Đực/Cái" },

                // Nội thất/Đồ dùng
                material: { type: Type.STRING, description: "Chất liệu" },
                size: { type: Type.STRING, description: "Kích thước" },
                brand: { type: Type.STRING, description: "Thương hiệu" },
                personalSize: { type: Type.STRING, description: "Size quần áo/giày" },

                // Việc làm
                salary: { type: Type.STRING, description: "Mức lương" },
                jobType: { type: Type.STRING, description: "Toàn thời gian/Bán thời gian" },
                experience: { type: Type.STRING, description: "Kinh nghiệm" }
              }
            }
          },
          required: ["isProhibited", "title", "category", "suggestedPrice", "condition", "description"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw error;
  }
};
