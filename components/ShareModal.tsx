import React, { useState } from 'react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, url, title }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Đảm bảo url bắt đầu bằng origin nếu url truyền vào chỉ là path
  const fullUrl = url.startsWith('http') ? url : window.location.origin + url;

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const shareLinks = [
    {
      name: 'Facebook',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg',
      link: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`,
      color: 'bg-[#1877F2]'
    },
    {
      name: 'X',
      // Sử dụng logo X mới nhất (SVG)
      icon: 'https://upload.wikimedia.org/wikipedia/commons/5/53/X_logo_2023_original.svg',
      link: `https://x.com/intent/tweet?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(title)}`,
      color: 'bg-black'
    },
    {
      name: 'Zalo',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg',
      link: `https://sp.zalo.me/share/base?url=${encodeURIComponent(fullUrl)}`,
      color: 'bg-[#0068FF]'
    }
  ];

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullUrl)}`;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative animate-fade-in-up border border-borderMain">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black text-textMain">Chia sẻ tin đăng</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Lan tỏa sản phẩm của bạn</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-8">
          {/* QR Code Section */}
          <div className="flex flex-col items-center gap-4 bg-gray-50 p-6 rounded-[2.5rem] border border-gray-100">
            <div className="w-40 h-40 bg-white p-2 rounded-2xl shadow-inner border-2 border-white">
              <img src={qrCodeUrl} alt="QR Code" className="w-full h-full object-contain" />
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Quét mã để xem trên điện thoại</p>
          </div>

          {/* Social Links */}
          <div className="grid grid-cols-3 gap-4">
            {shareLinks.map((social) => (
              <a
                key={social.name}
                href={social.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 group"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1 ${social.color}`}>
                  <img 
                    src={social.icon} 
                    alt={social.name} 
                    className={`w-7 h-7 object-contain brightness-0 invert ${social.name === 'X' ? 'p-0.5' : ''}`} 
                  />
                </div>
                <span className="text-[10px] font-black text-gray-500 uppercase">{social.name}</span>
              </a>
            ))}
          </div>

          {/* Copy Link Section */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[10px] font-bold text-gray-400 truncate flex items-center">
                {fullUrl}
              </div>
              <button
                onClick={handleCopy}
                className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                  copySuccess 
                    ? 'bg-green-500 text-white' 
                    : 'bg-black text-white shadow-lg hover:bg-gray-800 active:scale-95'
                }`}
              >
                {copySuccess ? 'Xong ✓' : 'Sao chép'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
