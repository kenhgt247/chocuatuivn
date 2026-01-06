import { GoogleGenAI, Type } from "@google/genai";

export interface ListingAnalysis {
  category: string;
  suggestedPrice: number;
  description: string;
  title: string;
  condition: 'new' | 'used';
  isProhibited: boolean;
  prohibitedReason?: string;
  // Hệ thống attributes đầy đủ cho tất cả danh mục
  attributes?: {
    // --- Xe cộ ---
    mileage?: string;      // Số Km đã đi
    year?: string;         // Năm sản xuất
    gearbox?: string;      // Hộp số (Số sàn/Tự động)
    fuel?: string;         // Nhiên liệu (Xăng/Dầu/Điện)
    carType?: string;      // Kiểu dáng (Sedan/SUV/Hatchback...)
    seatCount?: string;    // Số chỗ ngồi
    
    // --- Bất động sản ---
    area?: string;         // Diện tích (m2)
    bedrooms?: string;     // Số phòng ngủ
    bathrooms?: string;    // Số phòng vệ sinh
    direction?: string;    // Hướng nhà
    legal?: string;        // Pháp lý (Sổ đỏ, sổ hồng...)
    propertyType?: string; // Loại hình (Đất/Nhà ở/Chung cư)
    
    // --- Đồ điện tử ---
    battery?: string;      // Dung lượng pin (%)
    storage?: string;      // Bộ nhớ trong (ROM)
    ram?: string;          // Dung lượng RAM
    screenSize?: string;   // Kích thước màn hình
    color?: string;        // Màu sắc
    warranty?: string;     // Tình trạng bảo hành
    
    // --- Điện lạnh ---
    capacity?: string;     // Công suất (HP, BTU)
    inverter?: string;     // Có tiết kiệm điện (Inverter) không
    
    // --- Việc làm ---
    salary?: string;       // Mức lương
    jobType?: string;      // Hình thức (Toán thời gian/Bán thời gian)
    experience?: string;   // Kinh nghiệm yêu cầu
    
    [key: string]: any;
  };
}

const CATEGORY_MAP_PROMPT = `
Danh mục ID và Tên:
1: Bất động sản
2: Xe cộ
3: Đồ điện tử
4: Đồ gia dụng, nội thất
5: Giải trí, Thể thao, Sở thích
6: Đồ dùng cá nhân
7: Mẹ và bé
8: Thú cưng
9: Đồ ăn, thực phẩm
10: Tủ lạnh, máy lạnh, máy giặt
11: Việc làm
12: Dịch vụ, Du lịch
13: Các loại khác
`;

export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64.split(',')[1] || imageBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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

export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  try {
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    const imageParts = imagesBase64.map(base64 => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64.split(',')[1] || base64,
      }
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          ...imageParts,
          { text: `Phân tích sản phẩm chuyên nghiệp để đăng tin rao vặt tương tự Chợ Tốt.
          ${CATEGORY_MAP_PROMPT}
          
          Yêu cầu phân tích sâu:
          1. Kiểm tra hàng cấm (Vũ khí, chất kích thích, động vật quý hiếm).
          2. Chọn ID danh mục (1-13) chính xác nhất.
          3. Đề xuất Tiêu đề hấp dẫn, chuẩn SEO.
          4. Đề xuất Giá bán (VNĐ) sát thị trường thực tế.
          5. Xác định Tình trạng (new/used).
          6. Viết Mô tả đầy đủ ưu điểm, tình trạng.
          7. TRÍCH XUẤT THÔNG SỐ CHI TIẾT (QUAN TRỌNG):
             - Nếu là Xe cộ: Tìm số ODO trên bảng điện tử, xem cần số để biết Hộp số, nhìn logo/dáng để biết loại xe, số chỗ.
             - Nếu là Đồ điện tử: Tìm % pin trong ảnh màn hình, nhận diện model để đoán RAM/ROM.
             - Nếu là Bất động sản: Đọc các biển quảng cáo, giấy tờ hoặc ước lượng quy mô công trình.` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 32768 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isProhibited: { type: Type.BOOLEAN },
            prohibitedReason: { type: Type.STRING },
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            suggestedPrice: { type: Type.NUMBER },
            condition: { type: Type.STRING },
            description: { type: Type.STRING },
            attributes: {
              type: Type.OBJECT,
              properties: {
                // Nhóm Xe cộ
                mileage: { type: Type.STRING, description: "Số ODO ví dụ: 12000" },
                year: { type: Type.STRING, description: "Năm sản xuất ví dụ: 2021" },
                gearbox: { type: Type.STRING, description: "Tự động hoặc Số sàn" },
                fuel: { type: Type.STRING, description: "Xăng, Dầu hoặc Điện" },
                carType: { type: Type.STRING, description: "Sedan, SUV, MPV..." },
                seatCount: { type: Type.STRING, description: "4 chỗ, 7 chỗ..." },
                
                // Nhóm Bất động sản
                area: { type: Type.STRING, description: "Diện tích m2" },
                bedrooms: { type: Type.STRING, description: "Số phòng ngủ" },
                bathrooms: { type: Type.STRING, description: "Số toilet" },
                direction: { type: Type.STRING, description: "Đông, Tây, Nam, Bắc..." },
                legal: { type: Type.STRING, description: "Sổ hồng, Sổ đỏ..." },
                propertyType: { type: Type.STRING, description: "Nhà phố, Đất nền, Chung cư" },
                
                // Nhóm Đồ điện tử
                battery: { type: Type.STRING, description: "Pin (%)" },
                storage: { type: Type.STRING, description: "ROM (64GB, 256GB...)" },
                ram: { type: Type.STRING, description: "Dung lượng RAM" },
                color: { type: Type.STRING, description: "Màu sắc sản phẩm" },
                warranty: { type: Type.STRING, description: "Còn bảo hành / Hết bảo hành" },
                
                // Nhóm Điện lạnh
                capacity: { type: Type.STRING, description: "Công suất ví dụ 1.5 HP" },
                inverter: { type: Type.STRING, description: "Có hoặc Không" }
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
