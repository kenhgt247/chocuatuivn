import React, { useEffect, useState, useRef } from 'react';
import { db, AdZoneConfig } from '../services/db';

interface AdPlacementProps {
  zone: string;
  className?: string;
}

const AdPlacement: React.FC<AdPlacementProps> = ({ zone, className = "" }) => {
  // --- PHẦN 1: KHAI BÁO HOOK (TUYỆT ĐỐI KHÔNG ĐỂ return Ở TRÊN PHẦN NÀY) ---
  
  // Hook 1: State lưu config
  const [config, setConfig] = useState<AdZoneConfig | null>(null);
  
  // Hook 2: State kiểm soát việc hiển thị (tránh giật)
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Hook 3: Ref để thao tác DOM
  const adRef = useRef<HTMLDivElement>(null);

  // Hook 4: Effect tải dữ liệu
  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      try {
        const settings = await db.getSettings();
        if (settings && settings.adsConfig) {
          // @ts-ignore
          const zoneConfig = settings.adsConfig[zone];
          if (isMounted) {
             setConfig(zoneConfig);
             // Delay nhẹ để UI ổn định
             setTimeout(() => setIsLoaded(true), 100);
          }
        }
      } catch (error) {
        console.error("Error loading ad config", error);
      }
    };
    fetchConfig();
    return () => { isMounted = false; };
  }, [zone]);

  // Hook 5: Effect chạy script (Google Ads)
  useEffect(() => {
    // Chỉ chạy khi đã load xong và là dạng code
    if (isLoaded && config?.type === 'code' && config?.code && adRef.current) {
        try {
            const scripts = adRef.current.getElementsByTagName('script');
            Array.from(scripts).forEach(script => {
                const newScript = document.createElement('script');
                Array.from(script.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(script.innerHTML));
                script.parentNode?.replaceChild(newScript, script);
            });
        } catch (e) { console.warn("Ad script error", e); }
    }
  }, [isLoaded, config]); // Dependency array chuẩn

  // --- PHẦN 2: LOGIC RENDER (BÂY GIỜ MỚI ĐƯỢC return) ---

  // Nếu chưa có config hoặc đang tắt -> Ẩn (Return null ở đây là an toàn)
  if (!config || !config.enabled) return null;

  const containerStyle: React.CSSProperties = {
    width: config.width || '100%',
    height: config.height === 'auto' ? 'auto' : config.height,
    minHeight: config.type === 'code' ? '90px' : '0px',
    maxWidth: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0 auto',
  };

  return (
    <div className={`promo-wrapper w-full flex justify-center my-4 ${className}`}>
      <div 
        ref={adRef}
        className="relative overflow-hidden rounded-xl shadow-sm border border-gray-100 bg-white transition-all hover:shadow-md" 
        style={containerStyle}
      >
        
        {/* === TRƯỜNG HỢP 1: BANNER ẢNH (IMAGE) === */}
        {config.type === 'image' && config.image && (
            <a 
              href={config.link || '#'} 
              target="_blank" 
              rel="nofollow noreferrer"
              className="block w-full h-full relative group"
            >
              <img 
                src={config.image} 
                alt="Promotion" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <span className="absolute top-1 right-1 bg-gray-200/80 text-[8px] font-bold text-gray-500 px-1.5 py-0.5 rounded backdrop-blur-sm uppercase">Sponsor</span>
            </a>
        )}

        {/* === TRƯỜNG HỢP 2: MÃ NHÚNG (CODE) === */}
        {config.type === 'code' && config.code && (
            <div 
              dangerouslySetInnerHTML={{ __html: config.code }} 
              className="w-full h-full flex justify-center items-center overflow-hidden"
            />
        )}

        {/* === TRƯỜNG HỢP 3: VĂN BẢN (TEXT) === */}
        {config.type === 'text' && (
            <a 
              href={config.link || '#'} 
              target="_blank" 
              rel="nofollow noreferrer"
              className="flex items-center justify-between p-4 w-full h-full transition-all group relative cursor-pointer hover:brightness-95"
              style={{ 
                  // Áp dụng màu nền (Nếu không có thì dùng trắng mặc định)
                  background: config.bgColor || '#ffffff', 
                  color: config.textColor || '#1e293b' // Màu chữ mặc định là slate-800
              }}
            >
               <div className="flex-1 min-w-0 pr-4 flex flex-col justify-center">
                  <h4 
                    className="text-sm font-black uppercase tracking-wide truncate transition-colors"
                    style={{ color: config.textColor ? 'inherit' : '#1e293b' }} // Kế thừa màu nếu có
                  >
                      {config.textTitle || 'Thông báo nổi bật'}
                  </h4>
                  <p 
                    className="text-xs font-medium mt-1 line-clamp-2 leading-relaxed opacity-80" // Giảm opacity để làm dịu mắt
                    style={{ color: config.textColor ? 'inherit' : '#64748b' }}
                  >
                      {config.textDesc || 'Xem ngay ưu đãi hấp dẫn dành riêng cho bạn.'}
                  </p>
               </div>

               {/* Nút bấm: Tự động đổi màu tương phản */}
               <div 
                  className="px-4 py-2 rounded-lg text-[10px] font-black uppercase whitespace-nowrap shadow-sm transition-transform group-hover:scale-105"
                  style={{ 
                      // Nếu nền tối -> Nút trắng chữ đen. Nếu nền sáng -> Nút đen chữ trắng.
                      backgroundColor: config.bgColor ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                      color: 'inherit',
                      border: '1px solid rgba(255,255,255,0.3)'
                  }}
               >
                  {config.textBtnLabel || 'Xem ngay'}
               </div>

               {/* Label PR */}
               <span 
                  className="absolute top-0 right-0 text-[8px] px-1.5 rounded-bl-lg font-bold opacity-60"
                  style={{ 
                      backgroundColor: 'rgba(0,0,0,0.1)',
                      color: 'inherit'
                  }}
               >
                  PR
               </span>
            </a>
        )}
        {/* === TRƯỜNG HỢP RỖNG === */}
        {!config.image && !config.code && !config.textTitle && (
            <div className="flex flex-col items-center justify-center text-gray-300 p-4 w-full h-full border-2 border-dashed bg-gray-50 min-h-[100px]">
                <span className="text-xs font-bold uppercase">Vị trí: {config.name}</span>
                <span className="text-[10px]">(Đang bật nhưng chưa có nội dung)</span>
            </div>
        )}
      </div>
    </div>
  );
};

export default AdPlacement;