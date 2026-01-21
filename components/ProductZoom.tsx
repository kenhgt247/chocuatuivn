import React, { useState, MouseEvent, useRef, useEffect } from 'react';

interface ProductZoomProps {
  src: string;
  alt?: string;
}

const ProductZoom: React.FC<ProductZoomProps> = ({ src, alt = "" }) => {
  const [showZoom, setShowZoom] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  // Cấu hình độ phóng đại
  const zoomLevel = 2.5; // Phóng to 2.5 lần

  // Cập nhật kích thước ảnh khi load xong hoặc resize
  useEffect(() => {
    if (imgRef.current) {
        setImgSize({
            width: imgRef.current.offsetWidth,
            height: imgRef.current.offsetHeight
        });
    }
  }, [src, showZoom]);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;

    const { left, top, width, height } = imgRef.current.getBoundingClientRect();
    
    // Tính toán vị trí chuột tương đối trong khung (0 -> 100%)
    // Cần trừ đi window scroll để chính xác
    const x = ((e.pageX - left - window.scrollX) / width) * 100;
    const y = ((e.pageY - top - window.scrollY) / height) * 100;

    setPosition({ x, y });
  };

  return (
    <div 
      className="relative w-full h-full overflow-hidden bg-white"
      onMouseEnter={() => setShowZoom(true)}
      onMouseLeave={() => setShowZoom(false)}
      onMouseMove={handleMouseMove}
      style={{ cursor: 'zoom-in' }} // Con trỏ hình kính lúp
    >
      {/* 1. Ảnh gốc (Luôn hiển thị) */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="w-full h-full object-contain pointer-events-none" // QUAN TRỌNG: pointer-events-none để click xuyên qua
      />

      {/* 2. Lớp Phóng To (Hiện đè lên ảnh gốc khi hover - Kiểu Inner Zoom) */}
      {/* Cách này gọn gàng hơn, không bị vỡ layout khi hiện khung bên cạnh */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-200 ease-out z-10 ${
          showZoom ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          backgroundImage: `url(${src})`,
          backgroundPosition: `${position.x}% ${position.y}%`,
          backgroundSize: `${zoomLevel * 100}%`, // Phóng to ảnh nền
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#fff' // Nền trắng để che ảnh gốc bên dưới
        }}
      />
    </div>
  );
};

export default ProductZoom;
