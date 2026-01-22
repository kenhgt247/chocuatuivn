import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Story } from '../types';
import { db } from '../services/db';
import CreateStoryModal from './CreateStoryModal';
import StoryViewer from './StoryViewer';

// --- ICON ---
const IconPlus = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconPlay = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
// Icon User cho khách chưa đăng nhập
const IconUserGuest = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>;

interface StoryBarProps {
  user: User | null;
}

const StoryBar: React.FC<StoryBarProps> = ({ user }) => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [allStories, setAllStories] = useState<Story[]>([]);
  const [displayStories, setDisplayStories] = useState<Story[]>([]);
  const [myActiveStory, setMyActiveStory] = useState<Story | null>(null);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchStories = async () => {
        try {
            if (db.getActiveStories) {
                const stories = await db.getActiveStories();
                setAllStories(stories);
                
                if (user) {
                    const myStory = stories.find(s => s.sellerId === user.id);
                    setMyActiveStory(myStory || null);
                }

                const uniqueOthers = stories.filter((s, index, self) => 
                    s.sellerId !== user?.id && 
                    index === self.findIndex(t => t.sellerId === s.sellerId)
                );
                
                const sorted = uniqueOthers.sort((a, b) => {
                    if (a.isPermanent && !b.isPermanent) return -1;
                    if (!a.isPermanent && b.isPermanent) return 1;
                    return 0;
                });

                setDisplayStories(sorted);
            }
        } catch (error) {
            console.error("Lỗi tải story:", error);
        }
    };
    fetchStories();
  }, [user]);

  const handleAddClick = (e?: React.MouseEvent) => {
    if (e && e.stopPropagation) e.stopPropagation();
    
    if (!user) return navigate('/login');
    setIsModalOpen(true);
  };

  const handleViewStory = (sellerId: string) => {
      const index = allStories.findIndex(s => s.sellerId === sellerId);
      if (index !== -1) {
          setViewingIndex(index);
      }
  };

  return (
    <>
      <div className="w-full mb-6 select-none">
        <div className="flex gap-3 overflow-x-auto pb-4 pt-2 px-1 no-scrollbar items-start snap-x scroll-smooth">
          
          {/* --- 1. Ô ĐẦU TIÊN: TIN CỦA TÔI / TẠO TIN --- */}
          <div 
            className={`relative flex-shrink-0 w-[85px] h-[140px] md:w-[110px] md:h-[190px] rounded-2xl overflow-hidden cursor-pointer shadow-sm border group snap-start transition-all duration-300 transform hover:-translate-y-1
                ${myActiveStory ? (myActiveStory.isPermanent ? 'border-yellow-400 ring-1 ring-yellow-400' : 'border-blue-500 ring-1 ring-blue-500') : 'border-gray-200 bg-white'}
            `}
            onClick={(e) => myActiveStory ? handleViewStory(user!.id) : handleAddClick(e)}
          >
              <div className="h-full w-full relative">
                 {myActiveStory ? (
                     // TRƯỜNG HỢP 1: ĐÃ CÓ STORY -> Hiện ảnh/video story
                     <>
                        {myActiveStory.mediaType === 'video' ? (
                            <video src={myActiveStory.videoUrl} className="w-full h-full object-cover brightness-90" muted />
                        ) : (
                            <img src={myActiveStory.videoUrl} alt="My Story" className="w-full h-full object-cover brightness-90" />
                        )}
                        <div className="absolute inset-0 bg-black/20"></div>
                     </>
                 ) : (
                     // TRƯỜNG HỢP 2: CHƯA CÓ STORY HOẶC CHƯA ĐĂNG NHẬP
                     // Thay ảnh "GU" xấu xí bằng Icon User xịn xò
                     <div className="h-[75%] w-full bg-slate-50 flex items-center justify-center relative overflow-hidden">
                        {user?.avatar ? (
                            <img 
                                src={user.avatar} 
                                alt="Me" 
                                className="w-full h-full object-cover opacity-90 hover:scale-110 transition-transform duration-500"
                            />
                        ) : (
                            // Giao diện cho khách chưa đăng nhập (Sạch đẹp, không lỗi)
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 text-slate-300">
                                <IconUserGuest className="w-12 h-12 md:w-16 md:h-16" />
                            </div>
                        )}
                     </div>
                 )}
              </div>
              
              {/* PHẦN FOOTER (NÚT CỘNG + TEXT) */}
              {myActiveStory ? (
                  // Đã có tin -> Nút cộng nhỏ ở góc
                  <>
                    <div 
                        className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-lg hover:bg-blue-50 z-20"
                        onClick={handleAddClick} 
                    >
                        <IconPlus className="w-5 h-5" />
                    </div>
                    <div className="absolute bottom-3 left-3 text-white text-[10px] font-bold drop-shadow-md z-10">
                        Tin của bạn
                    </div>
                  </>
              ) : (
                  // Chưa có tin -> Footer trắng đè lên dưới cùng
                  <div className="absolute bottom-0 left-0 right-0 h-[25%] bg-white z-10 flex flex-col items-center justify-end pb-2">
                      {/* Nút cộng nổi lên giữa ranh giới */}
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-blue-600 border-[3px] border-white flex items-center justify-center text-white shadow-md group-hover:bg-blue-500 transition-colors z-20">
                          <IconPlus className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-700">Tạo tin</span>
                  </div>
              )}
          </div>

          {/* --- 2. DANH SÁCH NGƯỜI KHÁC --- */}
          {displayStories.map((story) => (
            <div 
                key={story.id} 
                className={`relative flex-shrink-0 w-[85px] h-[140px] md:w-[110px] md:h-[190px] rounded-2xl overflow-hidden cursor-pointer shadow-sm border group snap-start hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 bg-gray-100
                    ${story.isPermanent ? 'border-yellow-400 ring-1 ring-yellow-400/50' : 'border-gray-200'}
                `}
                onClick={() => handleViewStory(story.sellerId)}
            >
                {story.mediaType === 'video' ? (
                    <video src={story.videoUrl} className="w-full h-full object-cover brightness-90 group-hover:brightness-100 transition-all duration-500" muted />
                ) : (
                    <img src={story.videoUrl} alt="Story" className="w-full h-full object-cover brightness-90 group-hover:brightness-100 transition-all duration-500" />
                )}

                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/70 opacity-90 group-hover:opacity-100 transition-opacity"></div>

                <div className={`absolute top-2 left-2 w-9 h-9 rounded-full border-[2px] overflow-hidden shadow-md z-10 bg-white p-0.5
                    ${story.isPermanent ? 'border-yellow-400' : 'border-blue-500'}
                `}>
                    <img src={story.sellerAvatar || "https://ui-avatars.com/api/?name=User"} className="w-full h-full rounded-full object-cover" alt="" onError={(e) => (e.target as HTMLImageElement).src = "https://ui-avatars.com/api/?name=User"} />
                </div>

                {story.isPermanent && (
                    <div className="absolute top-8 left-2 bg-yellow-400 text-[7px] font-black px-1.5 py-0.5 rounded text-black shadow-sm z-20 flex items-center gap-0.5">PRO</div>
                )}

                <div className="absolute bottom-2 left-2 right-2 z-10">
                    <p className="text-white text-[10px] font-bold truncate drop-shadow-md">{story.sellerName}</p>
                </div>

                {story.mediaType === 'video' && (
                    <div className="absolute top-2 right-2 text-white/90 drop-shadow-md">
                        <IconPlay className="w-3 h-3" />
                    </div>
                )}
            </div>
          ))}

          {/* Skeleton */}
          {allStories.length === 0 && !myActiveStory && user && (
             [1,2,3].map(i => (
                <div key={i} className="relative flex-shrink-0 w-[85px] h-[140px] md:w-[110px] md:h-[190px] rounded-2xl bg-gray-100 animate-pulse border border-gray-200"></div>
             ))
          )}
        </div>
      </div>

      {user && isModalOpen && (
          <CreateStoryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} user={user} />
      )}

      {viewingIndex !== null && allStories.length > 0 && (
          <StoryViewer 
            stories={allStories} 
            startIndex={viewingIndex} 
            onClose={() => setViewingIndex(null)} 
            currentUser={user}
          />
      )}
    </>
  );
};

export default StoryBar;