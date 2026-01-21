import React, { useState, useEffect } from 'react';
import { Listing, User } from '../types';
import { db } from '../services/db';
import { formatPrice } from '../utils/format';

// ⚠️ ĐÃ LOẠI BỎ LUCIDE-REACT ĐỂ TRÁNH LỖI CRASH
// --- BỘ ICON VẼ TAY (SVG THUẦN) ---
const IconRefresh = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>;
const IconCheckCircle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const IconPackageX = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/><path d="m17 13 5 5m-5 0 5-5"/></svg>;
const IconDollar = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const IconX = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetListing: Listing; // Món hàng của chủ shop
  currentUser: User;      // Người đang muốn đổi
  // Hàm này sẽ trả về MÓN ĐỒ ĐƯỢC CHỌN + SỐ TIỀN BÙ
  onSubmit: (selectedItem: Listing, cashTopUp: number) => void;
}

const SwapModal: React.FC<SwapModalProps> = ({ isOpen, onClose, targetListing, currentUser, onSubmit }) => {
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [selectedItem, setSelectedItem] = useState<Listing | null>(null);
  const [cashTopUp, setCashTopUp] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  // Lấy danh sách đồ của người dùng hiện tại khi mở modal
  useEffect(() => {
    if (isOpen && currentUser) {
      setIsLoading(true);
      db.getListings().then(listings => {
        // Lọc ra những món hàng CỦA TÔI và đang được DUYỆT
        const myItems = listings.filter(l => String(l.sellerId) === String(currentUser.id) && l.status === 'approved');
        setMyListings(myItems);
        setIsLoading(false);
      });
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!selectedItem) return alert("Vui lòng chọn một món đồ của bạn để đổi!");
    
    // Validate số tiền bù (nếu cần)
    if (isNaN(cashTopUp)) {
        alert("Số tiền bù không hợp lệ.");
        return;
    }

    // Gửi cả món đồ và số tiền bù ra ngoài
    onSubmit(selectedItem, cashTopUp);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      {/* Nền đen mờ */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      {/* Hộp thoại chính */}
      <div className="bg-white w-full max-w-lg rounded-[2rem] p-6 md:p-8 shadow-2xl relative border border-gray-200 flex flex-col max-h-[90vh] animate-fade-in-up">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
            <div>
                <h3 className="text-xl font-black text-slate-900 uppercase flex items-center gap-2">
                    <IconRefresh className="w-5 h-5 text-purple-600" /> 
                    Đổi đồ lấy:
                </h3>
                <p className="text-sm font-bold text-primary truncate mt-1 max-w-[250px]">{targetListing.title}</p>
            </div>
            <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
                <IconX className="w-5 h-5 text-gray-500" />
            </button>
        </div>

        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Chọn món đồ của bạn để đổi:</p>

        {/* Danh sách đồ của tôi (Cuộn dọc) */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-3 mb-6 pr-1 scrollbar-thin scrollbar-thumb-gray-200">
          {isLoading ? (
             <div className="text-center py-10 text-gray-400 flex flex-col items-center gap-2">
                 <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                 <span className="text-xs font-bold">Đang tải kho đồ...</span>
             </div>
          ) : myListings.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center gap-3">
              <IconPackageX className="w-10 h-10 opacity-30" />
              <p className="font-medium">Bạn chưa có món nào để đổi.<br/>Hãy đăng bán sản phẩm trước nhé!</p>
            </div>
          ) : (
            myListings.map(item => (
              <div 
                key={item.id} 
                onClick={() => setSelectedItem(item)}
                className={`flex gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.98]
                    ${selectedItem?.id === item.id 
                        ? 'border-purple-500 bg-purple-50 shadow-md ring-1 ring-purple-500' 
                        : 'border-gray-100 hover:border-purple-200 bg-white'}`}
              >
                <img src={item.images[0] || 'https://placehold.co/100'} className="w-16 h-16 rounded-xl object-cover bg-gray-200 border border-gray-100" alt="" />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className={`font-bold text-sm truncate ${selectedItem?.id === item.id ? 'text-purple-700' : 'text-slate-700'}`}>{item.title}</p>
                  <p className="text-xs font-black text-primary mt-1">{formatPrice(item.price)}</p>
                </div>
                {selectedItem?.id === item.id && (
                    <div className="flex items-center pr-2">
                        <IconCheckCircle className="w-6 h-6 text-purple-600 fill-purple-100" />
                    </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Ô nhập tiền bù */}
        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 mb-6 relative group focus-within:border-purple-200 focus-within:bg-purple-50/30 transition-colors">
           <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
               <IconDollar className="w-3 h-3" /> Bù thêm tiền (Tùy chọn)
           </label>
           <div className="relative">
             <input 
               type="number" 
               value={cashTopUp || ''} 
               onChange={(e) => setCashTopUp(Number(e.target.value))}
               placeholder="Nhập số tiền (VNĐ)..." 
               className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-12 font-black text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 transition-all shadow-sm"
             />
             <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">VNĐ</span>
           </div>
           <p className="text-[9px] text-gray-400 mt-2 font-medium ml-1">
               * Nhập số dương (+) nếu bạn muốn bù tiền. Nhập số âm (-) nếu bạn muốn nhận lại tiền.
           </p>
        </div>

        {/* Nút bấm */}
        <div className="flex gap-3 pt-2">
           <button 
                onClick={onClose} 
                className="flex-1 py-4 rounded-xl font-bold text-xs uppercase bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
                Hủy bỏ
            </button>
           <button 
                onClick={handleSubmit} 
                disabled={!selectedItem}
                className={`flex-1 py-4 rounded-xl font-black text-xs uppercase text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2
                    ${!selectedItem 
                        ? 'bg-gray-300 cursor-not-allowed shadow-none' 
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-purple-200'}`}
            >
                <IconRefresh className="w-4 h-4" /> Gửi đề nghị
            </button>
        </div>

      </div>
    </div>
  );
};

export default SwapModal;
