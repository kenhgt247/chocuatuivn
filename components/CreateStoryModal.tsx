import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom'; 
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
  const [compressing, setCompressing] = useState(false); // Trạng thái đang nén ảnh
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // --- HÀM NÉN ẢNH (Dùng Canvas API - Không cần thư viện ngoài) ---
  const compressImageInternal = (imageFile: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // Chuẩn Story: Chiều ngang tối đa 1080px (để nhẹ máy)
          const MAX_WIDTH = 1080;
          let width = img.width;
          let height = img.height;

          // Resize nếu ảnh quá to
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Xuất file JPEG chất lượng 80%
          canvas.toBlob((blob) => {
            if (blob) {
              const newFile = new File([blob], imageFile.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(newFile);
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
      
      // 1. Xử lý Video (Giữ nguyên giới hạn 50MB)
      if (type === 'video') {
          if (selectedFile.size > 50 * 1024 * 1024) {
              return alert("Video tối đa 50MB! Vui lòng chọn video ngắn hơn.");
          }
          setMediaType('video');
          setFile(selectedFile);
          setPreviewUrl(URL.createObjectURL(selectedFile));
      } 
      // 2. Xử lý Ảnh (Nén nếu > 1MB)
      else {
          setMediaType('image');
          setPreviewUrl(URL.createObjectURL(selectedFile)); // Hiện preview ngay cho mượt
          
          if (selectedFile.size > 1024 * 1024) { // Nếu > 1MB
              setCompressing(true);
              try {
                  console.log(`Đang nén: ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB...`);
                  const compressed = await compressImageInternal(selectedFile);
                  console.log(`Đã nén còn: ${(compressed.size / 1024 / 1024).toFixed(2)} MB`);
                  setFile(compressed);
              } catch (err) {
                  console.error("Lỗi nén ảnh, dùng ảnh gốc:", err);
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
    
    // Chặn nếu đang nén
    if (compressing) return alert("Đang xử lý tối ưu ảnh, vui lòng đợi giây lát...");

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
    setCompressing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // SỬ DỤNG PORTAL
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      
      {/* 1. Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" 
        onClick={onClose}
      ></div>

      {/* 2. Modal Content */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-zoom-in border border-gray-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white z-10">
            <h3 className="font-bold text-lg text-gray-800">Tạo tin mới</h3>
            <button 
                onClick={onClose} 
                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition-colors"
            >
                <IconX className="w-5 h-5" />
            </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden bg-gray-50 relative flex items-center justify-center min-h-[300px]">
            {previewUrl ? (
                mediaType === 'video' ? (
                    <video src={previewUrl} className="w-full h-full object-contain bg-black" autoPlay loop playsInline muted />
                ) : (
                    <div className="relative w-full h-full">
                        <img src={previewUrl} className={`w-full h-full object-contain transition-all ${compressing ? 'blur-sm opacity-80' : ''}`} alt="Preview" />
                        {compressing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                                <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
                                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Đang nén ảnh...</span>
                                </div>
                            </div>
                        )}
                    </div>
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

        {/* Footer */}
        <div className="p-4 bg-white border-t border-gray-100 z-10">
            {previewUrl ? (
                <div className="flex gap-3">
                    <button 
                        onClick={handleClear}
                        className="p-4 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                        title="Xóa chọn lại"
                        disabled={uploading}
                    >
                        <IconTrash className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={handlePost} 
                        disabled={uploading || compressing} 
                        className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-white shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {uploading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Đang đăng...
                            </>
                        ) : compressing ? (
                            <>Đợi chút...</>
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
            
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
        </div>

      </div>
    </div>,
    document.body
  );
};

export default CreateStoryModal;