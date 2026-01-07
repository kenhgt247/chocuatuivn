import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

interface PageContent {
  title: string;
  subtitle: string;
  icon: string;
  content: React.ReactNode;
}

const STATIC_DATA: Record<string, PageContent> = {
  'gioi-thieu': {
    title: 'Giới thiệu công ty',
    subtitle: 'Nền tảng rao vặt AI hàng đầu Việt Nam',
    icon: '🚀',
    content: (
      <div className="space-y-6">
        <p className="text-lg text-gray-600 leading-relaxed"><b>Chợ Của Tui</b> không chỉ là một trang web rao vặt thông thường. Chúng tôi là hệ sinh thái kết nối thương mại điện tử ứng dụng trí tuệ nhân tạo (AI) để tối ưu hóa trải nghiệm mua bán.</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10">
            <h4 className="font-black text-primary uppercase text-xs mb-2">Tầm nhìn</h4>
            <p className="text-sm text-gray-500">Trở thành nền tảng rao vặt minh bạch và an toàn nhất, nơi mọi người có thể tin tưởng trao đổi giá trị.</p>
          </div>
          <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
            <h4 className="font-black text-blue-600 uppercase text-xs mb-2">Sứ mệnh</h4>
            <p className="text-sm text-gray-500">Ứng dụng công nghệ AI để loại bỏ tin giả, lừa đảo và giúp người dùng thanh lý đồ cũ trong "chớp mắt".</p>
          </div>
        </div>
        <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200" className="rounded-[2.5rem] w-full h-64 object-cover shadow-lg" alt="Team" />
      </div>
    )
  },
  'quy-che-hoat-dong': {
    title: 'Quy chế hoạt động',
    subtitle: 'Nền tảng văn minh, mua bán công bằng',
    icon: '📜',
    content: (
      <div className="space-y-8">
        <section className="space-y-4">
          <h3 className="text-xl font-black">1. Nguyên tắc chung</h3>
          <p className="text-gray-600 text-sm">Sàn giao dịch TMĐT Chợ Của Tui do Công ty Công nghệ AI Market vận hành. Thành viên trên sàn là các cá nhân, tổ chức có hoạt động thương mại hợp pháp.</p>
        </section>
        <section className="space-y-4">
          <h3 className="text-xl font-black">2. Quy định đăng tin</h3>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
            <li>Thông tin phải chính xác, hình ảnh thật 100%.</li>
            <li>Không đăng tin trùng lặp, tin rác.</li>
            <li>Nghiêm cấm các mặt hàng nằm trong danh mục hàng cấm của pháp luật.</li>
          </ul>
        </section>
        <div className="p-6 bg-red-50 rounded-3xl border border-red-100">
          <p className="text-red-600 text-xs font-bold uppercase">⚠️ Vi phạm quy chế có thể dẫn đến việc khóa tài khoản vĩnh viễn mà không cần báo trước.</p>
        </div>
      </div>
    )
  },
  'chinh-sach-bao-mat': {
    title: 'Chính sách bảo mật',
    subtitle: 'Dữ liệu của bạn là ưu tiên số 1',
    icon: '🛡️',
    content: (
      <div className="space-y-6">
        <p className="text-gray-600 leading-relaxed">Chúng tôi cam kết bảo mật tuyệt đối thông tin cá nhân của người dùng theo tiêu chuẩn quốc tế.</p>
        <div className="space-y-4">
          <div className="flex gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-colors">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-black">01</div>
            <div>
              <h4 className="font-bold text-sm">Thu thập thông tin</h4>
              <p className="text-xs text-gray-400">Chúng tôi chỉ thu thập Email, SĐT và vị trí để phục vụ việc liên lạc và gợi ý tin đăng gần bạn.</p>
            </div>
          </div>
          <div className="flex gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-colors">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-black">02</div>
            <div>
              <h4 className="font-bold text-sm">Sử dụng Cookie</h4>
              <p className="text-xs text-gray-400">Sử dụng để ghi nhớ phiên đăng nhập và cá nhân hóa trải nghiệm người dùng.</p>
            </div>
          </div>
          <div className="flex gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-colors">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-black">03</div>
            <div>
              <h4 className="font-bold text-sm">Bảo mật giao dịch</h4>
              <p className="text-xs text-gray-400">Mọi giao dịch ví đều được mã hóa SSL/TLS an toàn tuyệt đối.</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  'meo-mua-ban-an-toan': {
    title: 'Mẹo mua bán an toàn',
    subtitle: 'Tránh xa lừa đảo cùng Chợ của tui',
    icon: '💡',
    content: (
      <div className="space-y-8">
        <div className="grid gap-6">
          <div className="flex gap-6 p-6 bg-green-50 rounded-[2rem] border border-green-100">
            <span className="text-4xl">🤝</span>
            <div>
              <h4 className="font-black text-green-800 uppercase text-xs mb-2">Gặp mặt trực tiếp</h4>
              <p className="text-sm text-green-700/70">Luôn ưu tiên xem hàng tại những nơi công cộng, đông người như quán cà phê, trung tâm thương mại.</p>
            </div>
          </div>
          <div className="flex gap-6 p-6 bg-blue-50 rounded-[2rem] border border-blue-100">
            <span className="text-4xl">🔍</span>
            <div>
              <h4 className="font-black text-blue-800 uppercase text-xs mb-2">Kiểm tra kỹ sản phẩm</h4>
              <p className="text-sm text-blue-700/70">Đối với đồ điện tử, hãy test kỹ các chức năng, camera, loa và kiểm tra iCloud/Google account.</p>
            </div>
          </div>
          <div className="flex gap-6 p-6 bg-red-50 rounded-[2rem] border border-red-100">
            <span className="text-4xl">❌</span>
            <div>
              <h4 className="font-black text-red-800 uppercase text-xs mb-2">Không đặt cọc trước</h4>
              <p className="text-sm text-red-700/70">Tuyệt đối KHÔNG chuyển tiền đặt cọc khi chưa cầm trên tay sản phẩm, dù người bán có đưa ra lý do gì.</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  'huong-dan-dang-tin': {
    title: 'Hướng dẫn đăng tin',
    subtitle: 'Bán hàng nhanh hơn với AI',
    icon: '📝',
    content: (
      <div className="space-y-8">
        <div className="relative border-l-2 border-primary/20 ml-4 pl-8 space-y-12">
          <div className="relative">
            <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-white"></div>
            <h4 className="font-black text-sm uppercase">Bước 1: Chụp ảnh sản phẩm</h4>
            <p className="text-sm text-gray-500 mt-2">Chụp từ 3-5 góc độ rõ nét, đủ ánh sáng. AI của chúng tôi sẽ tự nhận diện sản phẩm.</p>
          </div>
          <div className="relative">
            <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-white"></div>
            <h4 className="font-black text-sm uppercase">Bước 2: Để AI soạn nội dung</h4>
            <p className="text-sm text-gray-500 mt-2">Tải ảnh lên, AI sẽ tự động đề xuất tiêu đề, danh mục và giá bán tham khảo dựa trên thị trường.</p>
          </div>
          <div className="relative">
            <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-white"></div>
            <h4 className="font-black text-sm uppercase">Bước 3: Xác nhận & Đẩy tin</h4>
            <p className="text-sm text-gray-500 mt-2">Kiểm tra lại thông tin và bấm đăng tin. Sử dụng tính năng "Đẩy tin" để lên Top ngay lập tức.</p>
          </div>
        </div>
        <div className="p-8 bg-primary rounded-[2.5rem] text-white text-center shadow-xl shadow-primary/20">
          <h4 className="text-xl font-black mb-4">Sẵn sàng bán món đồ đầu tiên?</h4>
          <Link to="/post" className="inline-block bg-white text-primary px-10 py-4 rounded-2xl font-black uppercase text-xs hover:scale-105 transition-transform active:scale-95">Đăng tin ngay</Link>
        </div>
      </div>
    )
  }
};

const StaticPage: React.FC = () => {
  const { slug } = useParams();
  const page = slug ? STATIC_DATA[slug] : null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!page) {
    return (
      <div className="py-32 text-center space-y-4">
        <div className="text-6xl">🔍</div>
        <h2 className="text-xl font-black">Trang không tồn tại</h2>
        <Link to="/" className="text-primary font-bold hover:underline">Quay về trang chủ</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-0 animate-fade-in-up">
      <div className="mb-12 space-y-4 text-center">
        <div className="w-20 h-20 bg-white border border-borderMain rounded-[2rem] flex items-center justify-center text-4xl mx-auto shadow-soft">{page.icon}</div>
        <h1 className="text-3xl md:text-5xl font-black text-textMain tracking-tight">{page.title}</h1>
        <p className="text-xs font-black text-primary uppercase tracking-[0.2em]">{page.subtitle}</p>
      </div>

      <div className="bg-white border border-borderMain rounded-[3rem] p-8 md:p-16 shadow-soft">
        {page.content}
      </div>

      <div className="mt-12 p-8 bg-bgMain rounded-[3rem] border border-borderMain/50 text-center">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Bạn cần hỗ trợ thêm?</p>
        <div className="flex flex-wrap justify-center gap-4">
           <a href="mailto:support@chocuatui.vn" className="bg-white border border-borderMain px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-primary transition-all">Gửi Email</a>
           <button className="bg-primary text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all">Chat trực tuyến</button>
        </div>
      </div>
    </div>
  );
};

export default StaticPage;
