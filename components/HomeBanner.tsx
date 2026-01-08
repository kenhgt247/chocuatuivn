import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../services/db';

const HomeBanner = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
        try {
            const settings = await db.getSettings();
            if (settings && settings.bannerSlides) {
                // Lọc những slide đang active
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

  const DEFAULT_SLIDES = [
    { id: 1, type: 'text', title: "Đăng tin siêu tốc 🚀", desc: "Tiếp cận hàng ngàn khách hàng.", btnText: "Đăng ngay", btnLink: "/post", colorFrom: "from-blue-600", colorTo: "to-indigo-600", icon: "⚡" },
  ];

  // Auto slide logic
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (isLoading) return <div className="h-[220px] md:h-[280px] w-full bg-gray-100 rounded-[2.5rem] animate-pulse my-6"></div>;
  if (slides.length === 0) return null; // Không có banner nào thì ẩn luôn

  const slide = slides[currentSlide];

  return (
    <div className="px-2 md:px-0 py-4 animate-fade-in-up">
      <div className="relative w-full overflow-hidden rounded-[2.5rem] shadow-lg md:shadow-2xl aspect-[3/1.2] md:aspect-[3/0.8] lg:aspect-[4/1] min-h-[200px]">
        
        {/* --- TRƯỜNG HỢP 1: BANNER ẢNH --- */}
        {slide.type === 'image' ? (
            <Link to={slide.btnLink || '#'} className="block w-full h-full relative group">
                <img 
                    src={slide.imageUrl || 'https://placehold.co/1200x400?text=No+Image'} 
                    alt="Banner" 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                {/* Lớp phủ nhẹ để dots dễ nhìn hơn */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
            </Link>
        ) : (
        
        /* --- TRƯỜNG HỢP 2: BANNER TEXT/GRADIENT (Code cũ) --- */
            <>
                <div className="absolute inset-0 transition-colors duration-1000 ease-in-out bg-gradient-to-br">
                    <div className={`absolute inset-0 bg-gradient-to-br ${slide.colorFrom || 'from-blue-500'} ${slide.colorTo || 'to-purple-500'} transition-all duration-1000`}></div>
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-40 h-40 rounded-full bg-black/10 blur-2xl"></div>
                </div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-6 md:p-12 gap-4 h-full">
                    <div className="flex-1 text-center md:text-left space-y-2 md:space-y-4 max-w-2xl flex flex-col justify-center h-full">
                        <span className="inline-block px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-[8px] md:text-[10px] font-black uppercase tracking-widest backdrop-blur-md self-center md:self-start">
                        ✨ Thông báo
                        </span>
                        
                        <h2 className="text-xl md:text-4xl lg:text-5xl font-black text-white leading-tight">
                            {slide.title}
                        </h2>

                        <p className="text-white/90 text-xs md:text-lg font-medium line-clamp-2">
                            {slide.desc}
                        </p>

                        <div className="pt-2">
                            <Link to={slide.btnLink || '/'} className="inline-flex items-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-lg hover:bg-gray-50 hover:scale-105 active:scale-95 transition-all">
                                {slide.btnText || 'Xem ngay'}
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                            </Link>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center justify-center w-1/3">
                        <div className="text-[8rem] filter drop-shadow-2xl animate-pulse cursor-default select-none">
                            {slide.icon || '🔥'}
                        </div>
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
                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'bg-white w-6' : 'bg-white/40 w-1.5 hover:bg-white/70'}`}
                    />
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default HomeBanner;
