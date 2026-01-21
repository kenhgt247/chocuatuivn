import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Story } from '../types';
import { db } from '../services/db';
import CreateStoryModal from './CreateStoryModal';
import StoryViewer from './StoryViewer';

// --- ICON ---
const IconPlus = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconPlay = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>;

interface StoryBarProps {
  user: User | null;
}

const StoryBar: React.FC<StoryBarProps> = ({ user }) => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [allStories, setAllStories] = useState<Story[]>([]);
  const [displayStories, setDisplayStories] = useState<Story[]>([]);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);

  const canPostStory = user && ['basic', 'pro'].includes(user.subscriptionTier || '');

  useEffect(() => {
    const fetchStories = async () => {
        try {
            // Check if db.getActiveStories exists to prevent crash
            if (db.getActiveStories) {
                const stories = await db.getActiveStories();
                setAllStories(stories);
                
                // Unique by sellerId
                const unique = stories.filter((v,i,a) => a.findIndex(v2 => v2.sellerId === v.sellerId) === i);
                setDisplayStories(unique);
            }
        } catch (error) {
            console.error("Lỗi tải story:", error);
        }
    };
    fetchStories();
  }, []);

  const handleAddClick = () => {
    if (!user) return navigate('/login');
    if (!canPostStory) {
        if(window.confirm("👑 Chỉ thành viên VIP mới được đăng Story.\nNâng cấp ngay?")) navigate('/upgrade');
        return;
    }
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
      <div className="w-full mb-6">
        <div className="flex gap-3 overflow-x-auto pb-4 pt-2 px-1 no-scrollbar items-start snap-x scroll-smooth">
          
          {/* 1. MY STORY CARD */}
          <div 
            className="relative flex-shrink-0 w-[100px] h-[160px] md:w-[120px] md:h-[200px] rounded-2xl overflow-hidden cursor-pointer shadow-sm border border-gray-100 group snap-start bg-white hover:shadow-md transition-all duration-300 transform hover:-translate-y-1"
            onClick={handleAddClick}
          >
              <div className="h-[65%] w-full overflow-hidden bg-gray-50">
                 <img 
                    src={user?.avatar || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&q=80'} 
                    alt="Me" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                 />
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[35%] bg-white flex flex-col items-center justify-end pb-3 relative z-10">
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-8 h-8 md:w-9 md:h-9 rounded-full bg-blue-600 border-[3px] border-white flex items-center justify-center text-white shadow-sm group-hover:bg-blue-700 transition-colors">
                      <IconPlus className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <span className="text-[10px] md:text-xs font-bold text-gray-900 mt-3 group-hover:text-blue-600 transition-colors">Tạo tin</span>
              </div>
          </div>

          {/* 2. OTHER STORIES */}
          {displayStories.map((story) => (
              <div 
                key={story.id} 
                className="relative flex-shrink-0 w-[100px] h-[160px] md:w-[120px] md:h-[200px] rounded-2xl overflow-hidden cursor-pointer shadow-sm border border-gray-200 group snap-start hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 bg-gray-100"
                onClick={() => handleViewStory(story.sellerId)}
              >
                  {story.mediaType === 'video' ? (
                      <video src={story.videoUrl} className="w-full h-full object-cover brightness-90 group-hover:brightness-100 transition-all duration-500" muted />
                  ) : (
                      <img src={story.videoUrl} alt="Story" className="w-full h-full object-cover brightness-90 group-hover:brightness-100 transition-all duration-500" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/60 opacity-80 group-hover:opacity-100 transition-opacity"></div>

                  <div className="absolute top-2 left-2 w-8 h-8 rounded-full border-2 border-blue-500 overflow-hidden shadow-sm z-10 bg-white">
                      <img src={story.sellerAvatar} className="w-full h-full object-cover" alt="" />
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 z-10">
                      <p className="text-white text-[10px] md:text-[11px] font-bold truncate drop-shadow-sm">{story.sellerName}</p>
                  </div>

                  {story.mediaType === 'video' && (
                      <div className="absolute top-2 right-2 text-white/90 drop-shadow-md">
                          <IconPlay className="w-3 h-3 md:w-4 md:h-4" />
                      </div>
                  )}
              </div>
          ))}

          {/* Skeleton */}
          {allStories.length === 0 && user && (
             [1,2,3].map(i => (
                <div key={i} className="relative flex-shrink-0 w-[100px] h-[160px] md:w-[120px] md:h-[200px] rounded-2xl bg-gray-100 animate-pulse border border-gray-200">
                    <div className="absolute top-2 left-2 w-8 h-8 rounded-full bg-gray-200"></div>
                    <div className="absolute bottom-3 left-3 right-3 h-3 bg-gray-200 rounded"></div>
                </div>
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