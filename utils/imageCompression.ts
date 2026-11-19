// utils/imageCompression.ts

// Cấu hình nén ảnh
const compressionOptions = {
  maxSizeMB: 0.5,          // Giới hạn tối đa 0.5MB (500KB)
  maxWidthOrHeight: 1920,  // Giới hạn kích thước Full HD
  useWebWorker: true,      // Chạy ngầm để không đơ trình duyệt
  fileType: 'image/jpeg',  // Ép về đuôi JPEG cho nhẹ
  initialQuality: 0.8      // Chất lượng 80%
};

/**
 * Hàm nén file ảnh
 */
export const compressImage = async (originalFile: File): Promise<File> => {
  // Nếu không phải ảnh thì trả về file gốc
  if (!originalFile.type.startsWith('image/')) return originalFile;

  try {
    console.log(`⏳ Đang nén: ${originalFile.name} (${(originalFile.size/1024/1024).toFixed(2)} MB)...`);
    // Thư viện nén ảnh chỉ tải khi người dùng chọn ảnh
    const { default: imageCompression } = await import('browser-image-compression');
    const compressedFile = await imageCompression(originalFile, compressionOptions);
    console.log(`✅ Đã nén: ${(compressedFile.size/1024/1024).toFixed(2)} MB`);
    return compressedFile;
  } catch (error) {
    console.error("Lỗi nén ảnh:", error);
    return originalFile; // Nếu lỗi thì trả về file gốc
  }
};

/**
 * Hàm nén và chuyển sang Base64 (Dùng để hiển thị preview hoặc upload dạng text)
 */
export const compressAndGetBase64 = async (originalFile: File): Promise<string> => {
    const compressedFile = await compressImage(originalFile);
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(compressedFile);
        reader.onloadend = () => {
             if (reader.result && typeof reader.result === 'string') {
                 resolve(reader.result);
             } else {
                 reject(new Error('Lỗi chuyển đổi Base64'));
             }
        };
        reader.onerror = reject;
    });
}
/**
 * Ảnh nhỏ (cạnh dài 480px, ~30 KB) để hiện trên thẻ tin, danh sách, bản đồ.
 * Ảnh lớn chỉ tải khi mở xem chi tiết -> trang chủ nhanh hơn, đỡ tốn băng thông.
 */
export const makeThumbBase64 = async (file: File, max = 480): Promise<string | null> => {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return c.toDataURL('image/jpeg', 0.72);
  } catch (_) { return null; }
};
