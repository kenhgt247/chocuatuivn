import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../services/db';

// ⚠️ ĐÃ LOẠI BỎ LUCIDE-REACT ĐỂ TRÁNH LỖI CRASH
// --- BỘ ICON VẼ TAY (SVG THUẦN) ---
const IconArrowRight = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const IconZap = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IconRocket = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 11.5A9.5 9.5 0 0 1 14 2c1.92 0 3.7.62 5.16 1.68l.47.36.36.47c1.06 1.46 1.68 3.24 1.68 5.16 0 9.5-9.5 14-9.5 14s-4.5-9.5-14-9.5Z"/><path d="M12 22v-6"/></svg>;
const IconFlame = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>;
const IconSparkles = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M9 5H5"/><path d="M19 15v4"/><path d="M23 17h-4"/></svg>;
const IconMegaphone = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>;
const IconGift = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>;
const IconShoppingBag = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;

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
        case '🚀': return <IconRocket {...props} />;
        case 'zap': 
        case '⚡': return <IconZap {...props} />;
        case 'fire': 
        case '🔥': return <IconFlame {...props} />;
        case 'gift': 
        case '🎁': return <IconGift {...props} />;
        case 'shop': 
        case '🛍️': return <IconShoppingBag {...props} />;
        case 'mega': 
        case '📢': return <IconMegaphone {...props} />;
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
                            <IconSparkles className="w-3 h-3 text-yellow-300" /> Chợ Của Tui
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
                                <IconArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
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
