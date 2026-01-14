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
Cố gắng chọn danh mục con cụ thể nhất.

1. Bất động sản:
   - 'can-ho-chung-cu' (Căn hộ/Chung cư)
   - 'dat' (Đất)
   - 'nha-o' (Nhà ở)
   - 'phong-tro' (Phòng trọ)
   - 'van-phong-mat-bang' (Văn phòng, Mặt bằng)

2. Xe cộ:
   - 'o-to' (Ô tô)
   - 'phu-tung-xe' (Phụ tùng xe)
   - 'xe-dap' (Xe đạp)
   - 'xe-dien' (Xe điện)
   - 'xe-may' (Xe máy)
   - 'xe-tai-ben' (Xe tải, Xe ben)

3. Đồ điện tử:
   - 'tivi-am-thanh' (Tivi, Loa, Amply)
   - 'phu-kien-so' (Tai nghe, Sạc, Cáp)
   - 'dien-thoai' (Điện thoại)
   - 'laptop' (Laptop)
   - 'linh-kien' (RAM, CPU, VGA...)
   - 'may-anh' (Máy ảnh, Máy quay)
   - 'may-tinh-bang' (Tablet)
   - 'may-tinh-de-ban' (PC, Màn hình)
   - 'thiet-bi-deo' (Smartwatch)

4. Việc làm:
   - 'lao-dong-pho-thong' (Lao động phổ thông)
   - 'van-phong-hcns' (Văn phòng/Hành chính nhân sự)
   - 'ky-su-ky-thuat' (Kỹ sư/Kỹ thuật)
   - 'cntt-thiet-ke' (IT/Design)
   - 'ban-hang' (Nhân viên bán hàng)
   - 'bao-ve' (Bảo vệ)
   - 'cong-nhan' (Công nhân)
   - 'nhan-vien-kinh-doanh' (Sale)
   - 'nhan-vien-phuc-vu' (Phục vụ)
   - 'pha-che' (Bartender/Barista)
   - 'phu-bep' (Phụ bếp)
   - 'lai-xe-giao-hang' (Tài xế/Shipper)
   - 'tap-vu' (Tạp vụ/Giúp việc)

5. Thú cưng:
   - 'chim' (Chim cảnh)
   - 'cho' (Chó)
   - 'ga' (Gà)
   - 'meo' (Mèo)
   - 'phu-kien-thu-cung' (Thức ăn, phụ kiện)
   - 'thu-cung-khac' (Hamster, Cá, bò sát...)

6. Điện lạnh (Tủ lạnh, Máy lạnh, Máy giặt):
   - 'may-giat' (Máy giặt)
   - 'may-lanh' (Máy lạnh/Điều hòa)
   - 'tu-lanh' (Tủ lạnh)

7. Đồ gia dụng, Nội thất, Cây cảnh:
   - 'giuong-chan-ga' (Giường, Chăn ga gối nệm)
   - 'tu-bep' (Tủ bếp)
   - 'ban-ghe' (Bàn ghế)
   - 'thiet-bi-nha-bep' (Bếp, Lò vi sóng, Nồi cơm)
   - 'cay-canh-trang-tri' (Cây cảnh, Decor)
   - 'dung-cu-nha-bep' (Dao, thớt, xoong nồi)
   - 'tu-ke' (Tủ quần áo, Kệ sách)

8. Thời trang, Đồ dùng cá nhân:
   - 'quan-ao-nam' (Quần áo Nam)
   - 'quan-ao-nu' (Quần áo Nữ)
   - 'dong-ho' (Đồng hồ)
   - 'giay-dep' (Giày dép)
   - 'nuoc-hoa' (Nước hoa/Mỹ phẩm)
   - 'tui-xach' (Túi xách/Ví)

9. Giải trí, Thể thao:
   - 'do-the-thao' (Dụng cụ thể thao)
   - 'da-ngoai' (Đồ dã ngoại/Cắm trại)
   - 'nhac-cu' (Đàn, Trống...)
   - 'sach' (Sách báo)
   - 'do-suu-tam' (Đồ cổ, Tem, Tiền xu)

10. Mẹ và Bé:
    - 'xe-day-noi' (Xe đẩy, Nôi)
    - 'do-choi' (Đồ chơi)
    - 'quan-ao-be' (Quần áo trẻ em)

11. Dịch vụ, Du lịch:
    - 'dich-vu-sua-chua' (Thợ sửa chữa)
    - 'van-tai' (Vận tải, Chở hàng)
    - 'du-lich' (Tour, Vé máy bay)
    - 'dich-vu-don-dep' (Dọn nhà)

12. Thực phẩm:
    - 'trai-cay' (Trái cây)
    - 'dac-san' (Đặc sản vùng miền)

13. Khác:
    - 'cac-loai-khac'
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
