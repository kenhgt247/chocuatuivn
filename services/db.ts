// services/db.ts

// 1. IMPORT CÁC THƯ VIỆN CẦN THIẾT
import { initializeApp, getApp, getApps } from "firebase/app";
import { 
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  query, where, orderBy, limit, addDoc, runTransaction,
  startAfter, QueryDocumentSnapshot, DocumentData, writeBatch,
  getCountFromServer, deleteDoc, arrayUnion, arrayRemove, 
  onSnapshot
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
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { Listing, ChatRoom, User, Transaction, SubscriptionTier, Report, Notification, Review } from '../types';

// IMPORT LOGIC TÌM KIẾM THÔNG MINH
import { isSearchMatch, calculateRelevanceScore } from '../utils/format';

// 2. CẤU HÌNH ADMIN EMAIL
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

// 4. OBJECT DB
export const db = {
  
  // --- A. QUẢN LÝ TIN ĐĂNG (LISTINGS) ---

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

  // HÀM LẤY DANH SÁCH TIN (HỖ TRỢ SMART SEARCH)
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
      
      // === TRƯỜNG HỢP 1: CÓ TỪ KHÓA TÌM KIẾM (SMART SEARCH) ===
      if (options.search && options.search.trim().length > 0) {
        let constraints: any[] = [
           where("status", "==", "approved"),
           orderBy("createdAt", "desc"),
           limit(500) // Giới hạn vùng tìm kiếm
        ];

        if (options.categoryId) constraints.push(where("category", "==", options.categoryId));
        if (options.location) constraints.push(where("location", "==", options.location));

        const q = query(colRef, ...constraints);
        const snap = await getDocs(q);
        
        let allListings = snap.docs.map(d => ({ ...d.data(), id: d.id } as Listing));

        // Lọc thông minh
        const queryText = options.search.trim();
        let filtered = allListings.filter(l => isSearchMatch(l.title, queryText));

        // Sắp xếp
        filtered.sort((a, b) => {
           const scoreA = calculateRelevanceScore(a.title, queryText);
           const scoreB = calculateRelevanceScore(b.title, queryText);
           return scoreB - scoreA;
        });

        return {
          listings: filtered,
          lastDoc: null,
          hasMore: false,
          error: null
        };
      }

      // === TRƯỜNG HỢP 2: KHÔNG TÌM KIẾM (PAGINATION BÌNH THƯỜNG) ===
      let constraints: any[] = [];

      if (options.status) {
          constraints.push(where("status", "==", options.status));
      } else if (!options.sellerId) {
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

      return {
        listings: results,
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

  getListingById: async (id: string): Promise<Listing | null> => {
    try {
      const docRef = doc(firestore, "listings", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Listing;
      }
      return null;
    } catch (e) {
      console.error("Error getting listing by ID:", e);
      return null;
    }
  },

  saveListing: async (listingData: any) => {
    try {
      const dataToSave = {
        ...listingData,
        createdAt: new Date().toISOString(),
        status: listingData.status || 'pending',
        attributes: listingData.attributes || {} 
      };

      const docRef = await addDoc(collection(firestore, "listings"), dataToSave);
      
      await addDoc(collection(firestore, "mail"), {
        to: [ADMIN_EMAIL],
        message: {
          subject: `[Tin Mới] ${listingData.title} - Cần duyệt`,
          html: `
            <h3 style="color: #0066cc;">Có người đăng tin bán hàng mới!</h3>
            <p><strong>Tiêu đề:</strong> ${listingData.title}</p>
            <p><strong>Giá:</strong> ${Number(listingData.price).toLocaleString()} VNĐ</p>
            <p><strong>Danh mục ID:</strong> ${listingData.category}</p>
            <p><strong>Người bán:</strong> ${listingData.sellerName}</p>
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

  // [ĐÃ CẬP NHẬT LINK] Duyệt tin -> Link về bài viết
  updateListingStatus: async (listingId: string, status: 'approved' | 'rejected') => {
    try {
      // 1. Cập nhật trạng thái
      await updateDoc(doc(firestore, "listings", listingId), { status });
      
      // 2. Lấy thông tin tin đăng để gửi thông báo cho chủ sở hữu
      const listing = await db.getListingById(listingId);
      if (listing) {
        await db.sendNotification({
          userId: listing.sellerId,
          title: status === 'approved' ? 'Tin đăng đã được duyệt' : 'Tin đăng bị từ chối',
          message: `Tin "${listing.title}" của bạn đã được chuyển sang trạng thái ${status === 'approved' ? 'Đang hiển thị' : 'Từ chối'}.`,
          type: status === 'approved' ? 'success' : 'error',
          link: `/listings/${listingId}` // Link khớp với Route App.tsx
        });
      }
    } catch (error) {
      console.error("Error updating listing status:", error);
      throw error;
    }
  },

  deleteListing: async (id: string) => await deleteDoc(doc(firestore, "listings", id)),

  updateListingContent: async (listingId: string, data: Partial<Listing>) => {
    try {
      await updateDoc(doc(firestore, "listings", listingId), data);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

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

  pushListing: async (listingId: string, userId: string) => {
    const settings: any = await db.getSettings();
    const user = await db.getUserById(userId);
    
    const rawPrice = settings?.pushPrice || 20000;
    const discount = settings?.pushDiscount || 0;
    const price = rawPrice * (1 - discount / 100);

    if (!user || (user.walletBalance || 0) < price) return { success: false, message: "Ví không đủ tiền." };
    
    await updateDoc(doc(firestore, "users", userId), { walletBalance: (user.walletBalance || 0) - price });
    await updateDoc(doc(firestore, "listings", listingId), { createdAt: new Date().toISOString() });

    await addDoc(collection(firestore, "mail"), {
        to: [ADMIN_EMAIL],
        message: {
          subject: `[DOANH THU] User đẩy tin`,
          html: `User ${userId} vừa đẩy tin ${listingId}. Doanh thu: ${price} VNĐ.`
        }
    });

    return { success: true };
  },

  // --- C. GIAO DỊCH & VÍ ---

  requestDeposit: async (userId: string, amount: number, method: string) => {
    try {
      const res = await addDoc(collection(firestore, "transactions"), {
        userId, amount, type: 'deposit', method, 
        description: `Nạp tiền qua ${method}`, 
        status: 'pending', 
        createdAt: new Date().toISOString()
      });

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

  requestSubscriptionTransfer: async (userId: string, tier: SubscriptionTier, price: number) => {
    try {
      const res = await addDoc(collection(firestore, "transactions"), {
        userId, amount: price, type: 'payment', 
        description: `Nâng cấp gói ${tier.toUpperCase()}`, 
        status: 'pending', 
        metadata: { targetTier: tier }, 
        createdAt: new Date().toISOString()
      });

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

  // [ĐÃ CẬP NHẬT LINK] Duyệt tiền -> Link về Ví
  approveTransaction: async (txId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      let targetUserId = "";
      let amount = 0;
      let type = "";

      // 1. Thực hiện Transaction logic
      await runTransaction(firestore, async (transaction) => {
        const txRef = doc(firestore, "transactions", txId);
        const txSnap = await transaction.get(txRef);
        if (!txSnap.exists()) throw new Error("Transaction not found");
        
        const txData = txSnap.data() as Transaction & { metadata?: any };
        if (txData.status !== 'pending') throw new Error("Transaction already processed");

        // Lưu thông tin ra biến ngoài để gửi thông báo sau
        targetUserId = txData.userId;
        amount = txData.amount;
        type = txData.type;

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
      });

      // 2. Gửi thông báo nếu thành công
      if (targetUserId) {
         await db.sendNotification({
            userId: targetUserId,
            title: type === 'deposit' ? 'Nạp tiền thành công' : 'Gói dịch vụ đã kích hoạt',
            message: type === 'deposit' 
              ? `Hệ thống đã cộng ${amount.toLocaleString()} VNĐ vào ví của bạn.` 
              : `Gói thành viên của bạn đã được nâng cấp thành công.`,
            type: 'success',
            link: '/wallet' // [QUAN TRỌNG] Link về ví để xem tiền
         });
      }
      
      return { success: true };
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
  
  getUsersPaged: async (options: {
    pageSize: number,
    lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
    search?: string, 
    verificationStatus?: string
  }) => {
    try {
      const colRef = collection(firestore, "users");
      let constraints: any[] = [];

      if (options.verificationStatus) {
         constraints.push(where("verificationStatus", "==", options.verificationStatus));
      }

      constraints.push(orderBy("joinedAt", "desc"));
      constraints.push(limit(options.pageSize));

      if (options.lastDoc) {
         constraints.push(startAfter(options.lastDoc));
      }

      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      
      const users = snap.docs.map(d => d.data() as User);
      const lastVisible = snap.docs[snap.docs.length - 1] || null;

      let finalUsers = users;
      if (options.search) {
        const s = options.search.toLowerCase();
        finalUsers = users.filter(u => 
            (u.name && u.name.toLowerCase().includes(s)) ||
            (u.email && u.email.toLowerCase().includes(s))
        );
      }

      return {
        users: finalUsers,
        lastDoc: lastVisible,
        hasMore: snap.docs.length === options.pageSize,
        error: null
      };
    } catch (e: any) {
       console.error("Get users paged error:", e);
       return { users: [], lastDoc: null, hasMore: false, error: e.toString() };
    }
  },

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
    return newUser;
  },

  logout: async () => await signOut(auth),

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

  // [ĐÃ CẬP NHẬT LINK] Follow -> Link về profile
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
      link: `/profile/${followerId}` // Link về trang người follow
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

  // --- F. CÁC TÍNH NĂNG KHÁC ---

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

  // [ĐÃ CẬP NHẬT LINK] Review -> Link về profile/listing
  addReview: async (reviewData: Omit<Review, 'id' | 'createdAt'>) => {
    try {
      // 1. Lưu Review
      const res = await addDoc(collection(firestore, "reviews"), { ...reviewData, createdAt: new Date().toISOString() });
      
      // 2. Logic Thông báo
      let receiverId = "";
      let notifTitle = "";
      let link = "";

      if (reviewData.targetType === 'user') {
        receiverId = reviewData.targetId;
        notifTitle = "Bạn nhận được đánh giá mới";
        link = `/profile/${reviewData.authorId}`; // Xem ai đánh giá mình
      } else if (reviewData.targetType === 'listing') {
        const listing = await db.getListingById(reviewData.targetId);
        if (listing) {
          receiverId = listing.sellerId;
          notifTitle = `Tin "${listing.title}" có đánh giá mới`;
          link = `/listings/${reviewData.targetId}`; // Xem tin nào được đánh giá
        }
      }

      if (receiverId && receiverId !== reviewData.authorId) {
        await db.sendNotification({
          userId: receiverId,
          title: notifTitle,
          message: `${reviewData.authorName} đã chấm ${reviewData.rating} sao: "${reviewData.comment}"`,
          type: 'review',
          link: link
        });
      }

      return res.id;
    } catch (e) {
      console.error("Error adding review:", e);
      throw e;
    }
  },

  getNotifications: (userId: string, callback: (notifs: Notification[]) => void) => {
    const q = query(
      collection(firestore, "notifications"), 
      where("userId", "==", userId),
      orderBy("createdAt", "desc"), 
      limit(50) 
    );
    return onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
      callback(notifs);
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

  // --- G. SEED DATA (TẠO DỮ LIỆU MẪU - CÓ XÓA DỮ LIỆU CŨ) ---
  seedDatabase: async () => {
    try {
      console.log("🧹 Đang dọn dẹp dữ liệu rác...");
      
      // 1. XÓA DỮ LIỆU GIẢ CŨ (User & Listing có ID bắt đầu bằng 'seed_')
      // Lưu ý: Firestore giới hạn batch 500 ops, nên ta tách ra xử lý từng cụm
      
      // A. Lấy danh sách cần xóa
      const allUsers = await getDocs(collection(firestore, "users"));
      const allListings = await getDocs(collection(firestore, "listings"));

      const seedUserDocs = allUsers.docs.filter(d => d.id.startsWith("seed_"));
      const seedListingDocs = allListings.docs.filter(d => d.id.startsWith("seed_"));

      // B. Thực hiện xóa (Dùng Batch để xóa nhanh)
      const deleteBatch = writeBatch(firestore);
      let deleteCount = 0;

      seedUserDocs.forEach(d => {
        deleteBatch.delete(d.ref);
        deleteCount++;
      });
      seedListingDocs.forEach(d => {
        deleteBatch.delete(d.ref);
        deleteCount++;
      });

      // Nếu có dữ liệu cũ thì commit xóa
      if (deleteCount > 0) {
        await deleteBatch.commit();
        console.log(`✅ Đã xóa ${seedUserDocs.length} user giả và ${seedListingDocs.length} tin giả cũ.`);
      }

      console.log("🌱 Bắt đầu tạo dữ liệu mới...");
      const createBatch = writeBatch(firestore);

      // 2. CHUẨN BỊ DỮ LIỆU MỚI
      const firstNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng"];
      const middleNames = ["Văn", "Thị", "Hữu", "Đức", "Ngọc", "Minh", "Quốc", "Thanh", "Mỹ", "Anh"];
      const lastNames = ["An", "Bình", "Cường", "Dũng", "Giang", "Hương", "Khánh", "Lan", "Nam", "Tâm", "Tuấn", "Vy"];
      const cities = ["Hà Nội", "TPHCM", "Đà Nẵng", "Cần Thơ", "Hải Phòng", "Bình Dương", "Đồng Nai"];
      
      // Nguồn ảnh LoremFlickr (đổi từ khóa để ảnh đa dạng)
      const categories = [
        { id: "xe-co", name: "Xe cộ", keyword: "motorcycle,car", products: [
            { title: "Honda SH 150i 2022 Chính chủ", price: 85000000 },
            { title: "Yamaha Exciter 155 VVA Lướt", price: 42000000 },
            { title: "Mazda 3 Luxury 2021 Màu Đỏ", price: 620000000 },
            { title: "VinFast Lux A2.0 Bản Cao Cấp", price: 750000000 }
        ]},
        { id: "do-dien-tu", name: "Đồ điện tử", keyword: "smartphone,laptop", products: [
            { title: "iPhone 15 Pro Max 256GB VNA", price: 29500000 },
            { title: "MacBook Air M2 Midnight Fullbox", price: 24000000 },
            { title: "Samsung Galaxy S24 Ultra Xám", price: 26000000 },
            { title: "Tai nghe Sony WH-1000XM5", price: 6500000 }
        ]},
        { id: "bat-dong-san", name: "Bất động sản", keyword: "apartment,house", products: [
            { title: "Chung cư cao cấp Vinhome 2PN", price: 4500000000 },
            { title: "Nhà phố liền kề Khu đô thị mới", price: 8200000000 },
            { title: "Phòng trọ khép kín Full nội thất", price: 3500000 }
        ]},
        { id: "thoi-trang", name: "Thời trang", keyword: "fashion,shoes", products: [
            { title: "Giày Nike Jordan 1 High Panda", price: 3200000 },
            { title: "Áo Hoodie Essentials Chính hãng", price: 1500000 }
        ]}
      ];

      const getRandom = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
      const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

      // 3. TẠO 50 USERS GIẢ
      const fakeUsers: User[] = [];
      for (let i = 0; i < 50; i++) {
        const uid = `seed_user_${i}`; // ID cố định dạng seed_user_0, seed_user_1 để dễ quản lý
        const name = `${getRandom(firstNames)} ${getRandom(middleNames)} ${getRandom(lastNames)}`;
        
        const userRef = doc(firestore, "users", uid);
        const newUser: User = {
          id: uid,
          name: name,
          email: `user${i}@seed.com`,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
          role: 'user',
          status: 'active',
          location: getRandom(cities),
          joinedAt: new Date(Date.now() - randomInt(0, 10000000000)).toISOString(),
          walletBalance: randomInt(0, 5000000),
          subscriptionTier: Math.random() > 0.8 ? 'pro' : (Math.random() > 0.5 ? 'basic' : 'free'),
          verificationStatus: Math.random() > 0.7 ? 'verified' : 'unverified',
          followers: [],
          following: []
        };
        
        fakeUsers.push(newUser);
        createBatch.set(userRef, newUser);
      }

      // 4. TẠO 100 LISTINGS GIẢ
      for (let i = 0; i < 100; i++) {
        const lid = `seed_listing_${i}`; // ID cố định dạng seed_listing_0...
        const seller = getRandom(fakeUsers);
        const cat = getRandom(categories);
        const prod = getRandom(cat.products);
        
        const isVip = Math.random() > 0.8;
        const tier = isVip ? 'pro' : 'free';
        const finalPrice = prod.price + randomInt(-500000, 500000); 

        const mainImage = `https://loremflickr.com/800/600/${cat.keyword}?lock=${i}`;
        const subImage = `https://picsum.photos/seed/${i}/800/600`;

        const listingRef = doc(firestore, "listings", lid);
        const newListing: Listing = {
          id: lid,
          title: prod.title,
          description: `Cần bán ${prod.title}. Hàng còn mới, sử dụng kỹ. Bao test thoải mái. Liên hệ ${seller.name} để ép giá. Giao dịch trực tiếp tại ${seller.location}.`,
          price: finalPrice > 0 ? finalPrice : 1000000,
          category: cat.id,
          images: [mainImage, subImage], 
          location: seller.location || "Toàn quốc",
          address: `Quận ${randomInt(1, 12)}, ${seller.location}`,
          sellerId: seller.id,
          sellerName: seller.name,
          sellerAvatar: seller.avatar,
          createdAt: new Date(Date.now() - randomInt(0, 604800000)).toISOString(),
          status: Math.random() > 0.1 ? 'approved' : 'pending',
          condition: Math.random() > 0.5 ? 'used' : 'new',
          tier: tier as SubscriptionTier,
          attributes: {
             brand: "Chính hãng",
             origin: "Việt Nam",
             status: "99%"
          }
        };

        createBatch.set(listingRef, newListing);
      }

      // 5. THỰC THI TẠO MỚI
      await createBatch.commit();
      
      return { success: true, message: `Đã Reset: Xóa dữ liệu cũ & Tạo mới ${fakeUsers.length} user, 100 tin đăng!` };

    } catch (e: any) {
      console.error("Seed error:", e);
      return { success: false, message: e.message };
    }
  },

  init: () => {}
};
