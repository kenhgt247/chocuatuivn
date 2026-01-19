import React, { useState, useEffect } from 'react';
import { Listing, User } from '../types';
import { db } from '../services/db';
import { formatPrice } from '../utils/format';

// --- IMPORT ICON VECTOR ---
import { RefreshCw, CheckCircle, PackageX, DollarSign, X } from 'lucide-react';

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
                    <RefreshCw className="w-5 h-5 text-purple-600" /> 
                    Đổi đồ lấy:
                </h3>
                <p className="text-sm font-bold text-primary truncate mt-1 max-w-[250px]">{targetListing.title}</p>
            </div>
            <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
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
              <PackageX className="w-10 h-10 opacity-30" />
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
                        <CheckCircle className="w-6 h-6 text-purple-600 fill-purple-100" />
                    </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Ô nhập tiền bù */}
        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 mb-6 relative group focus-within:border-purple-200 focus-within:bg-purple-50/30 transition-colors">
           <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
               <DollarSign className="w-3 h-3" /> Bù thêm tiền (Tùy chọn)
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
                <RefreshCw className="w-4 h-4" /> Gửi đề nghị
            </button>
        </div>

      </div>
    </div>
  );
};

export default SwapModal;
