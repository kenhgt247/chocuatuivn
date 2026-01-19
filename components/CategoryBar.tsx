import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../services/db";
import { Category } from "../types";
import { getLocationFromCoords } from "../utils/locationHelper";

// Import bộ icon dự phòng (nếu cần)
import { 
  Menu, MapPin, ChevronRight, Loader2, LayoutGrid,
  Smartphone, Shirt, Home, Car, Briefcase, Wrench, 
  Dog, Baby, Monitor, Utensils
} from 'lucide-react';

const CategoryBar: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(searchParams.get('location'));
  const [isLocating, setIsLocating] = useState(false);

  // --- 1. LẤY DỮ LIỆU ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await db.getCategories();
        setCategories(data || []);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- 2. XỬ LÝ DỮ LIỆU (LỌC CHA/CON) ---
  const parents = categories
    .filter((c) => !c.parentId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // --- 3. HÀM HIỂN THỊ ICON THÔNG MINH ---
  const renderCategoryIcon = (iconStr: string | undefined) => {
    // Trường hợp 1: Không có icon -> Hiện icon mặc định
    if (!iconStr) return <LayoutGrid className="w-6 h-6 text-slate-400" />;

    // Trường hợp 2: Là đường dẫn ảnh (http...) -> Hiện ảnh
    if (iconStr.includes('/') || iconStr.includes('http')) {
        return <img src={iconStr} alt="" className="w-full h-full object-contain" />;
    }

    // Trường hợp 3: Là Emoji (ký tự ngắn) -> Hiện Emoji cũ của bạn
    // (Đây là chỗ sửa lỗi "ô vuông": nếu bạn dùng emoji trong DB, nó sẽ hiện ra lại)
    if (iconStr.length < 5) { 
        return <span className="text-2xl leading-none">{iconStr}</span>;
    }

    // Trường hợp 4: Là từ khóa -> Map sang Vector Icon
    const key = iconStr.toLowerCase();
    const props = { className: "w-6 h-6 text-slate-600" };

    if (key.includes('phone') || key.includes('điện thoại')) return <Smartphone {...props} />;
    if (key.includes('car') || key.includes('xe')) return <Car {...props} />;
    if (key.includes('home') || key.includes('nhà')) return <Home {...props} />;
    if (key.includes('shirt') || key.includes('thời trang')) return <Shirt {...props} />;
    if (key.includes('job') || key.includes('việc')) return <Briefcase {...props} />;
    if (key.includes('pet') || key.includes('thú')) return <Dog {...props} />;
    if (key.includes('baby') || key.includes('mẹ')) return <Baby {...props} />;
    if (key.includes('food') || key.includes('ăn')) return <Utensils {...props} />;
    if (key.includes('tech') || key.includes('tử')) return <Monitor {...props} />;
    if (key.includes('service') || key.includes('vụ')) return <Wrench {...props} />;

    // Mặc định nếu không khớp gì cả
    return <LayoutGrid {...props} />;
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) return alert("Trình duyệt không hỗ trợ.");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
            const info = await getLocationFromCoords(pos.coords.latitude, pos.coords.longitude);
            setCurrentLocation(info.city);
            navigate(`/?location=${encodeURIComponent(info.city)}`);
        } catch { alert("Lỗi vị trí."); } 
        finally { setIsLocating(false); }
      },
      () => { setIsLocating(false); alert("Cần quyền truy cập vị trí."); }
    );
  };

  if (loading) return <div className="h-24 bg-gray-50 animate-pulse rounded-2xl mb-4 mx-2"></div>;

  return (
    <div className="bg-white border-b border-gray-100 py-2 sticky top-[4rem] z-30 shadow-sm md:static md:border-none md:shadow-none">
      <div className="max-w-screen-2xl mx-auto px-2 md:px-0">
        
        {/* THANH CUỘN NGANG (SCROLL) - KHÔNG BAO GIỜ BỊ VỠ DÒNG */}
        <div className="flex items-start gap-4 overflow-x-auto no-scrollbar px-2 py-2">
          
          {/* 1. NÚT VỊ TRÍ (ĐẦU TIÊN) */}
          <div 
            onClick={handleDetectLocation} 
            className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer group"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${currentLocation ? 'bg-green-50 border-green-200 text-green-600' : 'bg-gray-50 border-gray-100 text-gray-400 group-hover:border-green-200'}`}>
                {isLocating ? <Loader2 className="w-6 h-6 animate-spin" /> : <MapPin className="w-6 h-6" />}
            </div>
            <span className={`text-[11px] font-bold text-center line-clamp-1 max-w-[80px] ${currentLocation ? 'text-green-600' : 'text-gray-500'}`}>
                {currentLocation || 'Vị trí'}
            </span>
          </div>

          {/* 2. DANH SÁCH DANH MỤC */}
          {parents.map((cat) => {
             const isActive = window.location.pathname.includes(cat.slug);
             return (
                <div 
                  key={cat.id}
                  onClick={() => navigate(`/danh-muc/${cat.slug}`)}
                  className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer group"
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-200 
                    ${isActive 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200 scale-105' 
                        : 'bg-white border-gray-100 text-slate-600 hover:border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    {renderCategoryIcon(cat.icon)}
                  </div>
                  <span className={`text-[11px] font-bold text-center line-clamp-2 leading-tight max-w-[80px] transition-colors ${isActive ? 'text-blue-600' : 'text-slate-600'}`}>
                    {cat.name}
                  </span>
                </div>
             );
          })}

          {/* 3. NÚT TẤT CẢ (NẾU CẦN) */}
          <div className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer group opacity-60 hover:opacity-100">
             <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-dashed border-gray-300 text-gray-400 bg-gray-50 group-hover:bg-gray-100 group-hover:border-gray-400 transition-all">
                <Menu className="w-6 h-6" />
             </div>
             <span className="text-[11px] font-bold text-center text-gray-400">Tất cả</span>
          </div>

        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default CategoryBar;
