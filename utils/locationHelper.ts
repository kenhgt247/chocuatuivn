

export interface LocationInfo {
  address: string;    // Địa chỉ hiển thị đầy đủ
  city: string;       // Tên Thành phố/Tỉnh (Dùng để lọc danh sách)
  lat: number;
  lng: number;
}

/**
 * Hàm gọi API lấy địa chỉ từ tọa độ (Reverse Geocoding)
 * ĐÃ SỬA: Dùng API BigDataCloud để tránh lỗi CORS của OpenStreetMap
 */
export const getLocationFromCoords = async (lat: number, lng: number): Promise<LocationInfo> => {
  try {
    // Sử dụng API BigDataCloud (Miễn phí & Không bị chặn CORS)
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=vi`
    );

    if (!response.ok) throw new Error("Lỗi kết nối đến dịch vụ bản đồ");

    const data = await response.json();
    
    // Logic lấy dữ liệu từ BigDataCloud
    if (data) {
      // 1. Xác định Thành phố (City) để dùng cho bộ lọc
      // city: Hà Nội, principalSubdivision: Hà Nội
      const city = data.city || data.principalSubdivision || data.locality || "Khác";
      
      // 2. Tạo địa chỉ hiển thị chi tiết (Address)
      // data.locality: Quận/Huyện
      // data.principalSubdivision: Tỉnh/Thành phố
      // data.countryName: Quốc gia
      const parts = [
        data.locality,              // Quận/Huyện (VD: Quận 1)
        data.principalSubdivision,  // Tỉnh/Thành (VD: Hồ Chí Minh)
        data.countryName            // Quốc gia (VD: Việt Nam)
      ];

      // Lọc bỏ các giá trị null/undefined và nối lại
      const displayAddress = parts.filter(Boolean).join(", ");

      return {
        address: displayAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`, // Nếu rỗng thì hiện tọa độ
        city: city.replace("Thành phố ", "").replace("Tỉnh ", ""), // Xử lý bớt chữ thừa cho gọn
        lat,
        lng
      };
    }

    throw new Error("Không tìm thấy địa chỉ");

  } catch (error) {
    console.warn("Lỗi Geocoding:", error);
    // Fallback: Nếu API lỗi thì trả về tọa độ thô để app không bị crash
    return {
      address: `Vị trí: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      city: lat > 16 ? "Miền Bắc" : (lat > 11 ? "Miền Trung" : "Miền Nam"),
      lat,
      lng
    };
  }
};
