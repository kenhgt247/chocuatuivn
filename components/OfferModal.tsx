import React, { useState, useEffect } from 'react';
import { formatPrice } from '../utils/format';

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (price: number) => void;
  originalPrice: number;
  productName: string;
}

const OfferModal: React.FC<OfferModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  originalPrice, 
  productName 
}) => {
  const [priceStr, setPriceStr] = useState<string>("");
  const [warning, setWarning] = useState<string | null>(null);

  // Reset state mỗi khi mở modal
  useEffect(() => {
    if (isOpen) {
      setPriceStr("");
      setWarning(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Xử lý khi nhập tiền
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Chỉ lấy số
    const rawValue = e.target.value.replace(/\D/g, '');
    
    if (!rawValue) {
      setPriceStr("");
      setWarning(null);
      return;
    }

    const numValue = parseInt(rawValue, 10);
    setPriceStr(numValue.toLocaleString('vi-VN'));

    // Logic cảnh báo UX vui vẻ
    if (numValue > originalPrice) {
      setWarning("🤔 Bạn trả cao hơn giá gốc luôn hả? Đại gia quá!");
    } else if (numValue === originalPrice) {
      setWarning("😅 Giá này bằng giá gốc rồi, bấm 'Mua ngay' cho lẹ!");
    } else if (numValue < originalPrice * 0.5) {
      setWarning("⚠️ Trả giá sâu quá (dưới 50%) dễ bị Shop từ chối lắm nha!");
    } else {
      setWarning(null);
    }
  };

  const handleSubmit = () => {
    const numPrice = parseInt(priceStr.replace(/\./g, ''), 10);

    if (!numPrice || numPrice <= 0) {
      alert("Vui lòng nhập số tiền hợp lệ!");
      return;
    }

    if (numPrice >= originalPrice) {
        // Cho phép nhưng hỏi lại
        if(!window.confirm("Bạn đang trả giá CAO HƠN hoặc BẰNG giá gốc. Bạn có chắc muốn tiếp tục không?")) return;
    }

    onSubmit(numPrice);
    setPriceStr("");
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      {/* Backdrop mờ */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl relative z-10 animate-fade-in-up border border-gray-100">
        
        {/* Header Gradient */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-white/10" style={{backgroundImage: 'radial-gradient(circle, transparent 20%, #ffffff10 20%, #ffffff10 80%, transparent 80%, transparent)', backgroundSize: '10px 10px'}}></div>
          
          <h3 className="text-xl font-black uppercase tracking-wider relative z-10">Mặc cả giá</h3>
          <p className="text-xs font-medium opacity-90 mt-1 truncate px-4 relative z-10">
            {productName}
          </p>
          
          {/* Nút đóng X */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/10 hover:bg-black/20 rounded-full p-1 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          
          {/* Giá gốc */}
          <div className="text-center space-y-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Giá mong muốn của Shop</p>
            <p className="text-2xl font-black text-gray-400 line-through decoration-red-400 decoration-2 opacity-60">
              {formatPrice(originalPrice)}
            </p>
          </div>

          {/* Input Giá */}
          <div className="space-y-2">
            <label className="block text-center text-xs font-bold text-emerald-600 uppercase tracking-wide">
              Giá bạn muốn mua
            </label>
            <div className="relative group">
              <input 
                type="text" 
                inputMode="numeric" // Bật bàn phím số trên điện thoại
                value={priceStr}
                onChange={handleInputChange}
                placeholder="Nhập giá..." 
                className="w-full text-center text-3xl font-black text-emerald-600 border-b-2 border-gray-200 focus:border-emerald-500 outline-none py-3 bg-transparent placeholder:text-gray-200 transition-colors"
                autoFocus
              />
              <span className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs pointer-events-none">VNĐ</span>
            </div>
            
            {/* Warning Message */}
            {warning && (
               <div className="bg-orange-50 border border-orange-100 text-orange-600 text-[10px] font-bold p-3 rounded-xl text-center animate-pulse">
                 {warning}
               </div>
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-6 bg-gray-50 flex gap-3 border-t border-gray-100">
          <button 
            onClick={onClose} 
            className="flex-1 py-4 bg-white border border-gray-200 hover:bg-gray-100 text-gray-500 font-bold rounded-2xl text-xs uppercase tracking-wider transition-colors"
          >
            Đổi ý
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={!priceStr}
            className={`flex-1 py-4 text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-200 transition-all transform active:scale-95 ${!priceStr ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-emerald-300'}`}
          >
            Gửi đề nghị
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfferModal;
