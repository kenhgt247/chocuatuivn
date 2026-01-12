import { GoogleGenAI, Type } from "@google/genai";

// ==========================================================================
// 1. ĐỊNH NGHĨA INTERFACE (Kết quả trả về từ AI)
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

// Lấy API Key an toàn
const getApiKey = () => {
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || (process as any).env?.API_KEY || "";
};

// ==========================================================================
// 3. CÁC HÀM XỬ LÝ CHÍNH
// ==========================================================================

/**
 * Hàm 1: Nhận diện từ khóa để tìm kiếm (Dùng model Flash cho nhanh)
 */
export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "";

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Xử lý base64 (cắt bỏ header data:image/...)
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash', // Sử dụng bản Flash ổn định
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64,
              },
            },
            { text: "Mô tả sản phẩm này trong 2-3 từ khóa ngắn gọn tiếng Việt để tìm kiếm mua bán. Chỉ trả về từ khóa, không giải thích." }
          ]
        }
      ]
    });

    return response.text()?.trim() || "";
  } catch (error) {
    console.warn("Image Search Identification Error (Ignored):", error);
    return "";
  }
};

/**
 * Hàm 2: Phân tích chi tiết & bóc tách thông số (Dùng model Pro + Schema)
 */
export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  const apiKey = getApiKey();
  
  // Trả về object mặc định ngay nếu thiếu key để không crash App
  if (!apiKey) {
    console.log("ℹ️ Skipped AI Analysis: No API Key provided.");
    return {
      title: '', category: '13', suggestedPrice: 0, 
      description: '', condition: 'used', isProhibited: false 
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Chuẩn bị dữ liệu ảnh
    const imageParts = imagesBase64.map(base64 => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64.split(',')[1] || base64,
      }
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-pro', // Sử dụng 1.5 Pro (hoặc 2.0-flash-exp nếu có quyền)
      contents: [
        {
          role: 'user',
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
            6. TRÍCH XUẤT THÔNG SỐ KỸ THUẬT (attributes) chi tiết từ hình ảnh.
            ` }
          ]
        }
      ],
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
            
            // --- SCHEMA ATTRIBUTES CHI TIẾT ---
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
                brand: { type: Type.STRING },
                personalSize: { type: Type.STRING },
                // Việc làm
                salary: { type: Type.STRING },
                jobType: { type: Type.STRING },
                experience: { type: Type.STRING }
              }
            }
          },
          required: ["isProhibited", "title", "category", "suggestedPrice", "condition", "description"]
        }
      }
    });

    // Lấy text JSON và làm sạch (phòng trường hợp model trả về markdown code block)
    const rawText = response.text();
    if (!rawText) throw new Error("Empty response from Gemini");

    const cleanJson = rawText.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson) as ListingAnalysis;

  } catch (error) {
    console.error("AI Analysis Error:", error);
    // Trả về dữ liệu an toàn để không làm gián đoạn người dùng
    return {
      title: '', 
      description: '', 
      category: '13', 
      suggestedPrice: 0, 
      condition: 'used', 
      isProhibited: false 
    };
  }
};