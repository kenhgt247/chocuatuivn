/** Trang tải ứng dụng Android (APK) + hướng dẫn iPhone. */
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

export const APK_URL = '/apk/cho-cua-tui.apk';
const APK_VERSION = '1.0';

const isAndroid = () => /android/i.test(navigator.userAgent);
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const Step: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) =>
  <li className="flex gap-3"><span className="h-8 w-8 shrink-0 rounded-full bg-emerald-700 text-white grid place-items-center font-bold">{n}</span><span className="pt-1 leading-snug">{children}</span></li>;

const AppDownload: React.FC = () => {
  useEffect(() => { document.title = 'Tải ứng dụng Chợ Của Tui cho Android'; }, []);
  const ios = isIOS();
  return <div className="mx-auto max-w-xl flex flex-col gap-5">
    <div className="bg-white border border-line rounded-3xl p-6 flex flex-col items-center text-center gap-3">
      <img src="/icons/icon-192.png" alt="" className="h-20 w-20 rounded-[22px] shadow" />
      <h1 className="text-2xl font-extrabold">Chợ Của Tui cho Android</h1>
      <p className="text-slate-600">Cho tặng, mượn đồ, giúp nhau, sửa đồ cùng hàng xóm. Miễn phí, nhẹ (khoảng 1–2 MB), tự cập nhật.</p>
      <a href={APK_URL} download="cho-cua-tui.apk"
        className="mt-1 w-full min-h-14 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-lg font-extrabold flex items-center justify-center gap-2">
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
        Tải ứng dụng Android
      </a>
      <p className="text-xs text-slate-500">Phiên bản {APK_VERSION} · Android 7.0 trở lên</p>
      {!isAndroid() && !ios && <p className="text-sm text-slate-600 bg-cream rounded-xl px-3 py-2">Đang dùng máy tính? Mở <b>chocuatui.vn/tai</b> trên điện thoại Android để tải.</p>}
    </div>

    {ios ? <section className="bg-white border border-line rounded-3xl p-5 flex flex-col gap-3">
      <h2 className="text-lg font-extrabold">Dùng iPhone?</h2>
      <p className="text-slate-600">iPhone không cài được file Android. Bạn dùng cách này, cũng có biểu tượng và thông báo như ứng dụng:</p>
      <ol className="flex flex-col gap-3">
        <Step n={1}>Mở <b>chocuatui.vn</b> bằng <b>Safari</b>.</Step>
        <Step n={2}>Bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên) → <b>Thêm vào Màn hình chính</b>.</Step>
        <Step n={3}>Mở Chợ Của Tui từ biểu tượng mới và bấm <b>Bật thông báo</b>.</Step>
      </ol>
    </section> : <section className="bg-white border border-line rounded-3xl p-5 flex flex-col gap-3">
      <h2 className="text-lg font-extrabold">Cách cài</h2>
      <ol className="flex flex-col gap-3">
        <Step n={1}>Bấm <b>Tải ứng dụng Android</b> ở trên, chờ tải xong.</Step>
        <Step n={2}>Mở file <b>cho-cua-tui.apk</b> vừa tải. Nếu máy hỏi, chọn <b>Cài đặt</b> → <b>Cho phép từ nguồn này</b>.</Step>
        <Step n={3}>Nếu hiện cảnh báo của <b>Play Protect</b>, bấm <b>Chi tiết</b> → <b>Vẫn cài đặt</b>. Cảnh báo này xuất hiện vì ứng dụng chưa có trên Google Play.</Step>
        <Step n={4}>Mở <b>Chợ Của Tui</b>, đăng nhập và bấm <b>Bật thông báo</b> để biết khi có người nhắn.</Step>
      </ol>
    </section>}

    <section className="bg-emerald-50 border border-emerald-100 rounded-3xl p-5 text-sm text-emerald-950 flex flex-col gap-2">
      <h2 className="font-extrabold text-base">An toàn</h2>
      <p>Chỉ tải ứng dụng tại <b>chocuatui.vn</b>. Ứng dụng không xin quyền đọc danh bạ, tin nhắn hay tài khoản ngân hàng, và không bao giờ đòi tiền.</p>
      <p>Không muốn cài? Bạn vẫn dùng đầy đủ ngay trên trình duyệt tại <Link to="/" className="font-bold underline">chocuatui.vn</Link>.</p>
    </section>
  </div>;
};

export default AppDownload;
