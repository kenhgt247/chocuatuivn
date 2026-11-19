import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

interface PageContent {
  title: string;
  subtitle: string;
  icon: string;
  content: React.ReactNode;
}

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="text-slate-600 leading-relaxed">{children}</p>;
const H: React.FC<{ children: React.ReactNode }> = ({ children }) => <h3 className="text-lg font-bold text-slate-900 mt-6">{children}</h3>;
const UL: React.FC<{ items: string[] }> = ({ items }) => <ul className="list-disc pl-5 space-y-2 text-slate-600">{items.map(x => <li key={x}>{x}</li>)}</ul>;

const STATIC_DATA: Record<string, PageContent> = {
  'gioi-thieu': {
    title: 'Giới thiệu Chợ Của Tui',
    subtitle: 'Có gì chia sẻ, cần gì có nhau',
    icon: '🌿',
    content: (
      <div className="space-y-4">
        <P><b>Chợ Của Tui</b> là nơi hàng xóm cho nhau đồ dùng, mượn đồ, giúp nhau việc nhỏ và sửa đồ cũ. Mọi thứ đều <b>miễn phí</b>: không VIP, không ví tiền, không đẩy tin, không quảng cáo xen giữa tin.</P>
        <div className="grid sm:grid-cols-2 gap-3">
          {[['🎁', 'Cho tặng', 'Đồ còn dùng được đến tay người cần.'], ['🔁', 'Mượn đồ', 'Mượn vài ngày thay vì mua mới.'], ['🤝', 'Giúp nhau', 'Nhờ hoặc nhận giúp một việc nhỏ.'], ['🛠️', 'Sửa đồ', 'Người có tay nghề sửa giúp miễn phí.']].map(([i, t, d]) =>
            <div key={t} className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><div className="text-2xl">{i}</div><div className="font-bold mt-1">{t}</div><div className="text-sm text-slate-600">{d}</div></div>)}
        </div>
        <P>Mục tiêu của chúng tôi: mỗi phường, xã có một "góc chợ" nơi đồ còn dùng được không bị vứt bỏ, và người cần giúp tìm được người giúp gần nhà.</P>
      </div>
    )
  },
  'quy-tac': {
    title: 'Quy tắc cộng đồng',
    subtitle: 'Tử tế, trung thực, miễn phí',
    icon: '📜',
    content: (
      <div className="space-y-3">
        <H>1. Hoàn toàn miễn phí</H>
        <UL items={['Không ghi giá, không đòi tiền cọc, phí ship "ẩn", không rủ chuyển khoản.', 'Không xin đồ để bán lại.', 'Tin có dấu hiệu mua bán sẽ bị gỡ.']} />
        <H>2. Đăng tin trung thực</H>
        <UL items={['Mô tả đúng tình trạng món đồ, dùng ảnh thật.', 'Mỗi món đồ chỉ đăng một tin; đã trao xong thì đánh dấu "Đã xong".', 'Không đăng hàng cấm, thuốc, vũ khí, động vật hoang dã.']} />
        <H>3. Tôn trọng nhau</H>
        <UL items={['Người cho quyết định trao cho ai; không ép, không nói lời khó nghe.', 'Mượn đồ thì trả đúng hẹn và giữ gìn như của mình.', 'Không chia sẻ thông tin cá nhân của người khác.']} />
        <div className="p-4 mt-4 bg-rose-50 rounded-2xl border border-rose-100 text-rose-700 text-sm font-semibold">Vi phạm nhiều lần có thể bị khóa tài khoản.</div>
      </div>
    )
  },
  'an-toan': {
    title: 'An toàn khi trao đồ',
    subtitle: 'Gặp nhau vui vẻ, an toàn',
    icon: '🛡️',
    content: (
      <div className="space-y-3">
        <UL items={[
          'Hẹn ở nơi công cộng, đông người, ban ngày (quán nước, cổng chợ, trước UBND phường).',
          'Trao đổi qua tin nhắn trong Chợ Của Tui; chỉ đưa số điện thoại khi đã tin tưởng.',
          'Không bao giờ chuyển khoản, đặt cọc hay gửi mã OTP cho bất kỳ ai.',
          'Với người lớn tuổi hoặc trẻ em, nên có người nhà đi cùng.',
          'Thấy dấu hiệu lừa đảo, hãy bấm "Báo cáo" để quản trị viên xử lý.',
        ]} />
      </div>
    )
  },
  'chinh-sach-bao-mat': {
    title: 'Chính sách bảo mật',
    subtitle: 'Chỉ thu thập điều thật cần · cập nhật 19/11/2026',
    icon: '🔒',
    content: (
      <div className="space-y-3">
        <H>1. Chúng tôi lưu gì</H>
        <UL items={[
          'Tài khoản: tên hiển thị, email đăng nhập, ảnh đại diện; số điện thoại nếu bạn tự nhập.',
          'Khu vực: tên xã/phường bạn chọn. Không lưu địa chỉ nhà.',
          'Tin đăng: tiêu đề, mô tả, ảnh, chỗ hẹn, thời gian đăng.',
          'Yêu cầu và tin nhắn giữa hai người, cùng các mốc (đồng ý, đã trao, đã nhận).',
          'Mã thông báo của thiết bị, chỉ khi bạn bấm cho phép thông báo.',
        ]} />
        <H>2. Ai thấy được</H>
        <UL items={[
          'Mọi người: tên, ảnh đại diện, khu vực, số lần đã chia sẻ xong, và các tin đang hiện của bạn.',
          'Chỉ người trong cuộc trò chuyện: tin nhắn và yêu cầu giữa hai bên.',
          'Không ai khác ngoài bạn và quản trị viên: email, số điện thoại, địa chỉ.',
          'Số điện thoại/Zalo chỉ được gửi khi chính bạn bấm "Gửi Zalo của tôi".',
        ]} />
        <H>3. Vị trí</H>
        <UL items={[
          'Không bắt buộc bật GPS. Nút "Dùng vị trí hiện tại" chỉ dùng trên máy bạn để tìm xã/phường, không gửi toạ độ lên máy chủ.',
          'Trên bản đồ, tin được đặt ở giữa xã/phường, hoặc ở vị trí làm tròn khoảng 1 km nếu bạn cho phép.',
        ]} />
        <H>4. Lưu trữ và xoá</H>
        <UL items={[
          'Dữ liệu lưu trên Google Firebase. Chúng tôi không bán hay chia sẻ dữ liệu cho bên quảng cáo.',
          'Bạn xoá được tin của mình bất cứ lúc nào trong trang Cá nhân.',
          'Muốn xoá hẳn tài khoản, gửi email tới support@chocuatui.vn; chúng tôi xử lý trong 7 ngày.',
        ]} />
      </div>
    )
  },
  'dieu-khoan': {
    title: 'Điều khoản sử dụng',
    subtitle: 'Ngắn gọn, dễ hiểu · cập nhật 19/11/2026',
    icon: '🤝',
    content: (
      <div className="space-y-3">
        <H>1. Chợ Của Tui là gì</H>
        <P>Nơi kết nối hàng xóm để cho tặng, cho mượn, giúp nhau và sửa đồ miễn phí. Chúng tôi không mua bán, không giữ đồ, không thu tiền và không đứng ra bảo đảm cho các bên.</P>
        <H>2. Bạn đồng ý</H>
        <UL items={[
          'Không ghi giá, không đòi tiền cọc hay phí dưới bất kỳ hình thức nào.',
          'Mô tả trung thực; chỉ đăng đồ hợp pháp, an toàn.',
          'Tự chịu trách nhiệm khi gặp mặt, trao đổi đồ hoặc giúp đỡ; ưu tiên nơi công cộng.',
          'Tôn trọng người khác; không quấy rối, lừa đảo, thu thập thông tin người khác.',
          'Việc khẩn cấp, chở người bệnh không nhận qua ứng dụng: hãy gọi 115.',
        ]} />
        <H>3. Duyệt tin và xử lý vi phạm</H>
        <UL items={[
          'Mọi tin được duyệt trước khi hiện. Tin hiện 30 ngày, sau đó bạn có thể gia hạn.',
          'Quản trị viên có thể từ chối, ẩn tin hoặc khoá tài khoản vi phạm quy tắc cộng đồng.',
          'Bạn có thể báo cáo tin hoặc cuộc trò chuyện có vấn đề ngay trong ứng dụng.',
        ]} />
        <H>4. Giới hạn trách nhiệm</H>
        <P>Chợ Của Tui cung cấp nơi kết nối "như hiện có". Chúng tôi không chịu trách nhiệm về chất lượng đồ, việc giao nhận hay thiệt hại phát sinh giữa các thành viên, nhưng sẽ hỗ trợ xử lý báo cáo và cung cấp thông tin cho cơ quan chức năng khi có yêu cầu hợp pháp.</P>
        <p className="text-xs text-slate-500">Đây là bản tóm tắt dễ đọc, chưa phải văn bản pháp lý. Nên nhờ luật sư xem lại trước khi mở rộng.</p>
      </div>
    )
  },
  'huong-dan-dang-tin': {
    title: 'Hướng dẫn đăng tin',
    subtitle: 'Một phút là xong',
    icon: '📝',
    content: (
      <div className="space-y-4">
        <ol className="list-decimal pl-5 space-y-2 text-slate-600">
          <li>Chọn <b>Tôi có</b> (muốn cho, cho mượn, giúp) hoặc <b>Tôi cần</b> (xin, mượn, nhờ).</li>
          <li>Chọn loại: Cho tặng, Mượn đồ, Giúp nhau hoặc Sửa đồ.</li>
          <li>Viết tên món đồ hoặc việc cần giúp, mô tả ngắn, khu vực (phường/xã) và thêm ảnh.</li>
          <li>Bấm Đăng. Tin sẽ hiện sau khi quản trị viên duyệt.</li>
          <li>Khi có người gửi yêu cầu, vào mục <b>Yêu cầu</b> để đồng ý hoặc từ chối, rồi nhắn tin hẹn giờ.</li>
        </ol>
        <div className="p-6 bg-emerald-700 rounded-3xl text-white text-center">
          <h4 className="text-lg font-bold mb-3">Sẵn sàng chia sẻ món đồ đầu tiên?</h4>
          <Link to="/cong-dong/dang-tin" className="inline-block bg-white text-emerald-800 px-8 py-3 rounded-2xl font-bold">Đăng tin ngay</Link>
        </div>
      </div>
    )
  }
};
// Đường dẫn cũ
STATIC_DATA['quy-che-hoat-dong'] = STATIC_DATA['quy-tac'];

const StaticPage: React.FC = () => {
  const { slug } = useParams();
  const page = slug ? STATIC_DATA[slug] : null;

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  if (!page) {
    return (
      <div className="py-32 text-center space-y-4">
        <div className="text-6xl">🔍</div>
        <h2 className="text-xl font-black">Trang không tồn tại</h2>
        <Link to="/" className="text-emerald-700 font-bold hover:underline">Quay về trang chủ</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl grid place-items-center text-3xl mx-auto">{page.icon}</div>
        <h1 className="mt-4 text-3xl md:text-4xl font-black text-slate-900">{page.title}</h1>
        <p className="mt-2 text-sm font-semibold text-emerald-700">{page.subtitle}</p>
      </div>
      <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-10">{page.content}</div>
      <p className="mt-6 text-center text-sm text-slate-500">Cần hỗ trợ? Gửi email tới <a className="underline" href="mailto:support@chocuatui.vn">support@chocuatui.vn</a></p>
    </div>
  );
};

export default StaticPage;
