/**
 * Màn hình chờ khi app đang khởi động: khung xám đúng vị trí trang chủ
 * (giống màn hình chờ trong index.html) thay cho vòng quay.
 */
import React from 'react';

const Sk: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={'rounded-xl bg-[#ECE5D4] animate-pulse ' + className} />
);

const AppSkeleton: React.FC = () => (
  <div className="min-h-screen bg-cream" aria-busy="true" aria-label="Đang tải">
    <div className="max-w-6xl mx-auto px-5 py-4">
      <div className="flex items-center gap-2.5">
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
        <span className="text-lg font-extrabold text-emerald-900">Chợ Của Tui</span>
      </div>
      <Sk className="h-7 w-3/5 mt-6 mb-4" />
      <div className="grid grid-cols-2 gap-3"><Sk className="h-[88px] rounded-[20px]" /><Sk className="h-[88px] rounded-[20px]" /></div>
      <div className="grid grid-cols-4 gap-2 mt-3.5">{[0, 1, 2, 3].map(i => <Sk key={i} className="h-[66px] rounded-[14px]" />)}</div>
      <Sk className="h-[18px] w-1/3 mt-5 mb-3" />
      <div className="grid grid-cols-2 gap-3"><Sk className="h-44 rounded-2xl" /><Sk className="h-44 rounded-2xl" /></div>
      <p className="text-center text-sm font-bold text-emerald-700 mt-5">Đang tìm tin quanh bạn…</p>
      <p className="text-center text-xs text-slate-500 mt-1">Có gì chia sẻ, cần gì có nhau</p>
    </div>
  </div>
);

export default AppSkeleton;
