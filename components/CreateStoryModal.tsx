import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom'; 
import { db } from '../services/db';
import { User, Listing } from '../types';

// --- ICONS SVG ---
const IconX = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconUpload = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IconImageVideo = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const IconTrash = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
const IconTag = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.94c1.88-1.1 3.23-2.9 3.75-4.94a9 9 0 1 0-7.5 0c.52 2.04 1.87 3.84 3.75 4.94z"/><path d="M12 10V4"/></svg>;
const IconCrown = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

const CreateStoryModal: React.FC<Props> = ({ isOpen, onClose, user }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  
  // State cho việc gắn thẻ sản phẩm
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LOGIC PHÂN QUYỀN VIP ---
  const tier = user.subscriptionTier || 'free';
  const canPostVideo = ['basic', 'pro'].includes(tier); // Chỉ Basic/Pro mới được đăng video
  const canTagProduct = ['basic', 'pro'].includes(tier); // Chỉ Basic/Pro mới được gắn thẻ
  const maxVideoDuration = tier === 'pro' ? 60 : 15; // Giới hạn giây

  // Lấy danh sách sản phẩm để gắn thẻ (nếu có quyền)
  useEffect(() => {
    if (isOpen && canTagProduct) {
      const fetchMyListings = async () => {
        try {
            const all = await db.getListings(true);
            const mine = all.filter(l => String(l.sellerId) === String(user.id) && l.status === 'approved');
            setMyListings(mine);
        } catch (e) {
            console.error(e);
        }
      };
      fetchMyListings();
    }
  }, [isOpen, user.id, canTagProduct]);

  if (!isOpen) return null;

  // Helper: Lấy độ dài video
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = reject;
      video.src = URL.createObjectURL(file);
    });
  };

  // Helper: Nén ảnh
  const compressImageInternal = (imageFile: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1080; 
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], imageFile.name, { type: 'image/jpeg', lastModified: Date.now() }));
            } else {
              reject(new Error("Lỗi nén ảnh"));
            }
          }, 'image/jpeg', 0.8);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
      
      // --- XỬ LÝ VIDEO ---
      if (type === 'video') {
          // 1. Check quyền
          if (!canPostVideo) {
              alert("🚫 Gói FREE chỉ được đăng ẢNH.\n👉 Vui lòng nâng cấp lên Basic/Pro để đăng Video!");
              return;
          }

          // 2. Check dung lượng
          if (selectedFile.size > 50 * 1024 * 1024) {
              return alert("Video tối đa 50MB! Vui lòng nén lại.");
          }

          // 3. Check thời lượng
          try {
              const duration = await getVideoDuration(selectedFile);
              if (duration > maxVideoDuration) {
                  return alert(`⚠️ Video quá dài! Gói ${tier.toUpperCase()} chỉ cho phép tối đa ${maxVideoDuration} giây.\n(Video của bạn: ${Math.round(duration)}s)`);
              }
          } catch (err) {
              console.warn("Không đọc được duration, bỏ qua check.");
          }

          setMediaType('video');
          setFile(selectedFile);
          setPreviewUrl(URL.createObjectURL(selectedFile));
      } 
      // --- XỬ LÝ ẢNH ---
      else {
          setMediaType('image');
          setPreviewUrl(URL.createObjectURL(selectedFile));
          
          if (selectedFile.size > 1024 * 1024) {
              setCompressing(true);
              try {
                  const compressed = await compressImageInternal(selectedFile);
                  setFile(compressed);
              } catch (err) {
                  console.error("Lỗi nén ảnh:", err);
                  setFile(selectedFile);
              } finally {
                  setCompressing(false);
              }
          } else {
              setFile(selectedFile);
          }
      }
    }
  };

  const handlePost = async () => {
    if (!file || !previewUrl) return;
    if (compressing) return alert("Đang xử lý tối ưu ảnh, vui lòng đợi giây lát...");

    setUploading(true);
    try {
      const url = await db.uploadStoryVideo(file, user.id);
      // Gửi kèm listingId nếu có
      await db.createStory(user, url, mediaType, selectedListingId);
      
      alert(tier === 'pro' ? "🎉 Đã đăng Video Hot (Vĩnh viễn)!" : "🎉 Đã đăng tin thành công!");
      onClose();
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Lỗi đăng tin. Vui lòng thử lại sau.");
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreviewUrl(null);
    setSelectedListingId("");
    setCompressing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>

      <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-zoom-in border border-gray-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white z-10">
            <div>
                <h3 className="font-black text-lg text-gray-800 tracking-tight">Tạo tin mới</h3>
                <p className="text-[10px] font-bold uppercase text-slate-400">Gói hiện tại: <span className="text-blue-600">{tier}</span></p>
            </div>
            <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition-colors">
                <IconX className="w-5 h-5" />
            </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-gray-50 relative flex flex-col">
            <div className="flex-1 min-h-[300px] flex items-center justify-center relative p-4">
                {previewUrl ? (
                    <div className="w-full h-full relative rounded-3xl overflow-hidden shadow-lg border border-gray-200 bg-black">
                        {mediaType === 'video' ? (
                            <video src={previewUrl} className="w-full h-full object-contain" autoPlay loop playsInline muted />
                        ) : (
                            <div className="relative w-full h-full">
                                <img src={previewUrl} className={`w-full h-full object-contain transition-all ${compressing ? 'blur-sm opacity-80' : ''}`} alt="Preview" />
                                {compressing && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                                        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-[10px] font-bold text-blue-600 uppercase">Đang nén...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Nút xóa */}
                        <button onClick={handleClear} className="absolute top-3 right-3 p-2 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"><IconX className="w-4 h-4" /></button>
                    </div>
                ) : (
                    <div className="text-center p-8 w-full" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-24 h-24 bg-white border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center mx-auto mb-4 cursor-pointer hover:border-blue-500 hover:text-blue-500 transition-all group">
                            <IconUpload className="w-10 h-10 text-gray-400 group-hover:text-blue-500 group-hover:scale-110 transition-transform" />
                        </div>
                        <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Chọn ảnh / video</p>
                        <div className="mt-4 flex justify-center gap-2">
                            {tier === 'free' && <span className="text-[9px] bg-red-100 text-red-600 px-2 py-1 rounded font-bold">Free: Chỉ ảnh (24h)</span>}
                            {tier === 'basic' && <span className="text-[9px] bg-blue-100 text-blue-600 px-2 py-1 rounded font-bold">Basic: Video 15s</span>}
                            {tier === 'pro' && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-bold flex items-center gap-1"><IconCrown className="w-3 h-3"/> Pro: Video 60s + Bất tử</span>}
                        </div>
                    </div>
                )}
            </div>

            {/* Phần gắn thẻ sản phẩm (Chỉ Basic/Pro) */}
            {canTagProduct && previewUrl && (
                <div className="px-6 pb-6 animate-slide-up">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <IconTag className="w-3 h-3 text-blue-600" /> Gắn thẻ sản phẩm
                        </label>
                        <select 
                            value={selectedListingId} 
                            onChange={(e) => setSelectedListingId(e.target.value)}
                            className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700 focus:ring-2 ring-blue-500/20 outline-none appearance-none"
                        >
                            <option value="">-- Chọn sản phẩm để bán kèm --</option>
                            {myListings.length > 0 ? myListings.map(l => (
                                <option key={l.id} value={l.id}>{l.title.substring(0, 35)}... - {Number(l.price).toLocaleString()}đ</option>
                            )) : <option disabled>Bạn chưa có tin đăng nào</option>}
                        </select>
                    </div>
                </div>
            )}

            {/* Quảng cáo nếu là Free */}
            {!canTagProduct && previewUrl && (
                <div className="px-6 pb-6">
                    <div onClick={() => window.location.href='/upgrade'} className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-4 rounded-2xl text-white text-center cursor-pointer shadow-lg hover:scale-[1.02] transition-transform">
                        <p className="text-xs font-bold flex items-center justify-center gap-2"><IconCrown className="w-4 h-4" /> Nâng cấp VIP ngay!</p>
                        <p className="text-[10px] opacity-90 mt-1">Để đăng Video & Gắn link bán hàng trực tiếp.</p>
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-gray-100 z-10">
            <button 
                onClick={handlePost} 
                disabled={uploading || compressing || !previewUrl} 
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-black text-white shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase text-xs tracking-widest"
            >
                {uploading ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Đang đăng tải...
                    </>
                ) : (
                    <>{tier === 'pro' ? 'Đăng ngay (Lưu vĩnh viễn)' : 'Đăng tin (Lưu 24h)'}</>
                )}
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
        </div>

      </div>
    </div>,
    document.body
  );
};

export default CreateStoryModal;