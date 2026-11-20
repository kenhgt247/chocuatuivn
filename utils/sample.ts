/**
 * Chế độ xem mẫu: CHỈ quản trị viên bật, CHỈ trên máy của họ (localStorage).
 * Không ghi gì vào cơ sở dữ liệu; người dùng khác luôn thấy dữ liệu thật.
 * Mọi tin mẫu đều gắn nhãn "Mẫu".
 */
import type { CommunityListing } from '../services/community';

const KEY = 'ccut-xem-mau';
export const isSampleOn = (role?: string) => { try { return role === 'admin' && localStorage.getItem(KEY) === '1'; } catch (_) { return false; } };
export function setSample(on: boolean) {
  try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch (_) { /* bỏ qua */ }
  window.dispatchEvent(new Event('ccut-area-change'));
}

// [tiêu đề, loại, có/cần, lệch Bắc (km), lệch Đông (km), nơi, giờ trước]
const ROWS: [string, string, 'have' | 'need', number, number, string, number][] = [
  ['Bộ sách giáo khoa lớp 3', 'gift', 'have', 0.3, -0.2, 'Tân Hưng', 1],
  ['Cần mượn máy khoan cầm tay', 'borrow', 'need', -0.6, 0.5, 'Tân Hưng', 2],
  ['Quần áo trẻ em 2–3 tuổi', 'gift', 'have', 1.2, 0.8, 'Hưng Đạo', 3],
  ['Nhờ chở tủ cũ ra điểm thu gom', 'help', 'need', -1.5, -1.1, 'Dương Kinh', 5],
  ['Sửa quạt điện miễn phí', 'repair', 'have', 2.1, 0.4, 'Đồ Sơn', 6],
  ['Nồi cơm điện còn dùng tốt', 'gift', 'have', -2.4, 1.9, 'Kiến An', 8],
  ['Cho mượn thang nhôm 3m', 'borrow', 'have', 1.8, -2.6, 'Hải An', 10],
  ['Cần xin xe đạp cho con đi học', 'gift', 'need', 3.2, 1.0, 'Lê Chân', 12],
  ['Dạy kèm toán lớp 5 buổi tối', 'help', 'have', -3.5, -0.8, 'Ngô Quyền', 20],
  ['Cây cảnh lưỡi hổ tách chậu', 'gift', 'have', 0.9, 3.7, 'Hồng Bàng', 26],
  ['Xe đạp trẻ em 16 inch', 'gift', 'have', 7.5, -4.0, 'Lai Khê', 30],
  ['Sửa nồi áp suất, thay gioăng', 'repair', 'have', -8.2, 5.1, 'Kiến Thụy', 40],
  ['Bàn học gỗ cho học sinh', 'gift', 'have', 9.6, 6.3, 'Thủy Nguyên', 48],
  ['Cần mượn xe đẩy em bé 1 tuần', 'borrow', 'need', -11.0, -3.2, 'An Lão', 60],
];
const FAR: [string, string, 'have' | 'need', string][] = [
  ['Tủ lạnh mini 50 lít', 'gift', 'have', 'Hà Nội'],
  ['Cần người giúp dọn nhà sau lũ', 'help', 'need', 'Thái Nguyên'],
  ['Máy may cũ còn chạy', 'gift', 'have', 'Đà Nẵng'],
  ['Sửa điện thoại, thay pin miễn phí', 'repair', 'have', 'TP Hồ Chí Minh'],
];

const NAMES = ['Chị Hoa', 'Anh Tuấn', 'Cô Lan', 'Anh Đức', 'Chị Mai', 'Anh Khoa'];
export function sampleListings(pt: { lat: number; lng: number } | null): CommunityListing[] {
  const now = Date.now();
  const base = pt || { lat: 20.84, lng: 106.69 };
  const near = ROWS.map(([title, kind, intent, n, e, place, h], i) => ({
    id: 'mau-' + i, title, communityKind: kind, communityIntent: intent, location: place,
    lat: base.lat + n / 111, lng: base.lng + e / (111 * Math.cos(base.lat * Math.PI / 180)),
    createdAt: new Date(now - h * 3600e3).toISOString(), images: [], price: 0, isCommunityFree: true, status: 'approved', _mau: true,
    sellerName: NAMES[i % NAMES.length], description: 'Đồ còn dùng tốt, ai cần nhắn mình nhé. Hẹn trao gần nhà.',
  }));
  const far = FAR.map(([title, kind, intent, place], i) => ({
    id: 'mau-xa-' + i, title, communityKind: kind, communityIntent: intent, location: place, lat: null, lng: null,
    createdAt: new Date(now - (4 + i * 7) * 3600e3).toISOString(), images: [], price: 0, isCommunityFree: true, status: 'approved', _mau: true,
  }));
  return [...near, ...far] as any;
}

export function sampleHonor() {
  const now = Date.now();
  const t = (id: string, giverId: string, giverName: string, receiverName: string, message: string, listingTitle: string, h: number) =>
    ({ id, giverId, giverName, receiverName, receiverAvatar: null, message, listingId: null, listingTitle, photo: null, createdAt: new Date(now - h * 3600e3).toISOString() });
  return {
    ok: true, month: new Date().getMonth() + 1, mode: 'thang' as const,
    thanks: [
      t('m1', 'g1', 'Chị Hoa', 'Minh Anh', 'Cảm ơn chị nhiều, bé nhà em mặc vừa in luôn ạ!', 'Quần áo trẻ em 2–3 tuổi', 2),
      t('m2', 'g2', 'Anh Tuấn', 'Bác Bình', 'Quạt chạy êm như mới, cảm ơn cháu đã sửa giúp.', 'Sửa quạt điện miễn phí', 5),
      t('m3', 'g3', 'Cô Lan', 'Thu Trang', 'Sách còn rất mới, con em thích lắm. Cảm ơn cô!', 'Bộ sách giáo khoa lớp 3', 9),
      t('m4', 'g1', 'Chị Hoa', 'Hùng', 'Nồi cơm nấu ngon, nhà em đang cần đúng lúc.', 'Nồi cơm điện còn dùng tốt', 20),
      t('m5', 'g4', 'Anh Đức', 'Mai', 'Cảm ơn anh cho mượn thang, treo xong đèn rồi ạ.', 'Cho mượn thang nhôm 3m', 30),
    ],
    top: [
      { id: 'g1', n: 6, name: 'Chị Hoa', avatar: null, location: 'Tân Hưng', sharedCount: 14, sharedByKind: {} },
      { id: 'g2', n: 4, name: 'Anh Tuấn', avatar: null, location: 'Đồ Sơn', sharedCount: 9, sharedByKind: {} },
      { id: 'g3', n: 3, name: 'Cô Lan', avatar: null, location: 'Hưng Đạo', sharedCount: 7, sharedByKind: {} },
      { id: 'g4', n: 2, name: 'Anh Đức', avatar: null, location: 'Hải An', sharedCount: 5, sharedByKind: {} },
      { id: 'g5', n: 2, name: 'Chị Mai', avatar: null, location: 'Kiến An', sharedCount: 4, sharedByKind: {} },
      { id: 'g6', n: 1, name: 'Anh Khoa', avatar: null, location: 'Lê Chân', sharedCount: 3, sharedByKind: {} },
      { id: 'g7', n: 1, name: 'Chú Phúc', avatar: null, location: 'Dương Kinh', sharedCount: 2, sharedByKind: {} },
    ],
    stats: { dang: 312, xong: 184, thanhVien: 520, camOn: 96 },
  };
}
