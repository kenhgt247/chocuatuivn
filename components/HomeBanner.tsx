import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const HomeBanner = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 1,
      title: "Đăng tin siêu tốc, bán hàng cực bốc! 🚀",
      desc: "Tiếp cận hàng ngàn khách hàng mỗi ngày hoàn toàn miễn phí.",
      btnText: "Đăng tin ngay",
      btnLink: "/post",
      colorFrom: "from-blue-600",
      colorTo: "to-indigo-600",
      icon: "⚡"
    },
    {
      id: 2,
      title: "Nâng cấp VIP, lên đỉnh trang chủ 👑",
      desc: "Tin đăng nổi bật, huy hiệu uy tín, chốt đơn nhanh gấp 5 lần.",
      btnText: "Xem gói VIP",
      btnLink: "/profile", // Hoặc trang upgrade
      colorFrom: "from-orange-500",
      colorTo: "to-red-500",
      icon: "💎"
    },
    {
      id: 3,
      title: "Săn đồ cũ, giá hời mỗi ngày 🛍️",
      desc: "Hàng ngàn món đồ chất lượng đang chờ chủ nhân mới.",
      btnText: "Khám phá ngay",
      btnLink: "/search",
      colorFrom: "from-emerald-500",
      colorTo: "to-teal-600",
      icon: "🔥"
    }
  ];

  // Tự động chuyển slide
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000); // 5 giây đổi 1 lần
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="px-2 md:px-0 py-6 animate-fade-in-up">
      <div className="relative w-full overflow-hidden rounded-[2.5rem] shadow-xl md:shadow-2xl">
        
        {/* Background Slider */}
        <div 
          className="absolute inset-0 transition-colors duration-1000 ease-in-out bg-gradient-to-br"
          style={{ 
            backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))`,
          }} 
        >
           {/* Lớp phủ gradient động dựa trên state */}
           <div className={`absolute inset-0 bg-gradient-to-br ${slides[currentSlide].colorFrom} ${slides[currentSlide].colorTo} transition-all duration-1000`}></div>
           
           {/* Họa tiết trang trí nền (Circles) */}
           <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
           <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-40 h-40 rounded-full bg-black/10 blur-2xl"></div>
        </div>

        {/* Nội dung Banner */}
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-8 md:p-12 gap-6 min-h-[220px] md:min-h-[280px]">
          
          {/* Text Content */}
          <div className="flex-1 text-center md:text-left space-y-4 max-w-2xl">
            <span className="inline-block px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-[10px] font-black uppercase tracking-widest backdrop-blur-md animate-bounce">
               ✨ Thông báo nổi bật
            </span>
            
            <div className="overflow-hidden relative h-20 md:h-24">
                {slides.map((slide, index) => (
                    <h2 
                        key={slide.id}
                        className={`absolute top-0 left-0 w-full text-2xl md:text-4xl lg:text-5xl font-black text-white leading-tight transition-all duration-700 transform ${
                            index === currentSlide ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                        }`}
                    >
                        {slide.title}
                    </h2>
                ))}
            </div>

            <p className="text-white/90 text-sm md:text-lg font-medium max-w-lg mx-auto md:mx-0 transition-opacity duration-500">
               {slides[currentSlide].desc}
            </p>

            <div className="pt-2">
                <Link 
                    to={slides[currentSlide].btnLink}
                    className="inline-flex items-center gap-2 bg-white text-gray-900 px-8 py-3.5 rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest shadow-lg hover:bg-gray-50 hover:scale-105 active:scale-95 transition-all duration-300"
                >
                    {slides[currentSlide].btnText}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                </Link>
            </div>
          </div>

          {/* Decorative Icon bên phải */}
          <div className="hidden md:flex items-center justify-center w-1/3">
             <div className="relative w-40 h-40 flex items-center justify-center">
                <div className="absolute inset-0 bg-white/10 rounded-full blur-xl animate-pulse"></div>
                <div className="text-9xl filter drop-shadow-2xl transform hover:rotate-12 transition-transform duration-500 cursor-default select-none">
                    {slides[currentSlide].icon}
                </div>
             </div>
          </div>

        </div>

        {/* Dots điều hướng */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {slides.map((_, idx) => (
                <button 
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentSlide ? 'bg-white w-8' : 'bg-white/40 hover:bg-white/70'}`}
                />
            ))}
        </div>
      </div>
    </div>
  );
};

export default HomeBanner;
