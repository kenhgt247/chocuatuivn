import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom'; // Quan trọng: Đưa Modal ra ngoài cùng body
import { db } from '../services/db';
import { User } from '../types';

// --- ICON SVG ---
const IconX = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconUpload = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IconImageVideo = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const IconTrash = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) return alert("File tối đa 50MB!");
      
      const type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
      setMediaType(type);
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handlePost = async () => {
    if (!file || !previewUrl) return;
    setUploading(true);
    try {
      const url = await db.uploadStoryVideo(file, user.id);
      await db.createStory(user, url, mediaType);
      
      alert("🎉 Đã đăng tin thành công!");
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // SỬ DỤNG PORTAL: Đưa Modal ra thẳng body để không bị menu/banner che
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      
      {/* 1. Backdrop làm mờ nền web */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" 
        onClick={onClose}
      ></div>

      {/* 2. Khung Modal Chính */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-zoom-in border border-gray-100">
        
        {/* === HEADER: Tiêu đề & Nút đóng === */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white z-10">
            <h3 className="font-bold text-lg text-gray-800">Tạo tin mới</h3>
            <button 
                onClick={onClose} 
                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition-colors"
            >
                <IconX className="w-5 h-5" />
            </button>
        </div>

        {/* === BODY: Khu vực hiển thị ảnh/video (Cuộn được nếu cần) === */}
        <div className="flex-1 overflow-hidden bg-gray-50 relative flex items-center justify-center min-h-[300px]">
            {previewUrl ? (
                mediaType === 'video' ? (
                    <video src={previewUrl} className="w-full h-full object-contain bg-black" autoPlay loop playsInline muted />
                ) : (
                    <img src={previewUrl} className="w-full h-full object-contain" alt="Preview" />
                )
            ) : (
                <div className="text-center p-8">
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <IconImageVideo className="w-10 h-10" />
                    </div>
                    <p className="text-gray-500 text-sm font-medium">
                        Chọn ảnh hoặc video để chia sẻ khoảnh khắc <br/>với khách hàng ngay!
                    </p>
                </div>
            )}
        </div>

        {/* === FOOTER: Nút bấm (Luôn cố định ở đáy) === */}
        <div className="p-4 bg-white border-t border-gray-100 z-10">
            {previewUrl ? (
                <div className="flex gap-3">
                    <button 
                        onClick={handleClear}
                        className="p-4 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                        title="Xóa chọn lại"
                    >
                        <IconTrash className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={handlePost} 
                        disabled={uploading} 
                        className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-white shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {uploading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Đang đăng tin...
                            </>
                        ) : (
                            <>Đăng tin ngay</>
                        )}
                    </button>
                </div>
            ) : (
                <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:scale-[1.01] transition-transform flex items-center justify-center gap-2"
                >
                    <IconUpload className="w-5 h-5" /> Tải lên từ thiết bị
                </button>
            )}
            
            {/* Input ẩn */}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
        </div>

      </div>
    </div>,
    document.body // Portal đưa modal ra ngoài cùng
  );
};

export default CreateStoryModal;