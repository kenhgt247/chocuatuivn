/**
 * Chợ Của Tui 2.0 — cộng đồng miễn phí trên Firebase hiện tại.
 * Không tạo cơ sở dữ liệu/tài khoản thứ hai. Không gọi API thanh toán.
 */
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, onSnapshot,
  runTransaction, serverTimestamp, updateDoc, setDoc, addDoc, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { auth, db, firestore } from './db';
import { compressAndGetBase64, makeThumbBase64 } from '../utils/imageCompression';
import type { Listing, User } from '../types';

export type CommunityKind = 'gift' | 'borrow' | 'help' | 'repair';
export type CommunityIntent = 'have' | 'need';
export type CommunityStatus = 'requested' | 'accepted' | 'declined' | 'handed_over' | 'returned' | 'completed' | 'cancelled';
export interface CommunityListing extends Listing {
  communityKind?: CommunityKind;
  communityIntent?: CommunityIntent;
  isCommunityFree?: boolean;
  meetPlace?: string;
  pickupTimes?: string;
  pickupNote?: string;
  quantity?: number | null;
}
export interface CommunityRequest {
  id: string;
  listingId: string;
  listingTitle: string;
  kind: CommunityKind;
  ownerId: string;
  requesterId: string;
  message: string;
  intent?: CommunityIntent; // tin 'Tôi có' hay 'Tôi cần' (yêu cầu cũ không có = 'have')
  status: CommunityStatus;
  createdAt?: any;
  updatedAt?: any;
}
export interface CommunityPostInput {
  title: string;
  description: string;
  kind: CommunityKind;
  intent: CommunityIntent;
  location: string;
  photos?: File[];
  approximateCoords?: {lat:number;lng:number} | null;
  meetPlace?: string; // chỗ hẹn trao: cổng chợ, cổng trường...
  wardPoint?: { lat: number; lng: number; code?: string } | null; // tâm xã/phường đã chọn
  areaHint?: string;      // khu vực đang chọn (giúp đoán xã/phường khi chỉ gõ tên)
  pickupTimes?: string;   // lấy được lúc nào: "Buổi tối, Cuối tuần"
  pickupNote?: string;    // ghi chú khi lấy
  quantity?: number | null; // số lượng (0 = nhiều)
}

const kinds: CommunityKind[] = ['gift', 'borrow', 'help', 'repair'];
export const MAX_PHOTOS = 4;
export const MAX_OPEN_REQUESTS = 5;
export const kindLabels: Record<CommunityKind, string> = {
  gift: 'Cho tặng', borrow: 'Mượn đồ', help: 'Giúp nhau', repair: 'Sửa đồ'
};
export const statusLabels: Record<CommunityStatus, string> = {
  requested: 'Đang chờ', accepted: 'Đã đồng ý', declined: 'Từ chối',
  handed_over: 'Chờ xác nhận', returned: 'Đã báo trả đồ', completed: 'Hoàn thành', cancelled: 'Đã hủy'
};
function currentUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Vui lòng đăng nhập để tiếp tục.');
  return uid;
}
function checkKind(kind: unknown): kind is CommunityKind {
  return kinds.includes(kind as CommunityKind);
}
function safeText(value: string, max: number) {
  return value.trim().slice(0, max);
}
/**
 * Vai trò trong một yêu cầu:
 * - Tin "Tôi có": chủ tin là người trao (cho/cho mượn/giúp/sửa), người gửi yêu cầu là người nhận.
 * - Tin "Tôi cần": ngược lại, người gửi yêu cầu là người trao.
 * Hoàn thành luôn cần cả hai bên: người trao báo đã trao, người nhận xác nhận.
 */
export function roles(r: CommunityRequest) {
  const need = r.intent === 'need';
  return { giverId: need ? r.requesterId : r.ownerId, receiverId: need ? r.ownerId : r.requesterId };
}
export function nextStatuses(r: CommunityRequest, uid: string): CommunityStatus[] {
  const { giverId, receiverId } = roles(r);
  if (r.status === 'requested' && r.ownerId === uid) return ['accepted', 'declined'];
  if (r.status === 'requested' && r.requesterId === uid) return ['cancelled'];
  if (r.status === 'accepted' && giverId === uid) return ['handed_over', 'cancelled'];
  if (r.status === 'accepted' && receiverId === uid) return ['cancelled'];
  if (r.status === 'handed_over' && receiverId === uid) return r.kind === 'borrow' ? ['returned'] : ['completed'];
  if (r.status === 'returned' && r.kind === 'borrow' && giverId === uid) return ['completed'];
  return [];
}
/** Chữ trên nút, theo đúng việc người bấm đang làm. */
export function actionLabel(r: CommunityRequest, status: CommunityStatus): string {
  if (status === 'accepted') return 'Đồng ý';
  if (status === 'declined') return 'Từ chối';
  if (status === 'cancelled') return 'Hủy';
  if (status === 'handed_over') return ({ gift: 'Tôi đã trao đồ', borrow: 'Tôi đã giao đồ cho mượn', help: 'Tôi đã giúp xong', repair: 'Tôi đã sửa xong' } as const)[r.kind];
  if (status === 'returned') return 'Tôi đã trả đồ';
  if (status === 'completed') {
    if (r.kind === 'borrow') return 'Xác nhận đã nhận lại đồ';
    return ({ gift: 'Xác nhận đã nhận đồ', borrow: '', help: 'Xác nhận đã được giúp', repair: 'Xác nhận đã sửa xong' } as const)[r.kind];
  }
  return statusLabels[status];
}
/** Dòng chữ cho biết đang chờ ai, hiện khi người xem không có nút nào để bấm. */
export function waitingText(r: CommunityRequest, uid: string): string {
  const { giverId } = roles(r);
  const meGiver = uid === giverId;
  switch (r.status) {
    case 'requested': return uid === r.ownerId ? '' : 'Đang chờ chủ tin trả lời.';
    case 'accepted': return meGiver ? '' : 'Đã đồng ý. Hãy nhắn tin hẹn giờ; chờ bên kia báo đã ' + (r.kind === 'help' ? 'giúp' : r.kind === 'repair' ? 'sửa' : 'trao') + ' xong.';
    case 'handed_over': return meGiver ? 'Bạn đã báo xong. Đang chờ bên nhận xác nhận.' : '';
    case 'returned': return meGiver ? '' : 'Bạn đã báo trả đồ. Đang chờ chủ đồ xác nhận đã nhận lại.';
    case 'completed': return '✅ Hai bên đã xác nhận hoàn thành.';
    case 'declined': return 'Yêu cầu đã bị từ chối.';
    case 'cancelled': return 'Yêu cầu đã hủy.';
  }
  return '';
}

// --- Nhắc an toàn: chỉ hiện khi nội dung có dấu hiệu việc nhạy cảm ---
export type SafetyNote = { level: 'block' | 'warn'; title: string; text: string };
const SAFETY_RULES: { re: RegExp; note: SafetyNote }[] = [
  { re: /cấp cứu|đột quỵ|bất tỉnh|khó thở|tai nạn|chở (người )?(bệnh|ốm)|đưa .{0,15}(đi viện|đi khám|vào viện|cấp cứu)|chở .{0,15}(đi viện|đi khám|vào viện)/,
    note: { level: 'block', title: 'Việc khẩn cấp, chở người bệnh', text: 'Chợ Của Tui không nhận các việc này. Nếu nguy cấp, hãy gọi 115 ngay.' } },
  { re: /dây điện|ổ cắm|cầu dao|aptomat|át tô mát|bình nóng lạnh|đường điện|(sửa|đấu|thay|câu) điện|bình ga|bếp ga|rò ga|khí ga|\bgas\b/,
    note: { level: 'warn', title: 'Việc liên quan điện, ga', text: 'Có thể gây cháy nổ, điện giật. Chỉ nhờ người có tay nghề; ngắt điện/khóa ga trước khi làm. Việc lớn nên gọi thợ có chứng chỉ.' } },
  { re: /trẻ em|trẻ nhỏ|trông trẻ|trông bé|trông con|trông cháu|đưa đón (bé|con|cháu)|dạy kèm|gia sư|em bé/,
    note: { level: 'warn', title: 'Việc liên quan trẻ em', text: 'Chỉ cha mẹ/người giám hộ đăng. Không đăng ảnh hay thông tin riêng của trẻ. Luôn có người lớn trong gia đình khi gặp.' } },
  { re: /(đến|tới|qua|sang|vào) nhà|tận nhà|tại nhà/,
    note: { level: 'warn', title: 'Có đến nhà', text: 'Ưu tiên hẹn nơi công cộng. Nếu phải đến nhà, nên có người nhà ở cùng và chỉ đưa địa chỉ sau khi đã nhắn tin trao đổi.' } },
];
export function safetyNotes(text: string): SafetyNote[] {
  const t = (text || '').toLowerCase();
  return SAFETY_RULES.filter(x => x.re.test(t)).map(x => x.note);
}


/** Nén và tải ảnh lên (ảnh lớn + ảnh nhỏ cho thẻ tin). */
async function uploadPhotos(uid: string, photos: File[]): Promise<{ images: string[]; thumbs: string[] }> {
  for (const photo of photos)
    if (!photo.type.startsWith('image/') || photo.size > 8 * 1024 * 1024)
      throw new Error('Mỗi ảnh phải là hình và dưới 8 MB.');
  const images: string[] = [];
  const thumbs: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const stamp = 'listings/' + uid + '/community-' + Date.now() + '-' + i;
    const [compressed, small] = await Promise.all([compressAndGetBase64(photos[i]), makeThumbBase64(photos[i])]);
    const [big, thumb] = await Promise.all([
      db.uploadImage(compressed, stamp + '.jpg'),
      small ? db.uploadImage(small, stamp + '-nho.jpg').catch(() => null) : Promise.resolve(null),
    ]);
    images.push(big);
    thumbs.push(thumb || big);
  }
  return { images, thumbs };
}

/** Lời cảm ơn người nhận gửi người cho sau khi trao xong. */
export interface ThankNote {
  id: string; giverId: string; receiverId: string; receiverName: string; receiverAvatar?: string;
  listingId: string; listingTitle: string; kind: CommunityKind; message: string; photo?: string | null; createdAt?: any;
}
export function receiverOf(r: CommunityRequest) { return (r.intent || 'have') === 'need' ? r.ownerId : r.requesterId; }
export function giverOf(r: CommunityRequest) { return (r.intent || 'have') === 'need' ? r.requesterId : r.ownerId; }

export const community = {
  // Dùng truy vấn mà trang rao vặt cũ đang sử dụng; không yêu cầu migration/index mới.
  async list(): Promise<CommunityListing[]> {
    // Chỉ lọc bằng điều kiện "bằng" để không cần tạo index mới; sắp xếp mới nhất ở máy người dùng.
    const snapshot = await getDocs(query(
      collection(firestore, 'listings'),
      where('isCommunityFree', '==', true), where('status', '==', 'approved'), limit(300)
    ));
    return snapshot.docs
      .map(x => ({ ...x.data(), id: x.id } as CommunityListing))
      .filter(x => checkKind(x.communityKind) && x.price === 0)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  },
  /** Tin cộng đồng của chính mình, mọi trạng thái (chờ duyệt, đang hiện, đã xong, đã ẩn). */
  async myListings(uid: string): Promise<CommunityListing[]> {
    const snapshot = await getDocs(query(collection(firestore, 'listings'), where('sellerId', '==', uid), limit(200)));
    return snapshot.docs
      .map(x => ({ ...x.data(), id: x.id } as CommunityListing))
      .filter(x => checkKind(x.communityKind))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  },
  /** Tin cộng đồng đang hiện của một người (trang hồ sơ công khai). */
  async byOwner(uid: string): Promise<CommunityListing[]> {
    const snapshot = await getDocs(query(collection(firestore, 'listings'), where('sellerId', '==', uid), where('isCommunityFree', '==', true), where('status', '==', 'approved'), limit(100)));
    return snapshot.docs
      .map(x => ({ ...x.data(), id: x.id } as CommunityListing))
      .filter(x => checkKind(x.communityKind) && x.isCommunityFree === true)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  },
  /** Tin gần đây của chính mình (mọi trạng thái) cho khung "Tin của bạn" ở trang chủ. */
  async mineRecent(uid: string, days = 14): Promise<CommunityListing[]> {
    const snap = await getDocs(query(collection(firestore, 'listings'), where('sellerId', '==', uid), where('isCommunityFree', '==', true), limit(40)));
    const since = new Date(Date.now() - days * 864e5).toISOString();
    return snap.docs.map(x => ({ ...x.data(), id: x.id } as CommunityListing))
      .filter(x => ['pending', 'approved', 'rejected'].includes(String(x.status)) && String(x.createdAt || '') >= since)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  },
  /** Đánh dấu đã xong hoặc ẩn tin của mình (rules chỉ cho 2 trạng thái này). */
  async setMyStatus(id: string, status: 'sold' | 'hidden'): Promise<void> {
    await db.updateListingStatus(id, status);
  },
  /** Gia hạn tin đã hết hạn (sau 30 ngày): hiện lại, nội dung giữ nguyên. */
  async renew(id: string): Promise<void> {
    await updateDoc(doc(firestore, 'listings', id), { status: 'approved', renewedAt: serverTimestamp() });
  },
  async remove(id: string): Promise<void> {
    await db.deleteListing(id);
  },
  // --- Lưu tin: dùng lại bảng favorites/<uid> của bản cũ ---
  async savedIds(uid: string): Promise<string[]> {
    try { return (await db.getFavorites(uid)) || []; } catch (_) { return []; }
  },
  async toggleSave(uid: string, listingId: string): Promise<void> {
    await db.toggleFavorite(uid, listingId);
  },
  async saved(uid: string): Promise<CommunityListing[]> {
    const ids = (await community.savedIds(uid)).slice(-60).reverse();
    const items = await Promise.all(ids.map(id => community.detail(id).catch(() => null)));
    return items.filter((x): x is CommunityListing => !!x && x.status === 'approved');
  },
  async detail(id: string): Promise<CommunityListing | null> {
    const item = await db.getListingById(id) as CommunityListing | null;
    return item && checkKind(item.communityKind) && item.isCommunityFree === true && item.price === 0
      ? item : null;
  },
  async create(user: User, input: CommunityPostInput): Promise<string> {
    const uid = currentUid();
    if (uid !== user.id) throw new Error('Tài khoản đăng tin chưa đúng.');
    const title = safeText(input.title, 90);
    const description = safeText(input.description, 900);
    const location = safeText(input.location, 100);
    if (title.length < 5) throw new Error('Hãy viết tên món đồ hoặc việc cần giúp (ít nhất 5 ký tự).');
    if (!location) throw new Error('Hãy nhập xã/phường hoặc khu vực của bạn.');
    if (!checkKind(input.kind) || !['have', 'need'].includes(input.intent)) throw new Error('Lựa chọn không hợp lệ.');
    // Ảnh lưu trên Firebase Storage cũ (listings/<uid>/...), nén trước khi tải.
    const photos = (input.photos || []).slice(0, MAX_PHOTOS);
    const { images, thumbs } = await uploadPhotos(uid, photos);
    // Chỉ chia sẻ vị trí đã làm mờ khi người dùng chủ động cho phép.
    const lat = input.approximateCoords?.lat;
    const lng = input.approximateCoords?.lng;
    const safe = typeof lat === 'number' && typeof lng === 'number' &&
      Number.isFinite(lat) && Number.isFinite(lng) &&
      Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    // Có GPS (đã đồng ý): làm tròn ~1 km. Không có: đặt ở tâm xã/phường (thông tin công khai).
    const wp = input.wardPoint;
    const safeLat = safe ? Math.round(lat! * 100) / 100 : (wp ? Math.round(wp.lat * 1e4) / 1e4 : null);
    const safeLng = safe ? Math.round(lng! * 100) / 100 : (wp ? Math.round(wp.lng * 1e4) / 1e4 : null);
    // Mã tỉnh/thành để trang chủ lọc tin theo khu vực
    // (chưa chọn xã/phường trong danh sách thì đoán từ chữ đã gõ, ít nhất ra tỉnh/thành)
    let provinceCode: string | null = null;
    let guessPt: { lat: number; lng: number } | null = safeLat == null ? null : { lat: safeLat, lng: safeLng as number };
    let areaCode: string | null = input.wardPoint?.code || null;
    try {
      const { loadDvhc, wardFromLabel, provinceFromLabel } = await import('../utils/dvhc');
      if (areaCode) provinceCode = (await loadDvhc()).wards.find(w => w.code === areaCode)?.provinceCode || null;
      if (!provinceCode) {
        const w = await wardFromLabel(location, input.areaHint);
        if (w) { areaCode = areaCode || w.code; provinceCode = w.provinceCode; if (guessPt === null) guessPt = { lat: Math.round(w.lat * 1e4) / 1e4, lng: Math.round(w.lng * 1e4) / 1e4 }; }
        else provinceCode = (await provinceFromLabel(location))?.code || null;
      }
    } catch (_) { /* bỏ qua */ }
    // Dữ liệu được lưu ngay trong listings cũ, không làm thay đổi các tin cũ.
    return db.saveListing({
      title, description, location, address: '', lat: guessPt?.lat ?? null, lng: guessPt?.lng ?? null,
      price: 0, tier: 'free', isCommunityFree: true,
      communityKind: input.kind, communityIntent: input.intent,
      category: 'cong-dong', parentCategory: null,
      sellerId: uid, sellerName: user.name || 'Thành viên',
      sellerAvatar: user.avatar || '', sellerPhone: '',
      images, thumbs, videoUrl: null, isAuction: false, affiliateLink: null,
      condition: 'used', status: 'pending', attributes: {},
      meetPlace: safeText(input.meetPlace || '', 60),
      areaCode,
      provinceCode,
      ...(input.pickupTimes ? { pickupTimes: safeText(input.pickupTimes, 80) } : {}),
      ...(input.pickupNote ? { pickupNote: safeText(input.pickupNote, 200) } : {}),
      ...(input.quantity != null ? { quantity: Math.max(0, Math.min(99, Math.round(input.quantity))) } : {}),
    });
  },
  async request(item: CommunityListing, message: string): Promise<string> {
    const requesterId = currentUid();
    if (item.sellerId === requesterId) throw new Error('Bạn không thể gửi yêu cầu cho tin của mình.');
    const clean = safeText(message, 500);
    if (!clean) throw new Error('Hãy viết một lời nhắn ngắn.');
    const id = item.id + '_' + requesterId;
    const listingRef = doc(firestore, 'listings', item.id);
    const requestRef = doc(firestore, 'communityRequests', id);
    // Kiểm tra đã gửi chưa. Với yêu cầu chưa tồn tại, rules trả "không có quyền"
    // (vì chưa có người tham gia) — coi như chưa gửi.
    // Công bằng: mỗi người tối đa 5 việc đang dở (chưa xong, chưa hủy) cùng lúc.
    const open = (await community.mine()).filter(r => r.requesterId === requesterId &&
      ['requested', 'accepted', 'handed_over', 'returned'].includes(r.status));
    if (open.length >= MAX_OPEN_REQUESTS && !open.some(r => r.listingId === item.id))
      throw new Error('Bạn đang có ' + open.length + ' yêu cầu chưa xong. Hãy hoàn thành hoặc hủy bớt để người khác cũng có cơ hội nhé.');
    let alreadySent = false;
    try { alreadySent = (await getDoc(requestRef)).exists(); }
    catch (e: any) { if (e?.code !== 'permission-denied') throw e; }
    if (alreadySent) throw new Error('Bạn đã gửi yêu cầu cho tin này. Xem ở mục Yêu cầu.');
    try {
    await runTransaction(firestore, async tx => {
      const listing = await tx.get(listingRef);
      if (!listing.exists()) throw new Error('Tin đăng không còn tồn tại.');
      const actual = listing.data() as CommunityListing;
      if (actual.status !== 'approved' || actual.isCommunityFree !== true ||
          actual.price !== 0 || !checkKind(actual.communityKind))
        throw new Error('Tin không còn nhận yêu cầu.');
      if (actual.sellerId === requesterId) throw new Error('Đây là tin của bạn.');
      tx.set(requestRef, {
        listingId: item.id, listingTitle: actual.title, kind: actual.communityKind,
        intent: actual.communityIntent === 'need' ? 'need' : 'have',
        ownerId: actual.sellerId, requesterId,
        message: clean, status: 'requested',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
    });
    } catch (error: any) {
      // Giai đoạn chuyển đổi: dùng chat thật đã triển khai nếu collection mới chưa được cấp quyền.
      if (error?.code !== 'permission-denied') throw error;
      const requester = await db.getUserProfile(requesterId);
      if (!requester) throw new Error('Không tìm thấy hồ sơ đăng nhập.');
      const roomId = await db.createChatRoom(item, requester);
      await db.addMessage(roomId, {
        senderId: requesterId,
        text: '🌿 Yêu cầu chia sẻ: ' + clean,
        type: 'text'
      });
      return 'chat:' + roomId;
    }
    try {
      await db.sendNotification({
        userId: item.sellerId, title: 'Có người muốn kết nối 🌱',
        message: 'Bạn vừa nhận một yêu cầu cho tin: ' + item.title,
        type: 'info', link: '/cong-dong/yeu-cau', requestId: id
      });
    } catch (err) { console.warn('Yêu cầu đã lưu nhưng thông báo chưa gửi được', err); }
    return id;
  },
  async mine(): Promise<CommunityRequest[]> {
    const uid = currentUid();
    const root = collection(firestore, 'communityRequests');
    const [owned, asked] = await Promise.all([
      getDocs(query(root, where('ownerId', '==', uid))),
      getDocs(query(root, where('requesterId', '==', uid)))
    ]);
    const result = new Map<string, CommunityRequest>();
    for (const snapshot of [owned, asked])
      for (const row of snapshot.docs) result.set(row.id, { ...row.data(), id: row.id } as CommunityRequest);
    return [...result.values()].sort((a, b) => {
      const x = a.createdAt?.toMillis?.() || 0;
      const y = b.createdAt?.toMillis?.() || 0;
      return y - x;
    });
  },

  /** Sửa tin của mình: tin quay về chờ máy kiểm tra lại. */
  async edit(id: string, input: { title: string; description: string; meetPlace: string; keepImages: string[]; keepThumbs: string[]; photos: File[];
    extra?: { pickupTimes?: string; pickupNote?: string; quantity?: number | null } }): Promise<void> {
    const uid = currentUid();
    const title = safeText(input.title, 90);
    if (title.length < 5) throw new Error('Hãy viết tên món đồ hoặc việc cần giúp (ít nhất 5 ký tự).');
    const room = Math.max(0, MAX_PHOTOS - input.keepImages.length);
    const up = await uploadPhotos(uid, (input.photos || []).slice(0, room));
    const { generateKeywords } = await import('../utils/format');
    await updateDoc(doc(firestore, 'listings', id), {
      title, description: safeText(input.description, 900), meetPlace: safeText(input.meetPlace || '', 60),
      images: [...input.keepImages, ...up.images].slice(0, MAX_PHOTOS),
      thumbs: [...input.keepThumbs, ...up.thumbs].slice(0, MAX_PHOTOS),
      keywords: generateKeywords(title),
      status: 'pending', editedAt: serverTimestamp(),
      // Chỉ gửi trường mới khi có thay đổi (quy tắc cũ chưa có các trường này vẫn sửa được tin)
      ...(input.extra && 'pickupTimes' in input.extra ? { pickupTimes: safeText(input.extra.pickupTimes || '', 80) } : {}),
      ...(input.extra && 'pickupNote' in input.extra ? { pickupNote: safeText(input.extra.pickupNote || '', 200) } : {}),
      ...(input.extra && 'quantity' in input.extra ? { quantity: input.extra.quantity ?? null } : {}),
    });
  },

  /** Danh sách người mình đã chặn. */
  async blockedIds(uid: string): Promise<string[]> {
    try { const s = await getDoc(doc(firestore, 'users', uid)); return (s.data()?.blockedIds as string[]) || []; } catch (_) { return []; }
  },
  async setBlocked(otherId: string, on: boolean): Promise<void> {
    const uid = currentUid();
    if (otherId === uid) return;
    await updateDoc(doc(firestore, 'users', uid), { blockedIds: on ? arrayUnion(otherId) : arrayRemove(otherId) });
  },

  /** Lời cảm ơn */
  async thanksFor(giverId: string, max = 20): Promise<ThankNote[]> {
    try {
      const s = await getDocs(query(collection(firestore, 'thanks'), where('giverId', '==', giverId), orderBy('createdAt', 'desc'), limit(max)));
      return s.docs.map(d => ({ id: d.id, ...d.data() } as ThankNote));
    } catch (_) { return []; }
  },
  async thankFor(requestId: string): Promise<ThankNote | null> {
    try { const s = await getDoc(doc(firestore, 'thanks', requestId)); return s.exists() ? ({ id: s.id, ...s.data() } as ThankNote) : null; } catch (_) { return null; }
  },
  async sendThanks(r: CommunityRequest, user: User, message: string, photo?: File | null): Promise<void> {
    const uid = currentUid();
    if (r.status !== 'completed' || receiverOf(r) !== uid) throw new Error('Chỉ người nhận gửi lời cảm ơn sau khi đã xong.');
    const text = safeText(message, 300);
    if (text.length < 2) throw new Error('Hãy viết vài chữ cảm ơn nhé.');
    let photoUrl: string | null = null;
    if (photo) photoUrl = (await uploadPhotos(uid, [photo])).thumbs[0] || null;
    const giverId = giverOf(r);
    await setDoc(doc(firestore, 'thanks', r.id), {
      giverId, receiverId: uid, receiverName: (user.name || 'Thành viên').slice(0, 60), receiverAvatar: (user.avatar || '').slice(0, 600),
      listingId: r.listingId, listingTitle: (r.listingTitle || '').slice(0, 120), kind: r.kind, message: text, photo: photoUrl,
      createdAt: serverTimestamp(),
    });
    await addDoc(collection(firestore, 'notifications'), {
      userId: giverId, title: (user.name || 'Một người') + ' gửi lời cảm ơn', message: text.slice(0, 200),
      type: 'thanks', link: '/profile/' + giverId, read: false, createdAt: new Date().toISOString(), requestId: r.id,
    }).catch(() => {});
  },

  /** Đã chọn được người nhận: từ chối nhẹ nhàng những người còn lại đang chờ. */
  async declineOthers(listingId: string, keepId: string): Promise<number> {
    const all = await community.mine();
    const others = all.filter(x => x.listingId === listingId && x.id !== keepId && x.status === 'requested');
    let n = 0;
    for (const r of others) { try { await community.updateStatus(r, 'declined'); n++; } catch (_) { /* bỏ qua */ } }
    return n;
  },
  async updateStatus(r: CommunityRequest, status: CommunityStatus): Promise<void> {
    const uid = currentUid();
    const ref = doc(firestore, 'communityRequests', r.id);
    let receiverId = '';
    await runTransaction(firestore, async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists()) throw new Error('Không tìm thấy yêu cầu.');
      const fresh = { ...snapshot.data(), id: snapshot.id } as CommunityRequest;
      if (!nextStatuses(fresh, uid).includes(status)) throw new Error('Bạn không thể thực hiện thao tác này.');
      receiverId = uid === fresh.ownerId ? fresh.requesterId : fresh.ownerId;
      tx.update(ref, { status, updatedAt: serverTimestamp() });
    });
    // Đóng tin đúng lúc (chỉ chủ tin được đổi trạng thái tin):
    // - Tin "Tôi có" cho tặng: đồ đã trao thì tin đóng.
    // - Tin "Tôi cần": nhu cầu đã được đáp ứng thì tin đóng.
    // - Tin "Tôi có" cho mượn/giúp/sửa: giữ mở để giúp người khác tiếp.
    const need = r.intent === 'need';
    const close = uid === r.ownerId && (
      (!need && r.kind === 'gift' && status === 'handed_over') ||
      (need && (status === 'completed' || (r.kind === 'borrow' && status === 'returned')))
    );
    // Mốc tiến trình hiện giữa dòng chat (phòng chat id = <người hỏi>_<tin>)
    const EVENT_TEXT: Partial<Record<CommunityStatus, string>> = {
      accepted: 'đã đồng ý', declined: 'đã từ chối', cancelled: 'đã hủy',
      handed_over: r.kind === 'help' ? 'báo đã giúp xong' : r.kind === 'repair' ? 'báo đã sửa xong' : r.kind === 'borrow' ? 'đã giao đồ cho mượn' : 'báo đã trao đồ',
      returned: 'báo đã trả đồ',
      completed: r.kind === 'borrow' ? 'xác nhận đã nhận lại đồ · Hoàn thành' : r.kind === 'gift' ? 'xác nhận đã nhận đồ · Hoàn thành' : 'xác nhận đã xong · Hoàn thành',
    };
    let posted = false; // đã báo qua chat thì không gửi thêm thông báo riêng
    if (EVENT_TEXT[status]) {
      try { await db.addMessage(r.requesterId + '_' + r.listingId, { senderId: uid, text: EVENT_TEXT[status]!, type: 'event' }); posted = true; } catch (_) { /* phòng chat có thể chưa có */ }
    }
    if (close) {
      try { await db.updateListingStatus(r.listingId, 'sold'); } catch (_) { /* chủ tin vẫn tự đóng được ở trang Cá nhân */ }
    }
    if (receiverId && !posted) {
      try {
        await db.sendNotification({
          userId: receiverId, title: 'Cập nhật yêu cầu 🌱',
          message: r.listingTitle + ': ' + (status === 'handed_over' ? 'bên kia báo đã xong, hãy vào xác nhận.' : status === 'returned' ? 'bên mượn báo đã trả đồ, hãy xác nhận đã nhận lại.' : statusLabels[status]),
          type: 'info', link: '/cong-dong/yeu-cau', requestId: r.id
        });
      } catch (err) { console.warn('Trạng thái đã lưu nhưng thông báo chưa gửi được', err); }
    }
  },
  /** Số lần đã chia sẻ xong (tin cộng đồng đã đóng) của một người. */
  async doneCount(uid: string): Promise<number> {
    try {
      const snap = await getDocs(query(collection(firestore, 'listings'), where('sellerId', '==', uid), where('isCommunityFree', '==', true), where('status', '==', 'sold'), limit(200)));
      return snap.size;
    } catch (_) { return 0; }
  },
  /**
   * Một chạm "Xin món này" / "Tôi giúp được": tạo yêu cầu (nếu chưa có),
   * mở phòng chat với người đăng và gửi lời nhắn đầu tiên. Trả về id phòng chat.
   */
  async askAndOpenChat(item: CommunityListing, user: User, message: string): Promise<string> {
    let isNew = true;
    try {
      const r = await community.request(item, message);
      if (r.startsWith('chat:')) return r.slice(5);
    } catch (e: any) {
      if (String(e?.message || '').includes('đã gửi yêu cầu')) isNew = false;
      else throw e;
    }
    const room = await db.createChatRoom(item, user);
    if (isNew) {
      try { await db.addMessage(room, { senderId: user.id, text: message, type: 'text' }); } catch (_) { /* phòng vẫn mở được */ }
    }
    return room;
  },
  /** Đọc một lần yêu cầu gắn với phòng chat (null nếu không có). */
  async requestForRoom(roomId: string, listingId: string): Promise<CommunityRequest | null> {
    if (!roomId.endsWith('_' + listingId)) return null;
    const requesterId = roomId.slice(0, roomId.length - listingId.length - 1);
    try {
      const snap = await getDoc(doc(firestore, 'communityRequests', listingId + '_' + requesterId));
      return snap.exists() ? ({ ...snap.data(), id: snap.id } as CommunityRequest) : null;
    } catch (_) { return null; }
  },
  /** Theo dõi trực tiếp yêu cầu gắn với một phòng chat (phòng id = <người hỏi>_<tin>). */
  watchRequestForRoom(roomId: string, listingId: string, cb: (r: CommunityRequest | null) => void): () => void {
    if (!roomId.endsWith('_' + listingId)) { cb(null); return () => {}; }
    const requesterId = roomId.slice(0, roomId.length - listingId.length - 1);
    const ref = doc(firestore, 'communityRequests', listingId + '_' + requesterId);
    return onSnapshot(ref,
      snap => cb(snap.exists() ? ({ ...snap.data(), id: snap.id } as CommunityRequest) : null),
      () => cb(null));
  },
  async startChat(item: CommunityListing, user: User): Promise<string> {
    currentUid();
    if (user.id === item.sellerId) throw new Error('Chọn yêu cầu của người nhận để liên hệ.');
    return db.createChatRoom(item, user);
  }
};
