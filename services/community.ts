/**
 * Chợ Của Tui 2.0 — cộng đồng miễn phí trên Firebase hiện tại.
 * Không tạo cơ sở dữ liệu/tài khoản thứ hai. Không gọi API thanh toán.
 */
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  runTransaction, serverTimestamp
} from 'firebase/firestore';
import { auth, db, firestore } from './db';
import { compressAndGetBase64 } from '../utils/imageCompression';
import type { Listing, User } from '../types';

export type CommunityKind = 'gift' | 'borrow' | 'help' | 'repair';
export type CommunityIntent = 'have' | 'need';
export type CommunityStatus = 'requested' | 'accepted' | 'declined' | 'handed_over' | 'returned' | 'completed' | 'cancelled';
export interface CommunityListing extends Listing {
  communityKind?: CommunityKind;
  communityIntent?: CommunityIntent;
  isCommunityFree?: boolean;
}
export interface CommunityRequest {
  id: string;
  listingId: string;
  listingTitle: string;
  kind: CommunityKind;
  ownerId: string;
  requesterId: string;
  message: string;
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
}

const kinds: CommunityKind[] = ['gift', 'borrow', 'help', 'repair'];
export const MAX_PHOTOS = 4;
export const kindLabels: Record<CommunityKind, string> = {
  gift: 'Cho tặng', borrow: 'Mượn đồ', help: 'Giúp nhau', repair: 'Sửa đồ'
};
export const statusLabels: Record<CommunityStatus, string> = {
  requested: 'Đang chờ', accepted: 'Đã đồng ý', declined: 'Từ chối',
  handed_over: 'Đã giao đồ', returned: 'Đã trả đồ', completed: 'Hoàn thành', cancelled: 'Đã hủy'
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
export function nextStatuses(r: CommunityRequest, uid: string): CommunityStatus[] {
  if (r.status === 'requested' && r.ownerId === uid) return ['accepted', 'declined'];
  if (r.status === 'requested' && r.requesterId === uid) return ['cancelled'];
  if (r.status === 'accepted' && r.ownerId === uid) return r.kind === 'borrow' ? ['handed_over'] : ['completed'];
  if (r.status === 'handed_over' && r.kind === 'borrow' && r.requesterId === uid) return ['returned'];
  if (r.status === 'returned' && r.kind === 'borrow' && r.ownerId === uid) return ['completed'];
  return [];
}

export const community = {
  // Dùng truy vấn mà trang rao vặt cũ đang sử dụng; không yêu cầu migration/index mới.
  async list(): Promise<CommunityListing[]> {
    const snapshot = await getDocs(query(
      collection(firestore, 'listings'),
      where('status', '==', 'approved'), orderBy('createdAt', 'desc'), limit(250)
    ));
    return snapshot.docs
      .map(x => ({ ...x.data(), id: x.id } as CommunityListing))
      .filter(x => checkKind(x.communityKind) && x.isCommunityFree === true && x.price === 0);
  },
  /** Tin cộng đồng của chính mình, mọi trạng thái (chờ duyệt, đang hiện, đã xong, đã ẩn). */
  async mine(uid: string): Promise<CommunityListing[]> {
    const snapshot = await getDocs(query(collection(firestore, 'listings'), where('sellerId', '==', uid), limit(200)));
    return snapshot.docs
      .map(x => ({ ...x.data(), id: x.id } as CommunityListing))
      .filter(x => checkKind(x.communityKind))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  },
  /** Tin cộng đồng đang hiện của một người (trang hồ sơ công khai). */
  async byOwner(uid: string): Promise<CommunityListing[]> {
    const snapshot = await getDocs(query(collection(firestore, 'listings'), where('sellerId', '==', uid), where('status', '==', 'approved'), limit(100)));
    return snapshot.docs
      .map(x => ({ ...x.data(), id: x.id } as CommunityListing))
      .filter(x => checkKind(x.communityKind) && x.isCommunityFree === true)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  },
  /** Đánh dấu đã xong hoặc ẩn tin của mình (rules chỉ cho 2 trạng thái này). */
  async setMyStatus(id: string, status: 'sold' | 'hidden'): Promise<void> {
    await db.updateListingStatus(id, status);
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
    for (const photo of photos)
      if (!photo.type.startsWith('image/') || photo.size > 8 * 1024 * 1024)
        throw new Error('Mỗi ảnh phải là hình và dưới 8 MB.');
    const images: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const compressed = await compressAndGetBase64(photos[i]);
      images.push(await db.uploadImage(compressed, 'listings/' + uid + '/community-' + Date.now() + '-' + i + '.jpg'));
    }
    // Chỉ chia sẻ vị trí đã làm mờ khi người dùng chủ động cho phép.
    const lat = input.approximateCoords?.lat;
    const lng = input.approximateCoords?.lng;
    const safe = typeof lat === 'number' && typeof lng === 'number' &&
      Number.isFinite(lat) && Number.isFinite(lng) &&
      Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    const safeLat = safe ? Math.round(lat! * 100) / 100 : null;
    const safeLng = safe ? Math.round(lng! * 100) / 100 : null;
    // Dữ liệu được lưu ngay trong listings cũ, không làm thay đổi các tin cũ.
    return db.saveListing({
      title, description, location, address: '', lat: safeLat, lng: safeLng,
      price: 0, tier: 'free', isCommunityFree: true,
      communityKind: input.kind, communityIntent: input.intent,
      category: 'cong-dong', parentCategory: null,
      sellerId: uid, sellerName: user.name || 'Thành viên',
      sellerAvatar: user.avatar || '', sellerPhone: '',
      images, videoUrl: null, isAuction: false, affiliateLink: null,
      condition: 'used', status: 'pending', attributes: {}
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
    try {
    await runTransaction(firestore, async tx => {
      const listing = await tx.get(listingRef);
      const existing = await tx.get(requestRef);
      if (!listing.exists()) throw new Error('Tin đăng không còn tồn tại.');
      const actual = listing.data() as CommunityListing;
      if (actual.status !== 'approved' || actual.isCommunityFree !== true ||
          actual.price !== 0 || !checkKind(actual.communityKind))
        throw new Error('Tin không còn nhận yêu cầu.');
      if (actual.sellerId === requesterId) throw new Error('Đây là tin của bạn.');
      if (existing.exists()) throw new Error('Bạn đã gửi yêu cầu cho tin này.');
      tx.set(requestRef, {
        listingId: item.id, listingTitle: actual.title, kind: actual.communityKind,
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
        type: 'info', link: '/cong-dong/yeu-cau'
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
    // Không có API thu tiền/đặt cọc.
    if (status === 'completed' && r.kind === 'gift') {
      try { await db.updateListingStatus(r.listingId, 'sold'); } catch (_) { /* Tin vẫn giữ trạng thái an toàn */ }
    }
    if (receiverId) {
      try {
        await db.sendNotification({
          userId: receiverId, title: 'Cập nhật yêu cầu 🌱',
          message: 'Tin ' + r.listingTitle + ': ' + statusLabels[status],
          type: 'info', link: '/cong-dong/yeu-cau'
        });
      } catch (err) { console.warn('Trạng thái đã lưu nhưng thông báo chưa gửi được', err); }
    }
  },
  async startChat(item: CommunityListing, user: User): Promise<string> {
    currentUid();
    if (user.id === item.sellerId) throw new Error('Chọn yêu cầu của người nhận để liên hệ.');
    return db.createChatRoom(item, user);
  }
};
