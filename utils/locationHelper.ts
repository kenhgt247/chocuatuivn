// src/utils/locationHelper.ts

export interface LocationInfo {
  address: string;    // Địa chỉ hiển thị đầy đủ (VD: 123 Đường A, Quận B, TP.HCM)
  city: string;       // Tên Thành phố/Tỉnh (Dùng để lọc danh sách)
  lat: number;
  lng: number;
}

/**
 * Hàm gọi API OpenStreetMap để lấy địa chỉ từ tọa độ (Reverse Geocoding)
 * Hoàn toàn miễn phí, không cần API Key.
 */
export const getLocationFromCoords = async (lat: number, lng: number): Promise<LocationInfo> => {
  try {
    // Gọi API Nominatim của OpenStreetMap
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
            // Quan trọng: Phải có User-Agent để không bị chặn
            'User-Agent': 'ChoCuaTui-App/1.0', 
            'Accept-Language': 'vi' // Ưu tiên tiếng Việt
        }
      }
    );

    if (!response.ok) throw new Error("Lỗi kết nối đến dịch vụ bản đồ");

    const data = await response.json();
    
    if (data && data.address) {
      // 1. Xác định Thành phố (City) để dùng cho bộ lọc
      // Nominatim trả về nhiều trường khác nhau tùy khu vực (city, town, village, state...)
      const city = data.address.city || 
                   data.address.town || 
                   data.address.village || 
                   data.address.state || 
                   "Khác";
      
      // 2. Tạo địa chỉ hiển thị chi tiết (Address)
      // Ghép: Số nhà + Đường + Phường + Quận + Thành phố
      const parts = [
        data.address.house_number,
        data.address.road,
        data.address.quarter,
        data.address.suburb || data.address.district,
        data.address.city || data.address.state
      ];

      // Lọc bỏ các giá trị null/undefined và nối lại bằng dấu phẩy
      const displayAddress = parts.filter(Boolean).join(", ");

      return {
        address: displayAddress || "Chưa xác định được tên đường",
        city: city,
        lat,
        lng
      };
    }

    throw new Error("Không tìm thấy địa chỉ");

  } catch (error) {
    console.warn("Lỗi Geocoding:", error);
    // Fallback: Nếu lỗi thì trả về tọa độ thô
    return {
      address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      city: lat > 16 ? "Miền Bắc" : (lat > 11 ? "Miền Trung" : "Miền Nam"), // Đoán tạm vùng miền
      lat,
      lng
    };
  }
};