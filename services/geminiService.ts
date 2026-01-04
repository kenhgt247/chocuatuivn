
import { GoogleGenAI, Type } from "@google/genai";

export interface ListingAnalysis {
  category: string;
  suggestedPrice: number;
  description: string;
  title: string;
  condition: 'new' | 'used';
  isProhibited: boolean;
  prohibitedReason?: string;
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

// Sử dụng model gemini-3-flash-preview cho nhiệm vụ nhận diện từ khóa đơn giản
export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  try {
    // Khởi tạo trực tiếp bằng process.env.API_KEY theo hướng dẫn
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64.split(',')[1] || imageBase64,
      },
    };

    // Sử dụng contents dưới dạng object thay vì array theo hướng dẫn mới nhất
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          imagePart,
          { text: "Mô tả sản phẩm này trong 2-3 từ khóa ngắn gọn để tìm kiếm mua bán. Chỉ trả về từ khóa." }
        ]
      }
    });
    // Trích xuất văn bản từ response.text property
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Image Recognition Error:", error);
    return "";
  }
};

// Sử dụng model gemini-3-pro-preview cho nhiệm vụ phân tích hình ảnh phức tạp
export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  try {
    // Luôn tạo instance GoogleGenAI ngay trước khi gọi để đảm bảo sử dụng API Key mới nhất
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
          { text: `Phân tích sản phẩm trong ảnh để đăng tin rao vặt. 
          ${CATEGORY_MAP_PROMPT}
          Yêu cầu:
          1. Kiểm tra hàng cấm (vũ khí, ma túy, thuốc lá).
          2. Chọn ID danh mục phù hợp nhất (1-13).
          3. Đề xuất tiêu đề thu hút.
          4. Đề xuất giá bán hợp lý (VNĐ).
          5. Xác định tình trạng (new/used).
          6. Viết mô tả ngắn gọn, chuyên nghiệp.` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        // Bật thinkingBudget để model Pro có không gian suy luận sâu hơn cho dữ liệu multimodal
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
            description: { type: Type.STRING }
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
