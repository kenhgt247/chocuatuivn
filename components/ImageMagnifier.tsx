import React, { useState, MouseEvent } from 'react';

interface ImageMagnifierProps {
  src: string;
  width?: string | number;
  height?: string | number;
  magnifierHeight?: number;
  magnifieWidth?: number;
  zoomLevel?: number;
  className?: string;
  alt?: string;
}

const ImageMagnifier: React.FC<ImageMagnifierProps> = ({
  src,
  width = '100%',
  height = '100%',
  magnifierHeight = 150,
  magnifieWidth = 150,
  zoomLevel = 2.5, // Độ phóng đại (2.5 lần)
  className = "",
  alt = ""
}) => {
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [[x, y], setXY] = useState([0, 0]);
  const [[imgWidth, imgHeight], setSize] = useState([0, 0]);

  const handleMouseEnter = (e: MouseEvent<HTMLImageElement>) => {
    const elem = e.currentTarget;
    const { width, height } = elem.getBoundingClientRect();
    setSize([width, height]);
    setShowMagnifier(true);
  };

  const handleMouseMove = (e: MouseEvent<HTMLImageElement>) => {
    const elem = e.currentTarget;
    const { top, left } = elem.getBoundingClientRect();

    // Tính toán vị trí con trỏ so với ảnh
    const x = e.pageX - left - window.scrollX;
    const y = e.pageY - top - window.scrollY;
    setXY([x, y]);
  };

  const handleMouseLeave = () => {
    setShowMagnifier(false);
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      style={{ width, height }}
    >
      <img
        src={src}
        className="w-full h-full object-contain"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        alt={alt}
      />

      {showMagnifier && (
        <div
          style={{
            display: "block",
            position: "absolute",
            pointerEvents: "none",
            height: `${magnifierHeight}px`,
            width: `${magnifieWidth}px`,
            // Di chuyển kính lúp theo con trỏ chuột (căn giữa)
            top: `${y - magnifierHeight / 2}px`,
            left: `${x - magnifieWidth / 2}px`,
            opacity: "1",
            border: "1px solid lightgray",
            backgroundColor: "white",
            backgroundImage: `url('${src}')`,
            backgroundRepeat: "no-repeat",
            // Tính toán vị trí ảnh nền để khớp với vị trí zoom
            backgroundSize: `${imgWidth * zoomLevel}px ${imgHeight * zoomLevel}px`,
            backgroundPositionX: `${-x * zoomLevel + magnifieWidth / 2}px`,
            backgroundPositionY: `${-y * zoomLevel + magnifierHeight / 2}px`,
            borderRadius: "50%", // Bo tròn thành hình kính lúp
            boxShadow: "0 0 10px rgba(0,0,0,0.25)",
            zIndex: 50 // Nổi lên trên cùng
          }}
        />
      )}
    </div>
  );
};

export default ImageMagnifier;
