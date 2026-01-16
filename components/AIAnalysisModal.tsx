// /components/AIAnalysisModal.tsx
import React, { useState } from 'react';
import { ListingAnalysis } from '../services/geminiService'; // Nhớ trỏ đúng đường dẫn file service
import { formatPrice } from '../utils/format'; // Hàm format tiền của bạn

interface Props {
  isOpen: boolean;
  onClose: () => void;
  aiData: ListingAnalysis | null;
  onApply: (data: ListingAnalysis, selectedPrice: number) => void;
}

const AIAnalysisModal: React.FC<Props> = ({ isOpen, onClose, aiData, onApply }) => {
  const [selectedPrice, setSelectedPrice] = useState<number>(0);

  // Reset giá chọn mỗi khi mở modal mới
  React.useEffect(() => {
    if (aiData?.pricingStrategy?.suggested) {
      setSelectedPrice(aiData.pricingStrategy.suggested);
    }
  }, [aiData]);

  if (!isOpen || !aiData) return null;

  // Tính màu sắc cho điểm chất lượng ảnh
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* HEADER: Gradient sang trọng */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-black text-xl flex items-center gap-2">
                ✨ Trợ Lý AI Phân Tích
              </h3>
              <p className="text-white/80 text-xs mt-1">Đã tìm thấy thông tin tối ưu cho sản phẩm của bạn</p>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition">✕</button>
          </div>
        </div>

        {/* BODY: Cuộn được nếu nội dung dài */}
        <div className="p-5 overflow-y-auto space-y-6">
          
          {/* 1. ĐÁNH GIÁ ẢNH (Image Audit) */}
          <div className={`p-4 rounded-xl border flex gap-4 items-start ${getScoreColor(aiData.qualityCheck.score)}`}>
            <div className="text-3xl">📸</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-black text-sm uppercase">Chất lượng ảnh</span>
                <span className="font-bold">{aiData.qualityCheck.score}/100</span>
              </div>
              <p className="text-xs font-medium opacity-90">{aiData.qualityCheck.tips || "Ảnh khá tốt, đủ tiêu chuẩn đăng tin."}</p>
            </div>
          </div>

          {/* 2. CHIẾN LƯỢC GIÁ (Pricing Strategy) - Phần quan trọng nhất */}
          <div>
            <div className="flex justify-between items-end mb-3">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Gợi ý giá bán</h4>
              <span className="text-[10px] text-gray-400">Thị trường: {aiData.pricingStrategy.min.toLocaleString()} - {aiData.pricingStrategy.max.toLocaleString()}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {/* Nút BÁN NHANH */}
              <button 
                onClick={() => setSelectedPrice(aiData.pricingStrategy.fastSell)}
                className={`p-3 border rounded-xl transition-all text-center relative ${selectedPrice === aiData.pricingStrategy.fastSell ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-gray-200 hover:border-green-300'}`}
              >
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">⚡ Đi nhanh</div>
                <div className="font-black text-green-600 text-sm">{aiData.pricingStrategy.fastSell.toLocaleString()}</div>
              </button>

              {/* Nút ĐỀ XUẤT */}
              <button 
                onClick={() => setSelectedPrice(aiData.pricingStrategy.suggested)}
                className={`p-3 border rounded-xl transition-all text-center relative ${selectedPrice === aiData.pricingStrategy.suggested ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-blue-300'}`}
              >
                 <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm">Khuyên dùng</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">👍 Hợp lý</div>
                <div className="font-black text-blue-600 text-sm">{aiData.pricingStrategy.suggested.toLocaleString()}</div>
              </button>

              {/* Nút LỜI CAO */}
              <button 
                onClick={() => setSelectedPrice(aiData.pricingStrategy.highProfit)}
                className={`p-3 border rounded-xl transition-all text-center relative ${selectedPrice === aiData.pricingStrategy.highProfit ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500' : 'border-gray-200 hover:border-purple-300'}`}
              >
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">💰 Được giá</div>
                <div className="font-black text-purple-600 text-sm">{aiData.pricingStrategy.highProfit.toLocaleString()}</div>
              </button>
            </div>
          </div>

          {/* 3. NỘI DUNG SEO */}
          <div className="space-y-3">
             <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Nội dung chuẩn SEO</h4>
             <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm space-y-2">
                <div>
                   <span className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Tiêu đề:</span>
                   <p className="font-bold text-gray-800">{aiData.title}</p>
                </div>
                <div className="border-t border-gray-200 pt-2">
                   <span className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Mô tả:</span>
                   <p className="text-gray-600 line-clamp-4 text-xs leading-relaxed whitespace-pre-line">{aiData.description}</p>
                </div>
             </div>
          </div>

          {/* 4. ĐIỂM MẠNH SẢN PHẨM */}
          {aiData.keySellingPoints && aiData.keySellingPoints.length > 0 && (
             <div className="flex flex-wrap gap-2">
                {aiData.keySellingPoints.map((point, idx) => (
                   <span key={idx} className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-lg">✓ {point}</span>
                ))}
             </div>
          )}

        </div>

        {/* FOOTER: Nút bấm */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition text-sm">
            Bỏ qua
          </button>
          <button 
            onClick={() => onApply(aiData, selectedPrice)}
            className="flex-[2] py-3 px-4 rounded-xl font-bold text-white bg-blue-600 shadow-lg shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
          >
            <span>✨ Áp dụng ngay</span>
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{selectedPrice.toLocaleString()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAnalysisModal;
