import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../services/db';

// --- IMPORT ICON VECTOR ---
import { 
  ArrowRight, Zap, Rocket, Flame, Sparkles, Megaphone, 
  Gift, ShoppingBag 
} from 'lucide-react';

// [TỐI ƯU 4] Đưa biến tĩnh ra ngoài
const DEFAULT_SLIDES = [
  { 
    id: 1, 
    type: 'text', 
    title: "Đăng tin siêu tốc", 
    desc: "Tiếp cận hàng ngàn khách hàng tiềm năng ngay hôm nay.", 
    btnText: "Đăng ngay", 
    btnLink: "/post", 
    colorFrom: "from-blue-600", 
    colorTo: "to-indigo-600", 
    icon: "rocket" // Dùng keyword để map sang icon vector
  },
];

// Helper: Map từ keyword/emoji sang Vector Icon
const getBannerIcon = (icon: string) => {
    const props = { className: "w-40 h-40 text-white/90 drop-shadow-2xl animate-pulse" };
    
    // Chuẩn hóa input
    const key = icon?.toLowerCase().trim();

    switch (key) {
        case 'rocket': 
        case '🚀': return <Rocket {...props} />;
        case 'zap': 
        case '⚡': return <Zap {...props} />;
        case 'fire': 
        case '🔥': return <Flame {...props} />;
        case 'gift': 
        case '🎁': return <Gift {...props} />;
        case 'shop': 
        case '🛍️': return <ShoppingBag {...props} />;
        case 'mega': 
        case '📢': return <Megaphone {...props} />;
        default: return <span className="text-[8rem] filter drop-shadow-2xl cursor-default select-none">{icon || '🔥'}</span>;
    }
};

const HomeBanner = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
        try {
            const settings = await db.getSettings();
            if (settings && settings.bannerSlides) {
                const activeSlides = settings.bannerSlides.filter((s: any) => s.isActive !== false);
                setSlides(activeSlides.length > 0 ? activeSlides : DEFAULT_SLIDES);
            } else {
                setSlides(DEFAULT_SLIDES);
            }
        } catch (error) {
            console.error("Lỗi load banner:", error);
            setSlides(DEFAULT_SLIDES);
        } finally {
            setIsLoading(false);
        }
    };
    fetchSettings();
  }, []);

  // [TỐI ƯU 1] Auto slide logic
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 8000); 
    return () => clearInterval(timer);
  }, [slides.length, currentSlide]); 

  if (isLoading) return <div className="h-[220px] md:h-[280px] w-full bg-gray-100 rounded-[2.5rem] animate-pulse my-6"></div>;
  if (slides.length === 0) return null;

  const slide = slides[currentSlide];

  return (
    <div className="px-2 md:px-0 py-4">
      {/* [TỐI ƯU 2] Key để trigger animation */}
      <div 
        key={currentSlide} 
        className="relative w-full overflow-hidden rounded-[2.5rem] shadow-lg md:shadow-2xl aspect-[3/1.3] md:aspect-[3/0.8] lg:aspect-[4/1] min-h-[220px] animate-fade-in-up group"
      >
        
        {/* --- TRƯỜNG HỢP 1: BANNER ẢNH --- */}
        {slide.type === 'image' ? (
            <Link to={slide.btnLink || '#'} className="block w-full h-full relative">
                <img 
                    src={slide.imageUrl || 'https://placehold.co/1200x400?text=No+Image'} 
                    alt={slide.title || "Banner quảng cáo"} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"></div>
            </Link>
        ) : (
        
        /* --- TRƯỜNG HỢP 2: BANNER TEXT/GRADIENT (VECTOR) --- */
            <>
                <div className="absolute inset-0 transition-colors duration-1000 ease-in-out bg-gradient-to-br">
                    <div className={`absolute inset-0 bg-gradient-to-br ${slide.colorFrom || 'from-blue-600'} ${slide.colorTo || 'to-purple-600'} transition-all duration-1000`}></div>
                    
                    {/* Background decorations */}
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white/10 blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-40 h-40 rounded-full bg-black/10 blur-2xl"></div>
                </div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-6 md:p-12 gap-6 h-full">
                    <div className="flex-1 text-center md:text-left space-y-3 md:space-y-5 max-w-2xl flex flex-col justify-center h-full">
                        <div className="self-center md:self-start inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest backdrop-blur-md shadow-sm">
                            <Sparkles className="w-3 h-3 text-yellow-300" /> Chợ Của Tui
                        </div>
                        
                        <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-md tracking-tight">
                            {slide.title}
                        </h2>

                        <p className="text-white/90 text-xs md:text-lg font-medium line-clamp-2 leading-relaxed">
                            {slide.desc}
                        </p>

                        <div className="pt-2">
                            <Link to={slide.btnLink || '/'} className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-3.5 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all group/btn">
                                {slide.btnText || 'Xem ngay'}
                                <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                            </Link>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center justify-center w-1/3 transition-transform hover:scale-110 duration-500">
                        {getBannerIcon(slide.icon)}
                    </div>
                </div>
            </>
        )}

        {/* DOTS ĐIỀU HƯỚNG */}
        {slides.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                {slides.map((_, idx) => (
                    <button 
                        key={idx}
                        onClick={() => setCurrentSlide(idx)}
                        className={`h-1.5 rounded-full transition-all duration-300 shadow-sm backdrop-blur-sm ${idx === currentSlide ? 'bg-white w-8' : 'bg-white/40 w-2 hover:bg-white/70'}`}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default HomeBanner;
