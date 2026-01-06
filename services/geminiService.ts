import { GoogleGenAI, Type } from "@google/genai";

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
    mileage?: string;      
    year?: string;         
    gearbox?: string;      
    fuel?: string;         
    carType?: string;      
    seatCount?: string;    
    
    // --- Bất động sản ---
    area?: string;         
    bedrooms?: string;     
    bathrooms?: string;    
    direction?: string;    
    legal?: string;        
    propertyType?: string; 

    // --- Đồ điện tử ---
    battery?: string;      
    storage?: string;      
    ram?: string;          
    color?: string;        
    warranty?: string;     

    // --- Điện lạnh ---
    capacity?: string;     
    inverter?: string;     

    // --- Thú cưng ---
    breed?: string;        
    age?: string;          
    gender?: string;       

    // --- Đồ gia dụng, Nội thất ---
    material?: string;     
    size?: string;         

    // --- Đồ dùng cá nhân ---
    brand?: string;        
    personalSize?: string; 

    // --- Việc làm ---
    salary?: string;       
    jobType?: string;      
    experience?: string;   

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

// Lấy API KEY an toàn
const API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || (process as any).env?.API_KEY || "";

export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI(API_KEY);
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64.split(',')[1] || imageBase64,
      },
    };

    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Dùng bản ổn định

    const response = await model.generateContent([
      imagePart,
      "Mô tả sản phẩm này trong 2-3 từ khóa ngắn gọn để tìm kiếm mua bán. Chỉ trả về từ khóa."
    ]);
    
    return response.response.text()?.trim() || "";
  } catch (error) {
    console.error("Image Recognition Error:", error);
    return "";
  }
};

export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  try {
    const ai = new GoogleGenAI(API_KEY);
    const imageParts = imagesBase64.map(base64 => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64.split(',')[1] || base64,
      }
    }));

    // Cấu hình model với Schema JSON
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-pro', // Hoặc gemini-1.5-flash tùy nhu cầu tốc độ
      generationConfig: {
        responseMimeType: "application/json",
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
                mileage: { type: Type.STRING },
                year: { type: Type.STRING },
                gearbox: { type: Type.STRING },
                fuel: { type: Type.STRING },
                carType: { type: Type.STRING },
                seatCount: { type: Type.STRING },
                area: { type: Type.STRING },
                bedrooms: { type: Type.STRING },
                bathrooms: { type: Type.STRING },
                direction: { type: Type.STRING },
                legal: { type: Type.STRING },
                propertyType: { type: Type.STRING },
                battery: { type: Type.STRING },
                storage: { type: Type.STRING },
                ram: { type: Type.STRING },
                color: { type: Type.STRING },
                warranty: { type: Type.STRING },
                capacity: { type: Type.STRING },
                inverter: { type: Type.STRING },
                breed: { type: Type.STRING },
                age: { type: Type.STRING },
                gender: { type: Type.STRING },
                material: { type: Type.STRING },
                size: { type: Type.STRING },
                brand: { type: Type.STRING },
                personalSize: { type: Type.STRING },
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

    const prompt = `Phân tích sản phẩm chuyên nghiệp để đăng tin rao vặt tương tự Chợ Tốt.
    ${CATEGORY_MAP_PROMPT}
    
    Yêu cầu phân tích sâu:
    1. Kiểm tra hàng cấm (Vũ khí, chất kích thích, động vật quý hiếm).
    2. Chọn ID danh mục (1-13) chính xác nhất.
    3. Đề xuất Tiêu đề hấp dẫn, chuẩn SEO.
    4. Đề xuất Giá bán (VNĐ) sát thị trường thực tế.
    5. Xác định Tình trạng (new/used).
    6. Viết Mô tả đầy đủ ưu điểm, tình trạng.
    7. TRÍCH XUẤT THÔNG SỐ CHI TIẾT (Nếu có):
       - Xe cộ: ODO, năm sản xuất, hộp số, số chỗ.
       - Đồ điện tử: % pin, model máy, dung lượng.
       - Bất động sản: Diện tích, hướng, pháp lý.
       - Thú cưng: Giống (breed), tuổi.
       - Đồ cá nhân/Nội thất: Chất liệu, size, hãng.`;

    const result = await model.generateContent([prompt, ...imageParts]);
    return JSON.parse(result.response.text() || "{}");
  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw error;
  }
};
