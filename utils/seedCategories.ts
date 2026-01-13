import { db } from '../services/db';
import { CATEGORIES } from '../constants'; 
import { Category } from '../types';

export const seedCategoriesToFirebase = async () => {
  if (!window.confirm("⚠️ CẢNH BÁO: Hành động này sẽ ghi đè danh mục trên Database bằng dữ liệu chuẩn trong code. Bạn có chắc chắn không?")) return;

  console.log("🚀 Đang bắt đầu đồng bộ danh mục...");
  
  try {
    let count = 0;
    for (const cat of CATEGORIES) {
      // Ưu tiên dùng slug làm ID
      const newId = cat.slug || cat.id; 

      const newCat: Category = {
        id: newId, 
        name: cat.name,
        icon: cat.icon || '📦',
        slug: newId,
        
        // [QUAN TRỌNG] Lấy đúng dữ liệu từ constants.ts
        parentId: cat.parentId || null, 
        order: cat.order || 99, 
        attributes: cat.attributes || [] 
      };

      await db.saveCategory(newCat);
      console.log(`✅ Đã nạp: ${newCat.name} | Cha: ${newCat.parentId || 'Gốc'} | Trường: ${newCat.attributes?.length}`);
      count++;
    }
    alert(`🎉 Thành công! Đã nạp ${count} danh mục. Hãy tải lại trang để thấy kết quả.`);
  } catch (e) {
    console.error(e);
    alert("❌ Lỗi khi nạp danh mục. Xem console để biết chi tiết.");
  }
};