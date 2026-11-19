// services/db.ts

// 1. IMPORT CÁC THƯ VIỆN CẦN THIẾT
import { initializeApp, getApp, getApps } from "firebase/app";
import { 
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  query, where, orderBy, limit, addDoc, runTransaction,
  startAfter, QueryDocumentSnapshot, DocumentData, writeBatch,
  getCountFromServer, deleteDoc, arrayUnion, arrayRemove, 
  onSnapshot, increment 
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential
} from "firebase/auth";
import { getStorage, ref, uploadString, getDownloadURL, uploadBytes } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getMessaging, getToken, onMessage } from "firebase/messaging"; // <-- THÊM DÒNG NÀY Ở ĐẦU FILE
// Import Types
import { PublicProfile, Listing, ChatRoom, User, Transaction, SubscriptionTier, Report, AppNotification, Review, VerificationStatus, Offer, Category, Bid, Message, Story } from '../types';

// IMPORT LOGIC FORMAT
import { generateKeywords } from '../utils/format';

// 2. CẤU HÌNH ADMIN EMAIL
const ADMIN_EMAIL = "buivanbac@gmail.com"; 

// --- [MỚI] TIỆN ÍCH TÌM KIẾM THÔNG MINH (NÂNG CẤP V2) ---

const removeVietnameseTones = (str: string): string => {
    if (!str) return "";
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str.toLowerCase().trim();
};

const calculateSearchScore = (itemText: string, query: string): number => {
    if (!itemText || !query) return 0;
    
    const textLower = itemText.toLowerCase();
    const queryLower = query.toLowerCase();
    const textNoTone = removeVietnameseTones(itemText);
    const queryNoTone = removeVietnameseTones(query);

    if (textLower.includes(queryLower)) return 100; 
    if (textNoTone.includes(queryNoTone)) return 80;

    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
    const queryWordsNoTone = queryNoTone.split(/\s+/).filter(w => w.length > 0);
    const itemWords = textLower.split(/[\s,.-]+/).filter(w => w.length > 0);
    const itemWordsNoTone = textNoTone.split(/[\s,.-]+/).filter(w => w.length > 0);

    if (queryWords.length === 0) return 0;

    let score = 0;
    let matchCount = 0;

    queryWordsNoTone.forEach((wordNoTone, index) => {
        const wordWithTone = queryWords[index];
        if (itemWords.includes(wordWithTone)) {
            score += 20; 
            matchCount++;
        } else if (itemWordsNoTone.includes(wordNoTone)) {
            score += 5;
            matchCount++;
        }
    });

    if (queryWords.length > 1 && matchCount === 1 && score <= 5) return 0;

    const matchRatio = matchCount / queryWords.length;
    if (matchRatio >= 0.5) score += 10;
    if (matchRatio === 1) score += 20; 

    return score;
};

export interface AdZoneConfig {
  id: string;            
  name: string;         
  enabled: boolean;      
  type: 'image' | 'code' | 'text'; 
  image?: string;        
  link?: string; 
  textTitle?: string;    
  textDesc?: string;      
  textBtnLabel?: string;    
  code?: string;        
  interval?: number;    
  width?: string;        
  height?: string;  
  textColor?: string;    
  bgColor?: string;      
}

export interface SystemSettings {
  pushPrice: number;    
  pushDiscount: number; 
  tierDiscount: number; 
  bannerSlides?: any[]; 
  tierConfigs: {
    free: { name: string; price: number; maxImages: number; postsPerDay: number; autoApprove: boolean; features: string[]; allowVideo: boolean };
    basic: { name: string; price: number; maxImages: number; postsPerDay: number; autoApprove: boolean; features: string[]; allowVideo: boolean };
    pro: { name: string; price: number; maxImages: number; postsPerDay: number; autoApprove: boolean; features: string[]; allowVideo: boolean };
  };
  bankName: string;
  accountNumber: string;
  accountName: string;
  beneficiaryQR?: string;
  
  adsConfig: {
    home_below_categories: AdZoneConfig; 
    home_middle_banner: AdZoneConfig;    
    home_grid_left: AdZoneConfig;
    home_grid_right: AdZoneConfig;
    home_top_left: AdZoneConfig;
    home_top_right: AdZoneConfig;
    listing_sidebar_top: AdZoneConfig;    
    listing_below_desc: AdZoneConfig;      
    in_feed: AdZoneConfig;
    category_sidebar_right: AdZoneConfig;            
  };
}

const firebaseConfig = {
  apiKey: "AIzaSyD-kdwqMhAuddGMZRXMkQgbXIt4qukKObo",
  authDomain: "chocuatui-3e65c.firebaseapp.com",
  projectId: "chocuatui-3e65c",
  storageBucket: "chocuatui-3e65c.firebasestorage.app",
  messagingSenderId: "373357283352",
  appId: "1:373357283352:web:cb19a68560bf06a067db6d",
  measurementId: "G-CRKRLNGF8V"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const firestore = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const functions = getFunctions(app);
export { app, auth, storage, firestore };

export const db = {
  toSlug: (str: string) => {
    return str
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
      .replace(/[đĐ]/g, "d")
      .replace(/[^a-z0-9\s-]/g, "") 
      .trim()
      .replace(/\s+/g, "-");
  },

  getListingById: async (id: string): Promise<Listing | null> => {
    try {
      const docRef = doc(firestore, "listings", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Listing;
      }
      return null;
    } catch (e) { return null; }
  },

  saveListing: async (listingData: any) => {
    try {
      const seller = await db.getUserById(listingData.sellerId);
      let parentCategory = null;
      // Tin cộng đồng không dùng danh mục rao vặt -> không đọc bảng categories.
      if (listingData.category && listingData.isCommunityFree !== true) {
          const catDoc = await getDoc(doc(firestore, "categories", listingData.category));
          if (catDoc.exists()) {
              parentCategory = catDoc.data().parentId || null;
          }
      }

      // Tin cộng đồng: KHÔNG lấy tọa độ/địa chỉ chính xác từ hồ sơ người dùng.
      // Chỉ dùng vị trí gần đúng mà người dùng đã đồng ý chia sẻ khi đăng tin.
      const isCommunity = listingData.isCommunityFree === true;
      const finalLat = isCommunity ? (listingData.lat ?? null) : (listingData.lat || seller?.lat || null);
      const finalLng = isCommunity ? (listingData.lng ?? null) : (listingData.lng || seller?.lng || null);
      const finalLocation = listingData.location || seller?.location || "Toàn quốc";
      const finalAddress = isCommunity ? "" : (listingData.address || seller?.address || "");

      const dataToSave = {
        ...listingData,
        slug: db.toSlug(listingData.title),
        keywords: generateKeywords(listingData.title),
        viewCount: 0, 
        videoUrl: listingData.videoUrl || null, 
        lat: finalLat, 
        lng: finalLng,
        location: finalLocation,
        address: finalAddress,
        parentCategory: parentCategory,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: listingData.status || 'pending', 
        attributes: listingData.attributes || {} 
      };

      const docRef = await addDoc(collection(firestore, "listings"), dataToSave);
      
      try {
          await addDoc(collection(firestore, "mail"), {
            to: [ADMIN_EMAIL],
            message: {
              subject: `[Tin Mới] ${listingData.title} - Cần duyệt`,
              html: `
                <h3 style="color: #047857;">Có tin chia sẻ mới cần duyệt</h3>
                <p><strong>Tiêu đề:</strong> ${listingData.title}</p>
                <p><strong>Người đăng:</strong> ${listingData.sellerName}</p>
              `
            }
          });
      } catch (e) { console.warn("Lỗi gửi mail admin:", e); }

      return docRef.id;
    } catch (e) {
      console.error("Lỗi đăng tin:", e);
      throw e;
    }
  },

  updateListingStatus: async (listingId: string, status: 'approved' | 'rejected' | 'sold' | 'hidden') => {
    try {
      await updateDoc(doc(firestore, "listings", listingId), { status });
      
      const listing = await db.getListingById(listingId);
      if (listing) {
        if (status === 'sold' || status === 'hidden') return;

        const prettyLink = `/cong-dong/tin/${listingId}`;

        await db.sendNotification({
          userId: listing.sellerId,
          title: status === 'approved' ? 'Tin đăng đã được duyệt' : 'Tin đăng bị từ chối',
          message: `Tin "${listing.title}" của bạn đã được chuyển sang trạng thái ${status === 'approved' ? 'Đang hiển thị' : 'Từ chối'}.`,
          type: status === 'approved' ? 'success' : 'error',
          link: prettyLink
        });
      }
    } catch (error) { throw error; }
  },

  deleteListing: async (id: string) => await deleteDoc(doc(firestore, "listings", id)),

  getUserById: async (id: string): Promise<User | undefined> => {
    const d = await getDoc(doc(firestore, "users", id));
    return d.exists() ? { id: d.id, ...d.data() } as User : undefined;
  },

  // --- HỒ SƠ CÔNG KHAI (publicProfiles/<uid>) ---
  // Bảng users chứa email, SĐT, địa chỉ nên chỉ chủ tài khoản và admin đọc được.
  // Người khác chỉ thấy tên, ảnh, khu vực qua publicProfiles.
  toPublicProfile: (u: Partial<User> & { id: string }): PublicProfile => ({
    id: u.id,
    name: (u.name || 'Thành viên').slice(0, 60),
    avatar: u.avatar || '',
    location: (u.location || '').slice(0, 100),
    joinedAt: u.joinedAt || '',
  }),

  syncPublicProfile: async (u: Partial<User> & { id: string }) => {
    try {
      const p = db.toPublicProfile(u);
      // merge: giữ nguyên sharedCount/receivedCount do máy chủ tính
      await setDoc(doc(firestore, "publicProfiles", u.id), {
        name: p.name, avatar: p.avatar, location: p.location, joinedAt: p.joinedAt,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) { console.warn("Chưa đồng bộ được hồ sơ công khai", e); }
  },

  getPublicProfile: async (id: string): Promise<PublicProfile | null> => {
    try {
      const d = await getDoc(doc(firestore, "publicProfiles", id));
      if (d.exists()) return { ...(d.data() as any), id } as PublicProfile;
    } catch (_) { /* rules cũ chưa có publicProfiles */ }
    // Tài khoản cũ chưa có hồ sơ công khai: thử đọc bảng cũ (sẽ bị chặn khi rules mới có hiệu lực).
    try {
      const u = await db.getUserById(id);
      return u ? db.toPublicProfile(u) : null;
    } catch (_) { return null; }
  },

  // Admin: tạo hồ sơ công khai cho mọi tài khoản cũ (chạy một lần).
  // Ghi theo lô 200 hồ sơ; báo tiến độ và lỗi rõ ràng thay vì bỏ qua.
  backfillPublicProfiles: async (onProgress?: (done: number, total: number) => void) => {
    const snap = await getDocs(collection(firestore, "users"));
    const docs = snap.docs;
    let ok = 0, failed = 0, firstError = '';
    onProgress?.(0, docs.length);
    for (let i = 0; i < docs.length; i += 200) {
      const chunk = docs.slice(i, i + 200);
      const batch = writeBatch(firestore);
      for (const d of chunk) {
        const p = db.toPublicProfile({ ...(d.data() as User), id: d.id });
        batch.set(doc(firestore, "publicProfiles", d.id), {
          name: p.name, avatar: (p.avatar || '').slice(0, 600), location: p.location,
          joinedAt: typeof p.joinedAt === 'string' ? p.joinedAt : '', updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      try { await batch.commit(); ok += chunk.length; }
      catch (e: any) { failed += chunk.length; if (!firstError) firstError = e?.code || e?.message || 'lỗi không rõ'; }
      onProgress?.(i + chunk.length, docs.length);
    }
    return { total: docs.length, ok, failed, firstError };
  },

  getUserProfile: async (userId: string): Promise<User | null> => {
    try {
      const docRef = doc(firestore, "users", userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as User;
      }
      return null;
    } catch (error) {
      console.error("Lỗi lấy User Profile:", error);
      return null;
    }
  },

  onUserChange: (userId: string, callback: (user: User) => void) => {
    const userRef = doc(firestore, "users", userId);
    return onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = { id: docSnap.id, ...docSnap.data() } as User;
        callback(userData);
      }
    });
  },

  updateUserProfile: async (userId: string, updates: Partial<User>): Promise<User> => {
    const userRef = doc(firestore, "users", userId);
    await updateDoc(userRef, updates);
    const d = await getDoc(userRef);
    const updated = { ...(d.data() as User), id: userId };
    if ('name' in updates || 'avatar' in updates || 'location' in updates) await db.syncPublicProfile(updated);
    return updated;
  },

  login: async (email: string, pass: string): Promise<User> => {
    const res = await signInWithEmailAndPassword(auth, email, pass);
    const userDoc = await getDoc(doc(firestore, "users", res.user.uid));
    return userDoc.data() as User;
  },

  loginWithGoogle: async (): Promise<User> => {
    const provider = new GoogleAuthProvider();
    const res = await signInWithPopup(auth, provider);
    
    const userDocRef = doc(firestore, "users", res.user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      const newUser: User = {
        id: res.user.uid,
        name: res.user.displayName || "Người dùng mới",
        email: res.user.email || "",
        avatar: res.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${res.user.uid}`,
        role: 'user',
        status: 'active',
        joinedAt: new Date().toISOString(),
        subscriptionTier: 'free',
        walletBalance: 0,
        following: [],
        followers: [],
        verificationStatus: 'unverified'
      };
      await setDoc(userDocRef, newUser);
      return newUser;
    } else {
      return userDocSnap.data() as User;
    }
  },

  loginWithOneTap: async (credential: string): Promise<User> => {
    const googleCredential = GoogleAuthProvider.credential(credential);
    const res = await signInWithCredential(auth, googleCredential);
    
    const userDocRef = doc(firestore, "users", res.user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      const newUser: User = {
        id: res.user.uid,
        name: res.user.displayName || "Người dùng mới",
        email: res.user.email || "",
        avatar: res.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${res.user.uid}`,
        role: 'user',
        status: 'active',
        joinedAt: new Date().toISOString(),
        subscriptionTier: 'free',
        walletBalance: 0,
        following: [],
        followers: [],
        verificationStatus: 'unverified'
      };
      await setDoc(userDocRef, newUser);
      return newUser;
    } else {
      return userDocSnap.data() as User;
    }
  },

  register: async (email: string, pass: string, name: string): Promise<User> => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    const newUser: User = {
      id: res.user.uid,
      name,
      email,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${res.user.uid}`,
      role: 'user',
      status: 'active',
      joinedAt: new Date().toISOString(),
      subscriptionTier: 'free',
      walletBalance: 0,
      following: [],
      followers: [],
      verificationStatus: 'unverified'
    };
    await setDoc(doc(firestore, "users", res.user.uid), newUser);
    await db.syncPublicProfile(newUser);
    return newUser;
  },

  logout: async () => {
      await signOut(auth);
      localStorage.clear();
      sessionStorage.clear();
  },

  // --- E. HỆ THỐNG FOLLOW ---
  
  checkIsFollowing: async (followerId: string, followedId: string): Promise<boolean> => {
    try {
        const followDocId = `${followerId}_${followedId}`;
        const docRef = doc(firestore, "follows", followDocId);
        const snap = await getDoc(docRef);
        return snap.exists();
    } catch (e) {
        console.error("Check follow failed:", e);
        return false;
    }
  },

  followUser: async (followerId: string, followedId: string) => {
    const followDocId = `${followerId}_${followedId}`;
    await setDoc(doc(firestore, "follows", followDocId), {
        followerId,
        followedId,
        createdAt: new Date().toISOString()
    });

    const follower = await db.getUserById(followerId);
    
    await db.sendNotification({
      userId: followedId,
      title: 'Có người theo dõi mới',
      message: `${follower?.name || 'Một người dùng'} đã bắt đầu theo dõi bạn.`,
      type: 'follow',
      link: `/profile/${followerId}` 
    });
  },

  unfollowUser: async (followerId: string, followedId: string) => {
    const followDocId = `${followerId}_${followedId}`;
    await deleteDoc(doc(firestore, "follows", followDocId));
  },

  // Sửa 'Notification' thành 'AppNotification' ở 2 chỗ (tham số callback và ép kiểu as...)
  getNotifications: (userId: string, callback: (notifs: AppNotification[]) => void) => {
    const q = query(
      collection(firestore, "notifications"), 
      where("userId", "==", userId),
      orderBy("createdAt", "desc"), 
      limit(50) 
    );
    return onSnapshot(q, (snapshot) => {
      // Chỗ này cũng sửa as Notification thành as AppNotification
      const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
      callback(notifs);
    }, (error) => {
       // Silent error on permission denied (logout)
       if(error.code !== 'permission-denied') console.error(error);
    });
  },

  markNotificationAsRead: async (notifId: string) => {
    await updateDoc(doc(firestore, "notifications", notifId), { read: true });
  },

  sendNotification: async (notif: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => {
    await addDoc(collection(firestore, "notifications"), { ...notif, read: false, createdAt: new Date().toISOString() });
  },

  uploadImage: async (base64: string, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadString(storageRef, base64, 'data_url');
    return await getDownloadURL(storageRef);
  },

  getSettings: async (): Promise<SystemSettings | null> => {
    const d = await getDoc(doc(firestore, "system", "settings"));
    return d.exists() ? (d.data() as SystemSettings) : null;
  },

  getAllReports: async () => {
    const snap = await getDocs(collection(firestore, "reports"));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Report));
  },

  resolveReport: async (id: string) => await updateDoc(doc(firestore, "reports", id), { status: 'resolved' }),
  
  reportListing: async (r: any) => await addDoc(collection(firestore, "reports"), { ...r, status: 'pending', createdAt: new Date().toISOString() }),

  getFavorites: async (id: string) => {
    const d = await getDoc(doc(firestore, "favorites", id));
    return d.exists() ? d.data().listingIds : [];
  },
  
  toggleFavorite: async (uId: string, lId: string) => {
    const ref = doc(firestore, "favorites", uId);
    const d = await getDoc(ref);
    if (!d.exists()) await setDoc(ref, { listingIds: [lId] });
    else {
      const ids = d.data().listingIds;
      if (ids.includes(lId)) await updateDoc(ref, { listingIds: arrayRemove(lId) });
      else await updateDoc(ref, { listingIds: arrayUnion(lId) });
    }
  },

  // --- G. CHAT ---

  getChatRooms: (uId: string, cb: any) => {
    const q = query(collection(firestore, "chats"), where("participantIds", "array-contains", uId));
    return onSnapshot(q, (s) => {
      const rooms = s.docs.map(d => ({...d.data(), id: d.id} as ChatRoom));
      cb(rooms.sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime()));
    }, (error) => {
       if(error.code !== 'permission-denied') console.error(error);
    });
  },
  
  getChatRoom: async (id: string) => {
    try {
      const d = await getDoc(doc(firestore, "chats", id));
      return d.exists() ? ({...d.data(), id: d.id} as ChatRoom) : undefined;
    } catch (_) { return undefined; } // phòng chưa có hoặc không phải của mình
  },

  deleteChatRoom: async (roomId: string) => {
    try {
      await deleteDoc(doc(firestore, "chats", roomId));
      return { success: true };
    } catch (e: any) {
      console.error("Error deleting chat room:", e);
      throw e;
    }
  },

  // [HÀM MỚI] Nén ảnh để giảm dung lượng trước khi upload
  compressImage: (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const maxWidth = 1024; // Giới hạn chiều rộng 1024px
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Tính toán tỷ lệ để resize
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Nén xuống chất lượng 70% (0.7) dạng JPEG
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Nén ảnh thất bại"));
          }, 'image/jpeg', 0.7);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  },
  
  // [CẬP NHẬT] Upload ảnh có nén
  uploadChatImage: async (file: File): Promise<string> => {
    try {
      // 1. Nén ảnh
      const compressedBlob = await db.compressImage(file);
      
      // 2. Upload
      // Lưu trong thư mục của người gửi (Storage rules chỉ cho ghi users/<uid>/)
      const path = `users/${auth.currentUser?.uid}/chat/${Date.now()}.jpg`;
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, compressedBlob);
      
      // 3. Lấy URL
      return await getDownloadURL(snapshot.ref);
    } catch (e) {
      console.error("Lỗi upload ảnh chat:", e);
      throw e;
    }
  },

  // [CẬP NHẬT] Xử lý hiển thị preview cho các loại tin nhắn khác nhau
  addMessage: async (roomId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
    const roomRef = doc(firestore, "chats", roomId);
    
    const newMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString()
    };

    try {
      const roomSnap = await getDoc(roomRef);
      
      if (!roomSnap.exists()) {
          console.warn("Phòng chat không tồn tại, đang tự tạo lại...");
          await setDoc(roomRef, {
              id: roomId,
              lastUpdate: new Date().toISOString(),
              lastMessage: message.text || 'Tin nhắn mới',
              messages: [newMessage],
              participantIds: [message.senderId], 
              seenBy: [message.senderId]
          }, { merge: true });
      } else {
          // Tạo nội dung tóm tắt (Preview) dựa trên loại tin nhắn
          let previewText = message.text;
          if (message.type === 'image') previewText = '📷 Hình ảnh';
          else if (message.type === 'location') previewText = '📍 Vị trí';
          else if (message.type === 'offer') previewText = '💸 Đề nghị giá';
          else if (message.type === 'swap') previewText = '🔄 Đề nghị đổi đồ';
          else if (message.type === 'meet') previewText = 'Đề nghị hẹn: ' + message.text;
          else if (message.type === 'event') previewText = message.text;

          await updateDoc(roomRef, {
            messages: arrayUnion(newMessage),
            lastMessage: previewText,
            lastUpdate: new Date().toISOString(),
            seenBy: [message.senderId] 
          });

          // Gửi thông báo (Notification)
          const roomData = roomSnap.data() as ChatRoom;
          const receiverId = roomData.participantIds?.find(id => id !== message.senderId);

          if (receiverId) {
            const senderName = roomData.participantsData?.[message.senderId]?.name || "Ai đó";
            await db.sendNotification({
              userId: receiverId,
              title: `Tin nhắn mới từ ${senderName} 💬`,
              message: previewText,
              type: 'message',
              link: `/chat/${roomId}`,
              chatId: roomId
            });
          }
      }
    } catch (error) {
      console.error("Lỗi gửi tin nhắn:", error);
      throw error;
    }
  },

  deleteMessage: async (roomId: string, messageId: string) => {
    try {
      const roomRef = doc(firestore, "chats", roomId);
      const roomSnap = await getDoc(roomRef);
      if (roomSnap.exists()) {
        const data = roomSnap.data();
        if (data.messages) {
           const updatedMessages = data.messages.filter((m: any) => m.id !== messageId);
           await updateDoc(roomRef, { messages: updatedMessages });
        }
      }
    } catch (e) {
      console.error("Error deleting message:", e);
    }
  },

  markRoomAsSeen: async (id: string, userId: string) => {
    await updateDoc(doc(firestore, "chats", id), { seenBy: arrayUnion(userId) });
  },

  createChatRoom: async (l: Listing, buyer: User): Promise<string> => {
    try {
        const roomId = `${buyer.id}_${l.id}`;
        const roomRef = doc(firestore, "chats", roomId);
        // Phòng chưa tồn tại thì rules trả "không có quyền" (chưa có người tham gia).
        // Phòng có tên chứa id người hỏi nên nếu đã có, người này luôn đọc được.
        let roomExists = false;
        try { roomExists = (await getDoc(roomRef)).exists(); }
        catch (e: any) { if (e?.code !== 'permission-denied') throw e; }

        if (!roomExists) {
            const sellerName = l.sellerName || "Người bán";
            const sellerAvatar = l.sellerAvatar || "https://placehold.co/100?text=Seller";

            const newRoom: ChatRoom = {
                id: roomId,
                participantIds: [buyer.id, l.sellerId],
                participantsData: {
                  [buyer.id]: { name: buyer.name, avatar: buyer.avatar },
                  [l.sellerId]: { name: sellerName, avatar: sellerAvatar }
                },
                listingId: l.id,
                listingTitle: l.title,
                listingImage: l.images && l.images.length > 0 ? l.images[0] : 'https://placehold.co/100x100?text=Chat',
                listingPrice: l.price || 0,
                lastMessage: "Bắt đầu cuộc trò chuyện",
                lastUpdate: new Date().toISOString(),
                messages: [],
                seenBy: [buyer.id]
            };
            await setDoc(roomRef, newRoom);
        }
        return roomId;
    } catch (e) {
        console.error("Error creating chat room:", e);
        throw e;
    }
  },

  saveCategory: async (category: Category) => {
    try {
      await setDoc(doc(firestore, "categories", category.id), category);
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  // --- 4. HỆ THỐNG THÔNG BÁO ĐẨY (PUSH NOTIFICATION) ---
  
  // Hàm xin quyền và lưu Token (Đã cấu hình lại cho sw.js)
  requestNotificationPermission: async (userId: string) => {
    try {
      const messaging = getMessaging(app);
      
      // 1. Xin quyền trình duyệt
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        
        // ⚠️ BƯỚC QUAN TRỌNG: Đăng ký file sw.js thủ công
        let swRegistration;
        if ('serviceWorker' in navigator) {
            // Chỉ định rõ file của bạn là '/sw.js'
            swRegistration = await navigator.serviceWorker.register('/sw.js'); 
        }

        // 2. Lấy Token và truyền registration vào
        const token = await getToken(messaging, { 
          vapidKey: "BC-HSAKsOy5hvpSPgtlC52kwy8OWL2oX1jn4pIkzyRkcqgPzlzTkHe2Xa9rBPJYtGjygvoTcfaWmCxYCeFZrlMI",
          serviceWorkerRegistration: swRegistration // <--- DÒNG NÀY SỬA LỖI MIME TYPE
        });
        
        if (token) {
          console.log("✅ FCM Token:", token);
          await updateDoc(doc(firestore, "users", userId), {
            fcmToken: token,
            notificationsEnabled: true
          });
          return token;
        }
      } else {
        console.log("Quyền thông báo bị từ chối");
      }
    } catch (error) {
      console.error("Lỗi đăng ký Push Notification:", error);
    }
    return null;
  },
};