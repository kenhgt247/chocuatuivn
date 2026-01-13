import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../services/db";
import { Category } from "../types";
import { getLocationFromCoords } from "../utils/locationHelper";

const CategoryBar: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // --- STATE ---
  const [selectedMobileParent, setSelectedMobileParent] = useState<Category | null>(null);
  const [hoveredParentId, setHoveredParentId] = useState<string | null>(null);
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(8); // Mặc định an toàn
  
  // Location
  const [isLocating, setIsLocating] = useState(false);
  const currentLocation = searchParams.get('location');

  // --- DATA FETCHING ---
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const data = await db.getCategories();
        if (mounted) setCategories(data || []);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, []);

  // --- DATA PROCESSING ---
  const { parents, childrenByParent } = useMemo(() => {
    const list = categories || [];
    const parentList = list
      .filter((c) => !c.parentId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const childMap: Record<string, Category[]> = {};
    parentList.forEach(p => { childMap[p.id] = []; });
    list.forEach((c) => {
      if (c.parentId && childMap[c.parentId]) {
        childMap[c.parentId].push(c);
      }
    });

    return { parents: parentList, childrenByParent: childMap };
  }, [categories]);

  // --- [QUAN TRỌNG] TÍNH TOÁN AUTO FIT CHÍNH XÁC ---
  useEffect(() => {
    const calculateVisibleItems = () => {
      if (!containerRef.current || parents.length === 0) return;
      
      const containerWidth = containerRef.current.offsetWidth;
      const PADDING_X = 32; // px-4 (16px * 2)
      
      // Kích thước các phần tử (ước lượng thực tế + gap)
      const ITEM_WIDTH = 96;       // w-20 (80px) + gap-4 (16px)
      const LOCATION_BTN_WIDTH = 110; // w-20 (80px) + border/padding/gap (~30px)
      const EXPAND_BTN_WIDTH = 80;    // w-16 (64px) + gap-4 (16px)

      // Không gian khả dụng cho danh sách icon
      const availableWidth = containerWidth - PADDING_X - LOCATION_BTN_WIDTH - EXPAND_BTN_WIDTH;
      
      // Số item tối đa nhét vừa
      const maxItems = Math.floor(availableWidth / ITEM_WIDTH);

      // Nếu số danh mục thực tế ít hơn maxItems -> Hiện hết (trừ 1 slot cho Location)
      if (parents.length <= maxItems) {
         setVisibleCount(parents.length); 
      } else {
         setVisibleCount(maxItems > 0 ? maxItems : 1); // Đảm bảo hiện ít nhất 1 cái
      }
    };

    calculateVisibleItems();
    window.addEventListener('resize', calculateVisibleItems);
    return () => window.removeEventListener('resize', calculateVisibleItems);
  }, [parents.length]);

  // --- HANDLERS ---
  const handleMobileClick = (parent: Category) => {
    if (selectedMobileParent?.id === parent.id) {
        setSelectedMobileParent(null);
        return;
    }
    const children = childrenByParent[parent.id];
    if (children && children.length > 0) {
      setSelectedMobileParent(parent);
    } else {
      navigate(`/danh-muc/${parent.slug}`);
    }
  };

  const handleChildClick = (parentSlug: string, childSlug: string) => {
    navigate(`/danh-muc/${parentSlug}/${childSlug}`);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) { alert("Trình duyệt không hỗ trợ."); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
            const info = await getLocationFromCoords(pos.coords.latitude, pos.coords.longitude);
            setIsLocating(false);
            navigate(`/?location=${encodeURIComponent(info.city)}`);
        } catch { setIsLocating(false); alert("Lỗi vị trí."); }
      },
      () => { setIsLocating(false); alert("Cần quyền truy cập vị trí."); }
    );
  };

  if (loading) return <div className="h-24 bg-gray-50 animate-pulse rounded-2xl mb-6"></div>;
  if (!parents.length) return null;

  // Logic hiển thị Desktop
  const currentParents = isDesktopExpanded ? parents : parents.slice(0, visibleCount);
  const showExpandButton = parents.length > visibleCount;

  return (
    <div className="relative mb-2 md:mb-6 z-40 bg-white shadow-sm border-b border-gray-100 md:border md:rounded-[2rem] md:mx-0 md:px-2">
      
      {/* ================= MOBILE VIEW (< 768px) ================= */}
      <div className="md:hidden flex flex-col pb-2">
        <div className="flex overflow-x-auto no-scrollbar gap-2 px-3 py-3 snap-x items-start">
          {parents.map((parent) => {
            const isActive = selectedMobileParent?.id === parent.id;
            return (
              <div 
                key={parent.id}
                onClick={() => handleMobileClick(parent)}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 w-[72px] snap-start cursor-pointer transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-80'}`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border transition-all duration-300 ${isActive ? 'bg-blue-50 border-blue-200 shadow-md scale-105' : 'bg-gray-50 border-gray-100 shadow-sm'}`}>
                  {renderIcon(parent.icon)}
                </div>
                <span className={`text-[10px] font-semibold text-center line-clamp-2 leading-tight px-1 h-6 flex items-center justify-center transition-colors ${isActive ? 'text-blue-600 font-bold' : 'text-gray-600'}`}>
                  {parent.name}
                </span>
                {isActive && <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-blue-50 mt-[-6px]"></div>}
              </div>
            );
          })}
          
          {/* Nút Định vị Mobile (Cuối list) */}
          <div onClick={handleDetectLocation} className="flex-shrink-0 flex flex-col items-center gap-1.5 w-[72px] snap-start cursor-pointer group">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border transition-all duration-300 ${currentLocation ? 'bg-green-50 border-green-200 text-green-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
               {isLocating ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : '📍'}
            </div>
            <span className={`text-[10px] font-bold text-center line-clamp-2 leading-tight px-1 h-6 flex items-center justify-center ${currentLocation ? 'text-green-600' : 'text-gray-500'}`}>
               {currentLocation || 'Gần bạn'}
            </span>
          </div>
        </div>

        {/* Hàng 2 Mobile: Danh mục Con */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${selectedMobileParent ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
           {selectedMobileParent && (
             <div className="bg-blue-50/50 border-t border-b border-blue-100 py-2">
                <div className="flex overflow-x-auto no-scrollbar gap-2 px-3 items-center">
                   <button onClick={() => navigate(`/danh-muc/${selectedMobileParent.slug}`)} className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-bold shadow-sm whitespace-nowrap active:scale-95">Tất cả</button>
                   {childrenByParent[selectedMobileParent.id]?.map(child => (
                      <button key={child.id} onClick={() => handleChildClick(selectedMobileParent.slug, child.slug)} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-100 text-gray-700 rounded-full text-[10px] font-semibold shadow-sm whitespace-nowrap active:bg-blue-50 active:text-blue-600">
                         <span>{renderIcon(child.icon)}</span><span>{child.name}</span>
                      </button>
                   ))}
                </div>
             </div>
           )}
        </div>
      </div>

      {/* ================= DESKTOP VIEW (>= 768px) ================= */}
      {/* Container Flex Row */}
      <div 
        ref={containerRef}
        className={`hidden md:flex flex-wrap items-start px-4 py-2 relative gap-4 transition-all duration-300 ${isDesktopExpanded ? 'h-auto' : 'h-24'}`}
      >
        {/* 1. DANH SÁCH DANH MỤC (Loop) */}
        {currentParents.map((parent) => (
          <div 
            key={parent.id}
            onMouseEnter={() => setHoveredParentId(parent.id)}
            onMouseLeave={() => setHoveredParentId(null)}
            className="group relative h-20 flex flex-col justify-center shrink-0"
          >
            <button 
              onClick={() => navigate(`/danh-muc/${parent.slug}`)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200 w-20 ${hoveredParentId === parent.id ? 'bg-blue-50 text-blue-600 -translate-y-1' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
            >
              <div className="text-2xl">{renderIcon(parent.icon)}</div>
              <span className="text-[11px] font-bold text-center leading-none line-clamp-1 w-full">{parent.name}</span>
            </button>

            {/* Mega Menu Popup */}
            {hoveredParentId === parent.id && childrenByParent[parent.id]?.length > 0 && (
              <div className="absolute top-[90%] left-0 w-[500px] bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-gray-100 p-5 z-[999] animate-fade-in-up">
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-50">
                  <span className="text-2xl">{renderIcon(parent.icon)}</span>
                  <span className="font-bold text-lg text-gray-900">{parent.name}</span>
                  <span className="text-xs text-blue-500 ml-auto cursor-pointer hover:underline" onClick={() => navigate(`/danh-muc/${parent.slug}`)}>Xem tất cả &rarr;</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {childrenByParent[parent.id].map(child => (
                    <div 
                      key={child.id}
                      onClick={(e) => { e.stopPropagation(); handleChildClick(parent.slug, child.slug); }}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-blue-50 cursor-pointer group/child transition-colors"
                    >
                       <span className="text-lg opacity-70 group-hover/child:opacity-100">{renderIcon(child.icon)}</span>
                       <span className="text-xs text-gray-600 font-semibold group-hover/child:text-blue-700">{child.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 2. NÚT ĐỊNH VỊ (Luôn đứng sau cùng của danh sách hiển thị) */}
        {/* Border left nét đứt để phân cách nhẹ */}
        <div className="group relative h-20 flex flex-col justify-center shrink-0 border-l-2 border-dashed border-gray-100 pl-4 ml-auto lg:ml-0">
            <button 
                onClick={handleDetectLocation}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200 w-20 ${currentLocation ? 'bg-green-50 text-green-600' : 'text-gray-400 hover:text-green-600 hover:bg-gray-50'}`}
                title="Thay đổi vị trí"
            >
                <div className="text-2xl">{isLocating ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : '📍'}</div>
                <span className={`text-[10px] font-bold text-center leading-none line-clamp-1 w-full ${currentLocation ? 'text-green-700' : ''}`}>
                    {currentLocation || 'Gần bạn'}
                </span>
            </button>
        </div>

        {/* 3. NÚT TẤT CẢ (Nếu cần expand) */}
        {showExpandButton && (
           <button 
             onClick={() => setIsDesktopExpanded(!isDesktopExpanded)}
             className="flex flex-col items-center gap-1.5 p-2 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-gray-50 transition-all w-16 h-20 justify-center shrink-0"
           >
             <div className="w-8 h-8 rounded-full border-2 border-dashed border-current flex items-center justify-center text-lg font-black mb-0.5">
               {isDesktopExpanded ? '−' : '+'}
             </div>
             <span className="text-[10px] font-bold">{isDesktopExpanded ? 'Thu gọn' : 'Tất cả'}</span>
           </button>
        )}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fade-in-up { from { opacity: 0; transform: translate(0, 10px); } to { opacity: 1; transform: translate(0, 0); } }
        .animate-fade-in-up { animation: fade-in-up 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

const renderIcon = (icon: string | undefined) => {
  if (!icon) return '📦';
  if (icon.includes('/') || icon.includes('http')) {
    return <img src={icon} alt="" className="w-full h-full object-contain drop-shadow-sm" />;
  }
  return <span>{icon}</span>;
}

export default CategoryBar;