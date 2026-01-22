import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom'; // Import Link để dẫn sang trang sản phẩm
import { Story, User } from '../types';
import { db } from '../services/db';

// --- ICONS ---
const IconX = () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconVolume = () => <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M11 5L6 9H2V15H6L11 19V5Z" /><path d="M15.54 8.46C16.47 9.39 17 10.63 17 12C17 13.37 16.47 14.61 15.54 15.54L14.12 14.12C14.68 13.56 15 12.8 15 12C15 11.2 14.68 10.44 14.12 9.88L15.54 8.46Z" /></svg>;
const IconMute = () => <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12C16.5 10.23 15.48 8.71 14 7.97V16.02C15.48 15.29 16.5 13.77 16.5 12Z" /><path d="M19 12C19 12.94 18.8 13.82 18.46 14.64L19.97 16.15C20.63 14.91 21 13.5 21 12C21 7.72 17.97 4.16 14 3.23V5.29C16.89 6.15 19 8.83 19 12Z" /><path d="M4.27 3L3 4.27L7.73 9H3V15H7L12 20V13.27L16.25 17.53C15.58 18.04 14.83 18.46 14 18.7V20.77C15.38 20.45 16.63 19.82 17.68 18.96L19.73 21L21 19.73L4.27 3ZM12 4L9.91 6.09L12 8.18V4Z" /></svg>;
const IconSend = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;
const IconShoppingBag = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>;

interface Props {
  stories: Story[];
  startIndex: number;
  onClose: () => void;
  currentUser: User | null;
}

const StoryViewer: React.FC<Props> = ({ stories, startIndex, onClose, currentUser }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [replyText, setReplyText] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const currentStory = stories && stories[currentIndex];

  useEffect(() => {
    if (!currentStory) {
      onClose();
    }
  }, [currentStory, onClose]);

  if (!currentStory) return null;

  const nextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const prevStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    } else {
      setProgress(0);
    }
  };

  // --- LOGIC THỜI GIAN ---
  useEffect(() => {
    setProgress(0);
    setIsPaused(false);
  }, [currentIndex]);

  useEffect(() => {
    if (currentStory.mediaType === 'video') return;
    if (isPaused) return;

    const DURATION = 5000; 
    const INTERVAL = 50;   

    const timer = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (INTERVAL / DURATION) * 100;
        return newProgress > 100 ? 100 : newProgress; 
      });
    }, INTERVAL);

    return () => clearInterval(timer);
  }, [currentIndex, isPaused, currentStory.mediaType]);

  const handleVideoTimeUpdate = () => {
    if (videoRef.current && !isPaused) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      if (duration > 0) {
        const percent = (current / duration) * 100;
        setProgress(percent); 
      }
    }
  };

  useEffect(() => {
    if (progress >= 100) {
        nextStory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]); 

  // Pause/Play Video
  useEffect(() => {
    if (currentStory.mediaType === 'video' && videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {}); 
      }
    }
  }, [isPaused, currentStory.mediaType]);

  const handleSendReply = async () => {
    if (!currentUser) return alert("Vui lòng đăng nhập để chat!");
    if (!replyText.trim()) return;

    const textToSend = replyText;
    setReplyText(''); 

    if (db.replyToStory) {
        await db.replyToStory(currentStory, currentUser, textToSend);
    }
  };

  const handleQuickReaction = async (emoji: string) => {
    if (!currentUser) return;
    if (db.replyToStory) {
        await db.replyToStory(currentStory, currentUser, emoji);
    }
  };

  if (typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center animate-fade-in">
      
      {/* Progress Bar */}
      <div className="absolute top-4 left-4 right-4 z-50 flex gap-1.5 pointer-events-none">
        {stories.map((story, index) => (
            <div key={story.id} className="h-0.5 md:h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-white transition-all duration-100 ease-linear"
                    style={{ 
                        width: index === currentIndex ? `${progress}%` : (index < currentIndex ? '100%' : '0%') 
                    }}
                ></div>
            </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-8 left-4 right-4 z-50 flex items-center justify-between pointer-events-auto">
         <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full p-[1px] border border-white/50">
                <img src={currentStory.sellerAvatar} alt="ava" className="w-full h-full rounded-full object-cover" />
             </div>
             <div>
                 <p className="text-white font-bold text-sm drop-shadow-md flex items-center gap-1">
                    {currentStory.sellerName}
                    {currentStory.isPermanent && <span className="bg-yellow-500 text-black text-[8px] px-1 rounded font-black">PRO</span>}
                 </p>
                 <p className="text-white/80 text-[10px]">Đang xem tin</p>
             </div>
         </div>
         <div className="flex items-center gap-4">
             {currentStory.mediaType === 'video' && (
                 <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="text-white/80 hover:text-white p-2">
                     {isMuted ? <IconMute /> : <IconVolume />}
                 </button>
             )}
             <button onClick={onClose} className="text-white hover:scale-110 transition-transform p-2">
                 <IconX />
             </button>
         </div>
      </div>

      {/* Content */}
      <div 
        className="w-full h-full md:max-w-[500px] md:h-auto md:aspect-[9/16] relative bg-gray-900 flex items-center justify-center overflow-hidden"
        onPointerDown={() => setIsPaused(true)}
        onPointerUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
          {currentStory.mediaType === 'video' ? (
              <video 
                ref={videoRef}
                src={currentStory.videoUrl} 
                className="w-full h-full object-contain" 
                autoPlay 
                playsInline 
                muted={isMuted}
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={() => setProgress(100)} 
                onError={() => setProgress(100)}
              />
          ) : (
              <img 
                src={currentStory.videoUrl} 
                className="w-full h-full object-contain animate-zoom-slow" 
                alt="Story" 
              />
          )}

          <div className="absolute inset-y-0 left-0 w-[30%] z-40" onClick={(e) => { e.stopPropagation(); prevStory(); }}></div>
          <div className="absolute inset-y-0 right-0 w-[30%] z-40" onClick={(e) => { e.stopPropagation(); nextStory(); }}></div>
      </div>

      {/* --- 🔥 TÍNH NĂNG MỚI: THẺ SẢN PHẨM (PRODUCT CARD) --- */}
      {currentStory.listingId && (
        <div className="absolute bottom-24 left-4 right-4 z-[60] pointer-events-auto animate-fade-in-up">
            <Link 
                to={`/san-pham/${currentStory.listingId}`}
                onClick={(e) => e.stopPropagation()} // Chặn click để không pause/next story
                className="block bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-2xl shadow-2xl hover:bg-white/20 transition-all group"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-yellow-400 p-2 rounded-xl text-yellow-900 shadow-lg group-hover:scale-110 transition-transform">
                        <IconShoppingBag />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-yellow-300 text-[10px] font-black uppercase tracking-widest opacity-90">Sản phẩm trong video</p>
                        <p className="text-white text-xs font-bold truncate">Xem chi tiết & Mua ngay</p>
                    </div>
                    <div className="bg-white text-black text-[10px] font-black px-4 py-2 rounded-full uppercase shadow-md hover:bg-gray-100 transition-colors">
                        Mở
                    </div>
                </div>
            </Link>
        </div>
      )}

      {/* Footer Chat */}
      <div 
        className="absolute bottom-6 w-full max-w-md px-4 flex gap-3 z-50 pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()} 
      >
          <div className="flex-1 relative">
            <input 
                type="text" 
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                placeholder="Gửi tin nhắn..." 
                className="w-full bg-black/20 border border-white/60 rounded-full pl-4 pr-10 py-3 text-white placeholder-white/70 focus:outline-none focus:border-white focus:bg-black/40 backdrop-blur-md transition-all text-sm"
            />
            {replyText && (
                <button 
                    onClick={handleSendReply}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-400 hover:text-blue-300"
                >
                    <IconSend />
                </button>
            )}
          </div>

          {!replyText && (
              <>
                <button className="text-3xl hover:scale-125 transition-transform" onClick={() => handleQuickReaction('❤️')}>❤️</button>
                <button className="text-3xl hover:scale-125 transition-transform" onClick={() => handleQuickReaction('🔥')}>🔥</button>
              </>
          )}
      </div>

    </div>,
    document.body
  );
};

export default StoryViewer;