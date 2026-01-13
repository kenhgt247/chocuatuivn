export interface LocationInfo {
  address: string;    // Địa chỉ hiển thị (VD: Quận 1, Hồ Chí Minh)
  city: string;       // Tỉnh/TP để lọc (VD: Hồ Chí Minh)
  lat: number;
  lng: number;
}

export const getLocationFromCoords = async (lat: number, lng: number): Promise<LocationInfo> => {
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=vi`
    );

    if (!response.ok) throw new Error("Lỗi kết nối định vị");

    const data = await response.json();
    
    if (data) {
      // 1. Lấy Quận/Huyện và Tỉnh/TP
      const locality = data.locality || ""; // Thường là Quận/Huyện hoặc TP
      const cityRaw = data.principalSubdivision || ""; // Tỉnh/TP trực thuộc TW
      
      // 2. Xử lý logic lọc City chuẩn
      // Loại bỏ các từ thừa như "Tỉnh", "Thành phố" để khớp với Database
      let cleanCity = (data.city || cityRaw || locality || "Khác")
        .replace(/^Thành phố\s+/i, "")
        .replace(/^Tỉnh\s+/i, "");

      // Fix cứng một số trường hợp đặc biệt nếu cần
      if (cleanCity === "Ho Chi Minh") cleanCity = "TPHCM"; // Tuỳ vào data bạn lưu trong DB là gì

      // 3. Tạo địa chỉ hiển thị (Xử lý trùng lặp)
      // Sử dụng Set để loại bỏ các thành phần trùng nhau (VD: Hà Nội, Hà Nội)
      const addressParts = [
        locality,
        cityRaw,
        "Việt Nam"
      ].filter((part) => part && part.trim() !== ""); // Lọc rỗng
      
      // Loại bỏ trùng lặp (Dùng Set)
      const uniqueAddressParts = [...new Set(addressParts)];
      
      const displayAddress = uniqueAddressParts.join(", ");

      return {
        address: displayAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        city: cleanCity,
        lat,
        lng
      };
    }

    throw new Error("Không tìm thấy dữ liệu");

  } catch (error) {
    console.warn("Lỗi Geocoding:", error);
    
    // Fallback an toàn: Trả về "Khác" hoặc để người dùng tự nhập
    return {
      address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      city: "Khác", // Nên để "Khác" hoặc "Toàn quốc" thay vì "Miền Bắc" để tránh lỗi lọc
      lat,
      lng
    };
  }
};