import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../services/db";
import { Category } from "../types";
import { getLocationFromCoords } from "../utils/locationHelper";

// --- IMPORT ICON VECTOR ---
import { 
  Menu, MapPin, ChevronDown, ChevronRight, Loader2,
  Smartphone, Shirt, Home, Car, Briefcase, Wrench, 
  Dog, Baby, MoreHorizontal, Package, Monitor, Utensils,
  Zap, Heart, LayoutGrid
} from 'lucide-react';

// Hàm Helper: Map icon từ DB (tên hoặc emoji) sang Lucide Icon
const getCategoryIcon = (iconStr: string | undefined, className: string = "w-6 h-6") => {
    // 1. Nếu là Link ảnh (URL) -> Giữ nguyên ảnh
    if (iconStr && (iconStr.includes('/') || iconStr.includes('http'))) {
        return <img src={iconStr} alt="" className={`${className} object-contain drop-shadow-sm`} />;
    }

    // 2. Map từ khóa sang Icon Vector
    const key = iconStr?.toLowerCase().trim() || '';
    const props = { className };

    if (key.includes('điện') || key.includes('phone') || key.includes('laptop')) return <Smartphone {...props} />;
    if (key.includes('xe') || key.includes('oto') || key.includes('car')) return <Car {...props} />;
    if (key.includes('nhà') || key.includes('đất') || key.includes('home')) return <Home {...props} />;
    if (key.includes('thời trang') || key.includes('áo') || key.includes('shirt')) return <Shirt {...props} />;
    if (key.includes('việc') || key.includes('job')) return <Briefcase {...props} />;
    if (key.includes('dịch vụ') || key.includes('service')) return <Wrench {...props} />;
    if (key.includes('thú') || key.includes('pet') || key.includes('dog')) return <Dog {...props} />;
    if (key.includes('bé') || key.includes('baby') || key.includes('mẹ')) return <Baby {...props} />;
    if (key.includes('ăn') || key.includes('food')) return <Utensils {...props} />;
    if (key.includes('điện tử') || key.includes('tech')) return <Monitor {...props} />;
    
    // Mặc định
    return <LayoutGrid {...props} />;
};

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
  const [visibleCount, setVisibleCount] = useState(8); 
  
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

  // --- DESKTOP AUTO FIT ---
  useEffect(() => {
    const calculateVisibleItems = () => {
      if (!containerRef.current || parents.length === 0) return;
      
      const containerWidth = containerRef.current.offsetWidth;
      const PADDING_X = 32; 
      const ITEM_WIDTH = 100; // Tăng nhẹ kích thước item
      const LOCATION_BTN_WIDTH = 110; 
      const EXPAND_BTN_WIDTH = 80;    

      const availableWidth = containerWidth - PADDING_X - LOCATION_BTN_WIDTH - EXPAND_BTN_WIDTH;
      const maxItems = Math.floor(availableWidth / ITEM_WIDTH);

      if (parents.length <= maxItems) {
         setVisibleCount(parents.length); 
      } else {
         setVisibleCount(maxItems > 0 ? maxItems : 1);
      }
    };

    calculateVisibleItems();
    window.addEventListener('resize', calculateVisibleItems);
    return () => window.removeEventListener('resize', calculateVisibleItems);
  }, [parents.length]);

  // --- HANDLERS ---
  const handleMobileClick = (parent: Category) => {
    navigate(`/danh-muc/${parent.slug}`);
    if (selectedMobileParent?.id === parent.id) {
        setSelectedMobileParent(null); 
    } else {
        const children = childrenByParent[parent.id];
        if (children && children.length > 0) {
            setSelectedMobileParent(parent);
        } else {
            setSelectedMobileParent(null);
        }
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

  const currentParents = isDesktopExpanded ? parents : parents.slice(0, visibleCount);
  const showExpandButton = parents.length > visibleCount;

  return (
    <div className="relative mb-2 md:mb-6 z-40 bg-white shadow-sm border-b border-gray-100 md:border md:rounded-[2rem] md:mx-0 md:px-2 md:shadow-sm">
      
      {/* ================= MOBILE VIEW ================= */}
      <div className="md:hidden flex flex-col pb-2">
        <div className="flex overflow-x-auto no-scrollbar gap-2 px-3 py-3 snap-x items-start">
          {parents.map((parent) => {
            const isActive = selectedMobileParent?.id === parent.id || window.location.pathname.includes(parent.slug);
            
            return (
              <div 
                key={parent.id}
                onClick={() => handleMobileClick(parent)}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 w-[72px] snap-start cursor-pointer transition-all duration-300 group`}
              >
                <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105' : 'bg-gray-50 text-gray-500 border border-gray-100 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                  {getCategoryIcon(parent.icon, "w-6 h-6")}
                </div>
                <span className={`text-[10px] font-bold text-center line-clamp-2 leading-tight px-1 h-6 flex items-center justify-center transition-colors ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                  {parent.name}
                </span>
                {selectedMobileParent?.id === parent.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-[-4px]"></div>}
              </div>
            );
          })}
          
          {/* Nút Vị trí Mobile */}
          <div onClick={handleDetectLocation} className="flex-shrink-0 flex flex-col items-center gap-1.5 w-[72px] snap-start cursor-pointer group">
            <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center transition-all duration-300 ${currentLocation ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>
               {isLocating ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-6 h-6" />}
            </div>
            <span className={`text-[10px] font-bold text-center line-clamp-2 leading-tight px-1 h-6 flex items-center justify-center ${currentLocation ? 'text-green-600' : 'text-slate-400'}`}>
               {currentLocation || 'Gần bạn'}
            </span>
          </div>
        </div>

        {/* Hàng 2 Mobile: Danh mục Con */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out bg-slate-50/80 border-t border-slate-100 ${selectedMobileParent ? 'max-h-32 opacity-100 py-3' : 'max-h-0 opacity-0 py-0'}`}>
           {selectedMobileParent && (
             <div className="flex overflow-x-auto no-scrollbar gap-2 px-3 items-center">
                <button onClick={() => navigate(`/danh-muc/${selectedMobileParent.slug}`)} className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold shadow-md shadow-blue-200 whitespace-nowrap active:scale-95 transition-transform">
                  Xem tất cả <ChevronRight className="w-3 h-3" />
                </button>
                {childrenByParent[selectedMobileParent.id]?.map(child => (
                   <button key={child.id} onClick={() => handleChildClick(selectedMobileParent.slug, child.slug)} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-slate-700 rounded-xl text-[10px] font-bold shadow-sm whitespace-nowrap active:scale-95 transition-all">
                      {/* Icon con nhỏ hơn */}
                      {getCategoryIcon(child.icon, "w-3 h-3 opacity-70")}
                      <span>{child.name}</span>
                   </button>
                ))}
             </div>
           )}
        </div>
      </div>

      {/* ================= DESKTOP VIEW ================= */}
      <div 
        ref={containerRef}
        className={`hidden md:flex flex-wrap items-start px-4 py-3 relative gap-2 transition-all duration-300 ${isDesktopExpanded ? 'h-auto' : 'h-24'}`}
      >
        {currentParents.map((parent) => (
          <div 
            key={parent.id}
            onMouseEnter={() => setHoveredParentId(parent.id)}
            onMouseLeave={() => setHoveredParentId(null)}
            className="group relative h-20 flex flex-col justify-center shrink-0"
          >
            <button 
              onClick={() => navigate(`/danh-muc/${parent.slug}`)}
              className={`flex flex-col items-center gap-2 p-2 rounded-2xl transition-all duration-200 w-24 h-20 justify-center 
                ${hoveredParentId === parent.id || window.location.pathname.includes(parent.slug) 
                    ? 'bg-blue-50 text-blue-600 shadow-inner' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-gray-50'}`}
            >
              <div className={`transition-transform duration-300 ${hoveredParentId === parent.id ? 'scale-110' : ''}`}>
                  {getCategoryIcon(parent.icon, "w-7 h-7")}
              </div>
              <span className="text-[11px] font-bold text-center leading-none line-clamp-1 w-full">{parent.name}</span>
            </button>

            {/* Mega Menu */}
            {hoveredParentId === parent.id && childrenByParent[parent.id]?.length > 0 && (
              <div className="absolute top-[90%] left-0 w-[600px] bg-white rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-gray-100 p-6 z-[999] animate-fade-in-up ring-1 ring-black/5">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-50">
                  <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                      {getCategoryIcon(parent.icon, "w-6 h-6")}
                  </div>
                  <span className="font-black text-lg text-slate-800 uppercase tracking-wide">{parent.name}</span>
                  <span className="text-xs font-bold text-blue-500 ml-auto cursor-pointer hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1" onClick={() => navigate(`/danh-muc/${parent.slug}`)}>
                      Xem tất cả <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {childrenByParent[parent.id].map(child => (
                    <div 
                      key={child.id}
                      onClick={(e) => { e.stopPropagation(); handleChildClick(parent.slug, child.slug); }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer group/child transition-all border border-transparent hover:border-gray-100"
                    >
                        <div className="text-slate-400 group-hover/child:text-blue-500 transition-colors">
                            {getCategoryIcon(child.icon, "w-5 h-5")}
                        </div>
                        <span className="text-xs text-slate-600 font-bold group-hover/child:text-slate-900">{child.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Nút Location Desktop */}
        <div className="group relative h-20 flex flex-col justify-center shrink-0 border-l border-gray-100 pl-2 ml-auto">
            <button 
                onClick={handleDetectLocation}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all duration-200 w-24 h-full justify-center 
                    ${currentLocation ? 'text-green-600 bg-green-50 shadow-inner' : 'text-slate-400 hover:text-green-600 hover:bg-green-50/50'}`}
            >
                {isLocating ? <Loader2 className="w-6 h-6 animate-spin" /> : <MapPin className="w-6 h-6" />}
                <span className={`text-[10px] font-bold text-center leading-none line-clamp-1 w-full ${currentLocation ? 'text-green-700' : ''}`}>
                    {currentLocation || 'Gần bạn'}
                </span>
            </button>
        </div>

        {/* Nút Expand Desktop */}
        {showExpandButton && (
           <button 
             onClick={() => setIsDesktopExpanded(!isDesktopExpanded)}
             className="flex flex-col items-center gap-1.5 p-2 rounded-2xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all w-20 h-20 justify-center shrink-0"
           >
             <div className="w-8 h-8 rounded-full border-2 border-dashed border-current flex items-center justify-center transition-transform hover:rotate-180">
               {isDesktopExpanded ? <ChevronDown className="w-5 h-5 rotate-180" /> : <Menu className="w-4 h-4" />}
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

export default CategoryBar;
