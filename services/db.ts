// services/db.ts

// 1. IMPORT CÁC THƯ VIỆN CẦN THIẾT
import { initializeApp, getApp, getApps } from "firebase/app";
import { 
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  query, where, orderBy, limit, addDoc, serverTimestamp, Timestamp, 
  deleteDoc, onSnapshot, arrayUnion, arrayRemove, runTransaction,
  startAfter, QueryDocumentSnapshot, DocumentData, writeBatch,
  getCountFromServer 
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { Listing, ChatRoom, User, Transaction, SubscriptionTier, Report, Notification, Review } from '../types';

// 2. CẤU HÌNH ADMIN EMAIL (Email nhận thông báo)
const ADMIN_EMAIL = "buivanbac@gmail.com"; 

export interface SystemSettings {
  pushPrice: number;
  pushDiscount?: number;
  tierDiscount: number;
  tierConfigs: {
    free: { price: number; maxImages: number; features: string[] };
    basic: { price: number; maxImages: number; features: string[] };
    pro: { price: number; maxImages: number; features: string[] };
  };
  bankName: string;
  accountNumber: string;
  accountName: string;
  beneficiaryQR?: string;
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

// 3. KHỞI TẠO FIREBASE
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const firestore = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// 4. OBJECT DB CHỨA TOÀN BỘ CÁC HÀM
export const db = {
  
  // --- A. QUẢN LÝ TIN ĐĂNG (LISTINGS) ---

  // Lấy tin VIP
  getVIPListings: async (max = 10) => {
    try {
      const q = query(
        collection(firestore, "listings"), 
        where("status", "==", "approved"),
        where("tier", "==", "pro"),
        orderBy("createdAt", "desc"),
        limit(max)
      );
      const snap = await getDocs(q);
      return {
        listings: snap.docs.map(d => ({ ...d.data(), id: d.id } as Listing)),
        error: null
      };
    } catch (e: any) {
      return { listings: [], error: e.toString() };
    }
  },

  // Lấy danh sách tin có phân trang & lọc
  getListingsPaged: async (options: {
    pageSize: number,
    lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
    categoryId?: string,
    sellerId?: string,
    status?: string,
    search?: string,
    location?: string
  }) => {
    try {
      const colRef = collection(firestore, "listings");
      let constraints: any[] = [];

      if (options.status) {
          constraints.push(where("status", "==", options.status));
      } else if (!options.sellerId && !options.search) {
          constraints.push(where("status", "==", "approved"));
      }

      if (options.categoryId) constraints.push(where("category", "==", options.categoryId));
      if (options.sellerId) constraints.push(where("sellerId", "==", options.sellerId));
      if (options.location) constraints.push(where("location", "==", options.location));

      constraints.push(orderBy("createdAt", "desc"));
      constraints.push(limit(options.pageSize));

      if (options.lastDoc) {
        constraints.push(startAfter(options.lastDoc));
      }

      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      
      const results = snap.docs.map(d => ({ ...d.data(), id: d.id } as Listing));
      const lastVisible = snap.docs[snap.docs.length - 1] || null;

      let finalResults = results;
      if (options.search) {
        const s = options.search.toLowerCase();
        finalResults = results.filter(l => 
          l.title.toLowerCase().includes(s) || 
          l.description.toLowerCase().includes(s)
        );
      }

      return {
        listings: finalResults,
        lastDoc: lastVisible,
        hasMore: snap.docs.length === options.pageSize,
        error: null
      };
    } catch (e: any) {
      console.error("Get listings error:", e);
      return { listings: [], lastDoc: null, hasMore: false, error: e.toString() };
    }
  },

  getListings: async (includeHidden = false): Promise<Listing[]> => {
    const colRef = collection(firestore, "listings");
    let q = includeHidden 
      ? query(colRef, orderBy("createdAt", "desc"))
      : query(colRef, where("status", "==", "approved"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Listing));
  },

  // THÊM MỚI: Lấy chi tiết 1 tin (Tối ưu tốc độ load trang ListingDetail)
  getListingById: async (id: string): Promise<Listing | null> => {
    try {
      const docRef = doc(firestore, "listings", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Listing;
      }
      return null;
    } catch (e) {
      console.error("Error getting listing:", e);
      return null;
    }
  },

  // [QUAN TRỌNG] ĐĂNG TIN + GỬI MAIL ADMIN (Đã cập nhật để lưu attributes)
  saveListing: async (listingData: any) => {
    try {
      // 1. Chuẩn bị dữ liệu (Đảm bảo có attributes và createdAt)
      const dataToSave = {
        ...listingData,
        createdAt: new Date().toISOString(),
        status: listingData.status || 'pending',
        attributes: listingData.attributes || {} // Đảm bảo lưu thông số chi tiết
      };

      // 2. Lưu tin vào Firestore
      const docRef = await addDoc(collection(firestore, "listings"), dataToSave);
      
      // 3. Gửi Email thông báo Admin (buivanbac@gmail.com)
      await addDoc(collection(firestore, "mail"), {
        to: [ADMIN_EMAIL],
        message: {
          subject: `[Tin Mới] ${listingData.title} - Cần duyệt`,
          html: `
            <h3>Có người đăng tin bán hàng mới!</h3>
            <p><strong>Tiêu đề:</strong> ${listingData.title}</p>
            <p><strong>Giá:</strong> ${Number(listingData.price).toLocaleString()} VNĐ</p>
            <p><strong>Danh mục:</strong> ${listingData.category}</p>
            <p><strong>ID Người bán:</strong> ${listingData.sellerId}</p>
            <p>Vui lòng vào trang Admin để kiểm duyệt.</p>
          `
        }
      });

      return docRef.id;
    } catch (e) {
      console.error("Lỗi đăng tin:", e);
      throw e;
    }
  },

  updateListingStatus: async (listingId: string, status: 'approved' | 'rejected') => {
    await updateDoc(doc(firestore, "listings", listingId), { status });
  },

  deleteListing: async (id: string) => await deleteDoc(doc(firestore, "listings", id)),

  // Update nội dung tin (Admin/User sửa tin)
  updateListingContent: async (listingId: string, data: Partial<Listing>) => {
    try {
      await updateDoc(doc(firestore, "listings", listingId), data);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // Xóa hàng loạt (Admin)
  deleteListingsBatch: async (ids: string[]) => {
    try {
      const batch = writeBatch(firestore);
      ids.forEach(id => {
        const ref = doc(firestore, "listings", id);
        batch.delete(ref);
      });
      await batch.commit();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // --- B. ĐẨY TIN (PUSH LISTING) ---
  pushListing: async (listingId: string, userId: string) => {
    const settings: any = await db.getSettings();
    const user = await db.getUserById(userId);
    
    const rawPrice = settings?.pushPrice || 20000;
    const discount = settings?.pushDiscount || 0;
    const price = rawPrice * (1 - discount / 100);

    if (!user || (user.walletBalance || 0) < price) return { success: false, message: "Ví không đủ tiền." };
    
    // Trừ tiền user
    await updateDoc(doc(firestore, "users", userId), { walletBalance: (user.walletBalance || 0) - price });
    // Cập nhật thời gian tin lên đầu
    await updateDoc(doc(firestore, "listings", listingId), { createdAt: new Date().toISOString() });

    // Gửi mail báo doanh thu (Tùy chọn, để biết có người đẩy tin)
    await addDoc(collection(firestore, "mail"), {
        to: [ADMIN_EMAIL],
        message: {
          subject: `[DOANH THU] User đẩy tin`,
          html: `User ${userId} vừa đẩy tin ${listingId}. Doanh thu: ${price} VNĐ.`
        }
    });

    return { success: true };
  },

  // --- C. GIAO DỊCH & VÍ (TRANSACTIONS) ---

  // [QUAN TRỌNG] NẠP TIỀN + GỬI MAIL ADMIN
  requestDeposit: async (userId: string, amount: number, method: string) => {
    try {
      const res = await addDoc(collection(firestore, "transactions"), {
        userId, amount, type: 'deposit', method, 
        description: `Nạp tiền qua ${method}`, 
        status: 'pending', 
        createdAt: new Date().toISOString()
      });

      // Gửi Email thông báo Admin
      await addDoc(collection(firestore, "mail"), {
        to: [ADMIN_EMAIL],
        message: {
          subject: `[NẠP TIỀN] ${amount.toLocaleString()} VNĐ qua ${method}`,
          html: `
            <h3 style="color:green">Có yêu cầu nạp tiền mới!</h3>
            <p><strong>User ID:</strong> ${userId}</p>
            <p><strong>Số tiền:</strong> ${amount.toLocaleString()} VNĐ</p>
            <p><strong>Hình thức:</strong> ${method}</p>
            <p>Hãy kiểm tra tài khoản ngân hàng và duyệt giao dịch này trong Admin.</p>
          `
        }
      });

      return res;
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // [QUAN TRỌNG] MUA VIP BẰNG VÍ + GỬI MAIL THÔNG BÁO
  buySubscriptionWithWallet: async (userId: string, tier: SubscriptionTier, price: number) => {
    const user = await db.getUserById(userId);
    if (!user || (user.walletBalance || 0) < price) return { success: false, message: "Số dư không đủ." };
    
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    
    await updateDoc(doc(firestore, "users", userId), {
      walletBalance: (user.walletBalance || 0) - price,
      subscriptionTier: tier,
      subscriptionExpires: expires.toISOString()
    });

    // Gửi Email thông báo doanh thu
    await addDoc(collection(firestore, "mail"), {
      to: [ADMIN_EMAIL],
      message: {
        subject: `[DOANH THU] User mua gói ${tier.toUpperCase()}`,
        html: `
          <h3 style="color:blue">Doanh thu mới từ Ví!</h3>
          <p>User <strong>${userId}</strong> đã mua gói <strong>${tier}</strong> bằng số dư ví.</p>
          <p>Giá trị: ${price.toLocaleString()} VNĐ.</p>
        `
      }
    });

    return { success: true };
  },

  // [QUAN TRỌNG] CHUYỂN KHOẢN MUA VIP + GỬI MAIL ADMIN
  requestSubscriptionTransfer: async (userId: string, tier: SubscriptionTier, price: number) => {
    try {
      const res = await addDoc(collection(firestore, "transactions"), {
        userId, amount: price, type: 'payment', 
        description: `Nâng cấp gói ${tier.toUpperCase()}`, 
        status: 'pending', 
        metadata: { targetTier: tier }, 
        createdAt: new Date().toISOString()
      });

      // Gửi Email thông báo Admin
      await addDoc(collection(firestore, "mail"), {
        to: [ADMIN_EMAIL],
        message: {
          subject: `[VIP PENDING] Yêu cầu duyệt gói ${tier.toUpperCase()}`,
          html: `
            <h3>Yêu cầu nâng cấp VIP qua Chuyển khoản</h3>
            <p><strong>User ID:</strong> ${userId}</p>
            <p><strong>Gói:</strong> ${tier.toUpperCase()}</p>
            <p><strong>Số tiền:</strong> ${price.toLocaleString()} VNĐ</p>
            <p>Vui lòng kiểm tra ngân hàng và duyệt giao dịch.</p>
          `
        }
      });

      return res;
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  approveTransaction: async (txId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      return await runTransaction(firestore, async (transaction) => {
        const txRef = doc(firestore, "transactions", txId);
        const txSnap = await transaction.get(txRef);
        if (!txSnap.exists()) throw new Error("Transaction not found");
        
        const txData = txSnap.data() as Transaction & { metadata?: any };
        if (txData.status !== 'pending') throw new Error("Transaction already processed");

        const userRef = doc(firestore, "users", txData.userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("User not found");
        
        const userData = userSnap.data() as User;

        if (txData.type === 'deposit') {
          transaction.update(userRef, { walletBalance: (userData.walletBalance || 0) + txData.amount });
        } else if (txData.type === 'payment' && txData.metadata?.targetTier) {
          const expires = new Date();
          expires.setDate(expires.getDate() + 30);
          transaction.update(userRef, { subscriptionTier: txData.metadata.targetTier, subscriptionExpires: expires.toISOString() });
        }
        transaction.update(txRef, { status: 'success' });
        return { success: true };
      });
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  rejectTransaction: async (txId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      await updateDoc(doc(firestore, "transactions", txId), { status: 'failed' });
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  getTransactions: async (userId?: string): Promise<Transaction[]> => {
    const q = userId ? query(collection(firestore, "transactions"), where("userId", "==", userId)) : collection(firestore, "transactions");
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  // --- D. NGƯỜI DÙNG (USERS & AUTH) ---
  
  getCurrentUser: (): Promise<User | null> => {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          const userDoc = await getDoc(doc(firestore, "users", fbUser.uid));
          resolve(userDoc.exists() ? (userDoc.data() as User) : null);
        } else {
          resolve(null);
        }
        unsubscribe();
      });
    });
  },

  getUserById: async (id: string): Promise<User | undefined> => {
    const d = await getDoc(doc(firestore, "users", id));
    return d.exists() ? (d.data() as User) : undefined;
  },

  updateUserProfile: async (userId: string, updates: Partial<User>): Promise<User> => {
    const userRef = doc(firestore, "users", userId);
    await updateDoc(userRef, updates);
    const d = await getDoc(userRef);
    return d.data() as User;
  },

  getAllUsers: async (): Promise<User[]> => {
    const snap = await getDocs(collection(firestore, "users"));
    return snap.docs.map(d => d.data() as User);
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
    return newUser;
  },

  logout: async () => await signOut(auth),

  // --- E. HỆ THỐNG FOLLOW (MỚI - SỬ DỤNG COLLECTION RIÊNG) ---
  
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
  },

  unfollowUser: async (followerId: string, followedId: string) => {
    const followDocId = `${followerId}_${followedId}`;
    await deleteDoc(doc(firestore, "follows", followDocId));
  },

  getFollowStats: async (userId: string) => {
    try {
        const followersQuery = query(collection(firestore, "follows"), where("followedId", "==", userId));
        const followersSnap = await getCountFromServer(followersQuery);
        
        const followingQuery = query(collection(firestore, "follows"), where("followerId", "==", userId));
        const followingSnap = await getCountFromServer(followingQuery);

        return {
            followers: followersSnap.data().count,
            following: followingSnap.data().count
        };
    } catch (e) {
        console.error("Get follow stats failed:", e);
        return { followers: 0, following: 0 };
    }
  },

  toggleFollow: async (uId: string, tId: string) => {
     const isFollowing = await db.checkIsFollowing(uId, tId);
     if (isFollowing) {
         await db.unfollowUser(uId, tId);
     } else {
         await db.followUser(uId, tId);
     }
  },

  // --- F. CÁC TÍNH NĂNG KHÁC (Review, Chat, Report, System) ---

  getReviews: (targetId: string, targetType: 'listing' | 'user', callback: (reviews: Review[]) => void) => {
    const q = query(
      collection(firestore, "reviews"), 
      where("targetId", "==", targetId),
      where("targetType", "==", targetType)
    );
    return onSnapshot(q, (snapshot) => {
      const reviews = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Review));
      callback(reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
  },

  addReview: async (reviewData: Omit<Review, 'id' | 'createdAt'>) => {
    const res = await addDoc(collection(firestore, "reviews"), { ...reviewData, createdAt: new Date().toISOString() });
    return res.id;
  },

  getNotifications: (userId: string, callback: (notifs: Notification[]) => void) => {
    const q = query(collection(firestore, "notifications"), where("userId", "==", userId));
    return onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
      callback(notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
  },

  markNotificationAsRead: async (notifId: string) => {
    await updateDoc(doc(firestore, "notifications", notifId), { read: true });
  },

  sendNotification: async (notif: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
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

  updateSettings: async (settings: any) => {
    await setDoc(doc(firestore, "system", "settings"), settings);
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

  getChatRooms: (uId: string, cb: any) => {
    const q = query(collection(firestore, "chats"), where("participantIds", "array-contains", uId));
    return onSnapshot(q, (s) => {
      const rooms = s.docs.map(d => ({...d.data(), id: d.id} as ChatRoom));
      cb(rooms.sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime()));
    });
  },
  
  getChatRoom: async (id: string) => {
    const d = await getDoc(doc(firestore, "chats", id));
    return d.exists() ? ({...d.data(), id: d.id} as ChatRoom) : undefined;
  },
  
  addMessage: async (id: string, m: any) => {
    const ref = doc(firestore, "chats", id);
    const msg = { id: Date.now().toString(), ...m, timestamp: new Date().toISOString() };
    await updateDoc(ref, { messages: arrayUnion(msg), lastMessage: m.text, lastUpdate: msg.timestamp, seenBy: [m.senderId] });
  },

  markRoomAsSeen: async (id: string, userId: string) => {
    await updateDoc(doc(firestore, "chats", id), { seenBy: arrayUnion(userId) });
  },
  
  createChatRoom: async (l: any, bId: string) => {
    const q = query(collection(firestore, "chats"), where("listingId", "==", l.id), where("participantIds", "array-contains", bId));
    const s = await getDocs(q);
    if (!s.empty) return s.docs[0].id;
    const res = await addDoc(collection(firestore, "chats"), {
      listingId: l.id, listingTitle: l.title, listingImage: l.images[0], listingPrice: l.price,
      participantIds: [bId, l.sellerId], messages: [], lastUpdate: new Date().toISOString(), seenBy: [bId]
    });
    return res.id;
  },

  init: () => {}
};
