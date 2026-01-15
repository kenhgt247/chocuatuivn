import React, { useState, useEffect } from 'react';
import { Listing, User } from '../types';
import { db } from '../services/db';
import { formatPrice } from '../utils/format';

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
        const myItems = listings.filter(l => l.sellerId === currentUser.id && l.status === 'approved');
        setMyListings(myItems);
        setIsLoading(false);
      });
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!selectedItem) return alert("Vui lòng chọn một món đồ của bạn để đổi!");
    // Gửi cả món đồ và số tiền bù ra ngoài
    onSubmit(selectedItem, cashTopUp);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      {/* Nền đen mờ */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Hộp thoại chính */}
      <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl relative border border-gray-200 flex flex-col max-h-[90vh]">
        
        <h3 className="text-xl font-black text-gray-900 mb-2 uppercase flex items-center gap-2">
          🔄 Đổi đồ lấy: <span className="text-primary truncate ml-1">{targetListing.title}</span>
        </h3>
        <p className="text-xs text-gray-500 mb-6">Chọn một món đồ từ kho của bạn để đề nghị trao đổi.</p>

        {/* Danh sách đồ của tôi (Cuộn dọc) */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-3 mb-4 pr-2">
          {isLoading ? (
             <div className="text-center py-4 text-gray-400">Đang tải kho đồ của bạn...</div>
          ) : myListings.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <div className="text-2xl mb-2">📦</div>
              Bạn chưa có tin đăng bán nào.<br/>Hãy đăng bán sản phẩm trước khi đổi đồ!
            </div>
          ) : (
            myListings.map(item => (
              <div 
                key={item.id} 
                onClick={() => setSelectedItem(item)}
                className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedItem?.id === item.id ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500' : 'border-gray-200 hover:border-purple-300'}`}
              >
                <img src={item.images[0]} className="w-16 h-16 rounded-lg object-cover bg-gray-200" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-800 truncate">{item.title}</p>
                  <p className="text-xs font-bold text-primary">{formatPrice(item.price)}</p>
                </div>
                {selectedItem?.id === item.id && <div className="text-purple-500 text-xl">✅</div>}
              </div>
            ))
          )}
        </div>

        {/* Ô nhập tiền bù */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
           <label className="block text-xs font-bold text-gray-500 uppercase mb-2">💰 Bạn muốn bù thêm tiền không?</label>
           <div className="relative">
             <input 
               type="number" 
               value={cashTopUp || ''} 
               onChange={(e) => setCashTopUp(Number(e.target.value))}
               placeholder="Nhập số tiền (VNĐ)..." 
               className="w-full bg-white border border-gray-200 rounded-lg p-3 font-bold text-sm focus:outline-none focus:border-primary pl-3"
             />
             <span className="absolute right-3 top-3 text-xs font-bold text-gray-400">VNĐ</span>
           </div>
           <p className="text-[10px] text-gray-400 mt-2 italic">* Nhập số dương nếu bạn bù tiền. Nhập số âm (ví dụ -100000) nếu bạn muốn chủ shop bù tiền lại cho bạn.</p>
        </div>

        {/* Nút bấm */}
        <div className="flex gap-3 pt-2">
           <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-xs uppercase bg-gray-100 text-gray-500 hover:bg-gray-200">Hủy</button>
           <button onClick={handleSubmit} className="flex-1 py-3 rounded-xl font-bold text-xs uppercase bg-purple-600 text-white shadow-lg shadow-purple-200 hover:bg-purple-700">Gửi đề nghị</button>
        </div>

      </div>
    </div>
  );
};

export default SwapModal;
