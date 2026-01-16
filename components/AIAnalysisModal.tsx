import React, { useState, useEffect } from 'react';
import { ListingAnalysis } from '../services/geminiService'; // Chỉnh đường dẫn nếu cần

interface Props {
  isOpen: boolean;
  onClose: () => void;
  aiData: ListingAnalysis | null;
  onApply: (data: ListingAnalysis, selectedPrice: number) => void;
}

const AIAnalysisModal: React.FC<Props> = ({ isOpen, onClose, aiData, onApply }) => {
  const [selectedPrice, setSelectedPrice] = useState<number>(0);

  useEffect(() => {
    // Ưu tiên lấy giá "Khuyên dùng"
    if (aiData?.pricingStrategy?.suggested) {
      setSelectedPrice(aiData.pricingStrategy.suggested);
    }
  }, [aiData]);

  if (!isOpen || !aiData) return null;

  const formatVND = (price: number) => {
    if (!price || price === 0) return "Tự nhập giá";
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  // Safe access data
  const pricing = aiData.pricingStrategy || { min: 0, max: 0, fastSell: 0, suggested: 0, highProfit: 0, marketAnalysis: '' };
  const quality = aiData.qualityCheck || { score: 50, tips: 'Cần chụp rõ hơn', issues: [] };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    // Lớp nền đen mờ - z-index cao nhất
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      
      {/* Container chính - Chiếm 100% màn hình mobile ở dưới, hoặc max-w-lg ở giữa trên PC */}
      <div className="bg-white w-full md:w-[500px] md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* HEADER: Gradient & Nút đóng */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 shrink-0 flex justify-between items-start relative">
          <div className="text-white">
            <h3 className="font-black text-lg md:text-xl flex items-center gap-2">
              ✨ Trợ Lý AI Phân Tích
            </h3>
            <p className="text-white/80 text-xs mt-1 line-clamp-1">Đã tối ưu thông tin cho: {aiData.title}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-full text-white hover:bg-white/30 transition backdrop-blur-md"
          >
            ✕
          </button>
        </div>

        {/* BODY: Cho phép cuộn dọc (Scroll) */}
        <div className="p-4 overflow-y-auto flex-1 space-y-5 bg-gray-50/50">
          
          {/* 1. CHẤT LƯỢNG ẢNH */}
          <div className={`p-4 rounded-2xl border flex gap-4 items-start ${getScoreColor(quality.score)}`}>
            <div className="text-3xl bg-white p-2 rounded-full shadow-sm">📸</div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-black text-xs uppercase tracking-wider">Chất lượng ảnh</span>
                <span className="font-black text-lg">{quality.score}/100</span>
              </div>
              <p className="text-sm font-bold opacity-90 mb-1">
                {quality.score >= 80 ? "Ảnh rất đẹp! 😍" : quality.score >= 50 ? "Ảnh tạm ổn 🤔" : "Ảnh hơi tệ 😞"}
              </p>
              <p className="text-xs opacity-80 leading-relaxed">{quality.tips}</p>
            </div>
          </div>

          {/* 2. GỢI Ý GIÁ BÁN (QUAN TRỌNG) */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                💰 Chiến lược giá
              </h4>
              {pricing.min > 0 && (
                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                  Thị trường: {formatVND(pricing.min)} - {formatVND(pricing.max)}
                </span>
              )}
            </div>
            
            {/* Grid: 1 cột trên mobile, 3 cột trên PC */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {/* Nút BÁN NHANH */}
              <button 
                onClick={() => setSelectedPrice(pricing.fastSell)} 
                className={`p-3 rounded-xl border-2 text-left md:text-center transition-all flex md:block items-center justify-between group ${selectedPrice === pricing.fastSell ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-white hover:border-green-200'}`}
              >
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">⚡ Đi nhanh</div>
                  <div className="font-black text-green-600 text-sm md:text-xs">{formatVND(pricing.fastSell)}</div>
                </div>
                {/* Check icon cho mobile */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center md:hidden ${selectedPrice === pricing.fastSell ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'}`}>✓</div>
              </button>

              {/* Nút ĐỀ XUẤT */}
              <button 
                onClick={() => setSelectedPrice(pricing.suggested)} 
                className={`p-3 rounded-xl border-2 text-left md:text-center transition-all flex md:block items-center justify-between relative overflow-hidden ${selectedPrice === pricing.suggested ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-blue-200'}`}
              >
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg">HOT</div>
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">👍 Hợp lý</div>
                  <div className="font-black text-blue-600 text-sm md:text-xs">{formatVND(pricing.suggested)}</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center md:hidden ${selectedPrice === pricing.suggested ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300'}`}>✓</div>
              </button>

              {/* Nút LỜI CAO */}
              <button 
                onClick={() => setSelectedPrice(pricing.highProfit)} 
                className={`p-3 rounded-xl border-2 text-left md:text-center transition-all flex md:block items-center justify-between ${selectedPrice === pricing.highProfit ? 'border-purple-500 bg-purple-50' : 'border-gray-100 bg-white hover:border-purple-200'}`}
              >
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">💰 Được giá</div>
                  <div className="font-black text-purple-600 text-sm md:text-xs">{formatVND(pricing.highProfit)}</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center md:hidden ${selectedPrice === pricing.highProfit ? 'border-purple-500 bg-purple-500 text-white' : 'border-gray-300'}`}>✓</div>
              </button>
            </div>
          </div>

          {/* 3. NỘI DUNG SEO */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
             <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">📝 Nội dung chuẩn SEO</h4>
             <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                <div>
                   <span className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Tiêu đề:</span>
                   <p className="font-bold text-gray-800 text-sm">{aiData.title || "Chưa có tiêu đề"}</p>
                </div>
                <div className="border-t border-gray-200 pt-2">
                   <span className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Mô tả:</span>
                   <p className="text-gray-600 text-xs leading-relaxed whitespace-pre-line line-clamp-4">{aiData.description || "Chưa có mô tả"}</p>
                </div>
             </div>
             
             {/* Hashtags */}
             {aiData.seoTags && aiData.seoTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {aiData.seoTags.map((tag, i) => (
                    <span key={i} className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded-md font-medium">#{tag}</span>
                  ))}
                </div>
             )}
          </div>
        </div>

        {/* FOOTER: Fixed ở dưới cùng */}
        <div className="p-4 border-t border-gray-100 bg-white flex gap-3 shrink-0 pb-8 md:pb-4">
          <button onClick={onClose} className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition text-sm">
            Bỏ qua
          </button>
          <button 
            onClick={() => onApply(aiData, selectedPrice)} 
            className="flex-[2] py-3 px-4 rounded-xl font-bold text-white bg-blue-600 shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
          >
            <span>🚀 Áp dụng ngay</span>
            {selectedPrice > 0 && <span className="bg-white/20 px-2 py-0.5 rounded text-xs hidden md:inline">{formatVND(selectedPrice)}</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAnalysisModal;
