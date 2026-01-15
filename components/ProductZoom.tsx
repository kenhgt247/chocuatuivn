import React, { useState, MouseEvent, useRef } from 'react';

interface ProductZoomProps {
  src: string;
  alt?: string;
}

const ProductZoom: React.FC<ProductZoomProps> = ({ src, alt = "" }) => {
  const [showZoom, setShowZoom] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  // Cấu hình độ phóng đại
  const cursorSize = 100; // Kích thước ô vuông soi trên ảnh nhỏ
  const zoomSize = 400;   // Kích thước khung hiển thị ảnh to

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current || !cursorRef.current) return;

    const { left, top, width, height } = imgRef.current.getBoundingClientRect();
    
    // Tính toán vị trí chuột so với ảnh
    let x = e.pageX - left - window.scrollX;
    let y = e.pageY - top - window.scrollY;

    // Giới hạn ô vuông không chạy ra ngoài ảnh
    x = Math.max(cursorSize / 2, Math.min(x, width - cursorSize / 2));
    y = Math.max(cursorSize / 2, Math.min(y, height - cursorSize / 2));

    setPosition({ x, y });
  };

  return (
    <div 
      className="relative w-full h-full cursor-crosshair"
      onMouseEnter={() => setShowZoom(true)}
      onMouseLeave={() => setShowZoom(false)}
      onMouseMove={handleMouseMove}
    >
      {/* 1. Ảnh gốc (Thumbnail) */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="w-full h-full object-contain bg-gray-50" 
      />

      {/* 2. Ô vuông soi (Lens) - Chỉ hiện khi hover */}
      {showZoom && (
        <div
          ref={cursorRef}
          className="absolute border border-primary/50 bg-primary/20 pointer-events-none z-10"
          style={{
            width: `${cursorSize}px`,
            height: `${cursorSize}px`,
            left: `${position.x - cursorSize / 2}px`,
            top: `${position.y - cursorSize / 2}px`,
          }}
        />
      )}

      {/* 3. Khung hiển thị ảnh to (Zoom Window) */}
      {showZoom && (
        <div
          className="absolute z-50 overflow-hidden bg-white border border-gray-200 shadow-2xl rounded-xl"
          style={{
            // Vị trí khung to: Nằm bên phải ảnh gốc, cách 20px
            left: '105%', 
            top: '0',
            width: `${zoomSize}px`,
            height: `${zoomSize}px`,
            // Hiển thị ảnh phóng to
            backgroundImage: `url(${src})`,
            // Tính toán tỷ lệ zoom khớp với vị trí chuột
            backgroundPosition: `-${(position.x * (zoomSize / cursorSize)) - zoomSize / 2}px -${(position.y * (zoomSize / cursorSize)) - zoomSize / 2}px`,
            backgroundSize: `${imgRef.current?.width ? imgRef.current.width * (zoomSize / cursorSize) : 0}px ${imgRef.current?.height ? imgRef.current.height * (zoomSize / cursorSize) : 0}px`,
            backgroundRepeat: 'no-repeat'
          }}
        />
      )}
    </div>
  );
};

export default ProductZoom;
