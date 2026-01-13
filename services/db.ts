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

// Import Types
import { Listing, ChatRoom, User, Transaction, SubscriptionTier, Report, Notification, Review, VerificationStatus, Offer, Category } from '../types';

// IMPORT LOGIC TÌM KIẾM & FORMAT
import { isSearchMatch, calculateRelevanceScore, generateKeywords } from '../utils/format';

// 2. CẤU HÌNH ADMIN EMAIL
const ADMIN_EMAIL = "buivanbac@gmail.com"; 

// Interface chuẩn đầy đủ cho Admin Settings
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
const functions = getFunctions(app);

// 4. OBJECT DB
export const db = {
  
  // --- HÀM HELPER: Tạo đường dẫn đẹp (Slug) ---
  toSlug: (str: string) => {
    return str
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
      .replace(/[đĐ]/g, "d")
      .replace(/[^a-z0-9\s-]/g, "") 
      .trim()
      .replace(/\s+/g, "-");
  },

  // --- A. QUẢN LÝ TIN ĐĂNG (LISTINGS) ---

  countUserListingsToday: async (userId: string) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const colRef = collection(firestore, "listings");
      const q = query(
        colRef, 
        where("sellerId", "==", userId),
        where("createdAt", ">=", todayISO)
      );
      
      const snap = await getCountFromServer(q);
      return snap.data().count;
    } catch (e) {
      console.error("Lỗi đếm tin trong ngày:", e);
      return 0;
    }
  },

  incrementListingView: async (listingId: string) => {
    try {
        const ref = doc(firestore, "listings", listingId);
        await updateDoc(ref, {
            viewCount: increment(1)
        });
    } catch (e) {
        console.error("Lỗi tăng view:", e);
    }
  },

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

  getListingsPaged: async (options: {
    pageSize: number,
    lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
    categoryId?: string,
    sellerId?: string,
    status?: string,
    search?: string,
    location?: string,
    isVip?: boolean
  }) => {
    try {
      const colRef = collection(firestore, "listings");
      let constraints: any[] = [];

      // 1. LOGIC TÌM KIẾM HYBRID
      if (options.search && options.search.trim().length > 0) {
         const searchKeywords = generateKeywords(options.search);
         if (searchKeywords.length > 0) {
             const primaryKeyword = searchKeywords[0];
             constraints.push(where("keywords", "array-contains", primaryKeyword));
         }
      }

      // 2. CÁC ĐIỀU KIỆN LỌC KHÁC
      if (options.status) {
          constraints.push(where("status", "==", options.status));
      } else if (!options.sellerId) {
          constraints.push(where("status", "==", "approved"));
      }

      if (options.categoryId) constraints.push(where("category", "==", options.categoryId));
      if (options.sellerId) constraints.push(where("sellerId", "==", options.sellerId));
      if (options.location) constraints.push(where("location", "==", options.location));
      if (options.isVip) constraints.push(where("tier", "==", "pro"));

      // 3. SẮP XẾP
      if (!options.search) {
          constraints.push(orderBy("createdAt", "desc"));
      }

      // 4. PHÂN TRANG
      constraints.push(limit(options.pageSize));
      if (options.lastDoc) {
        constraints.push(startAfter(options.lastDoc));
      }

      // 5. THỰC THI
      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      
      let results = snap.docs.map(d => ({ ...d.data(), id: d.id } as Listing));

      // 6. LỌC TINH (CLIENT-SIDE)
      if (options.search && options.search.trim().length > 0) {
          const queryText = options.search.trim();
          results = results.filter(l => isSearchMatch(l.title, queryText));
          results.sort((a, b) => {
             const scoreA = calculateRelevanceScore(a.title, queryText);
             const scoreB = calculateRelevanceScore(b.title, queryText);
             return scoreB - scoreA;
          });
      }

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

  // [ĐÃ SỬA] Hàm saveListing: Tự động lấy lat/lng từ người bán nếu tin đăng không có
  saveListing: async (listingData: any) => {
    try {
      // 1. Lấy thông tin người bán
      const seller = await db.getUserById(listingData.sellerId);

      // 2. Logic ưu tiên tọa độ: Lấy từ form -> Lấy từ profile -> Null
      const finalLat = listingData.lat || seller?.lat || null;
      const finalLng = listingData.lng || seller?.lng || null;
      // Logic location/address: Lấy từ form -> Lấy từ profile
      const finalLocation = listingData.location || seller?.location || "Toàn quốc";
      const finalAddress = listingData.address || seller?.address || "";

      const dataToSave = {
        ...listingData,
        slug: db.toSlug(listingData.title),
        keywords: generateKeywords(listingData.title),
        
        viewCount: 0, 
        videoUrl: listingData.videoUrl || null, 
        
        // Gán dữ liệu vị trí đã xử lý
        lat: finalLat, 
        lng: finalLng,
        location: finalLocation,
        address: finalAddress,

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
            <p><strong>Người bán:</strong> ${listingData.sellerName}</p>
          `
        }
      });

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

        const slug = listing.slug || db.toSlug(listing.title);
        const prettyLink = `/san-pham/${slug}-${listingId}`;

        await db.sendNotification({
          userId: listing.sellerId,
          title: status === 'approved' ? 'Tin đăng đã được duyệt' : 'Tin đăng bị từ chối',
          message: `Tin "${listing.title}" của bạn đã được chuyển sang trạng thái ${status === 'approved' ? 'Đang hiển thị' : 'Từ chối'}.`,
          type: status === 'approved' ? 'success' : 'error',
          link: prettyLink
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
      let updates: any = { ...data, updatedAt: new Date().toISOString() };
      
      if (data.title) {
          updates.slug = db.toSlug(data.title);
          // @ts-ignore
          updates.keywords = generateKeywords(data.title);
      }

      const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      await updateDoc(doc(firestore, "listings", listingId), cleanUpdates);
      return { success: true };
    } catch (e: any) {
      console.error("Lỗi updateListingContent:", e);
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

  approveTransaction: async (txId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      let targetUserId = "";
      let amount = 0;
      let type = "";

      await runTransaction(firestore, async (transaction) => {
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
      });

      if (targetUserId) {
         await db.sendNotification({
           userId: targetUserId,
           title: type === 'deposit' ? 'Nạp tiền thành công' : 'Gói dịch vụ đã kích hoạt',
           message: type === 'deposit' 
             ? `Hệ thống đã cộng ${amount.toLocaleString()} VNĐ vào ví của bạn.` 
             : `Gói thành viên của bạn đã được nâng cấp thành công.`,
           type: 'success',
           link: '/wallet'
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
          resolve(userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } as User : null);
        } else {
          resolve(null);
        }
        unsubscribe();
      });
    });
  },

  getUserById: async (id: string): Promise<User | undefined> => {
    const d = await getDoc(doc(firestore, "users", id));
    return d.exists() ? { id: d.id, ...d.data() } as User : undefined;
  },

  updateUserProfile: async (userId: string, updates: Partial<User>): Promise<User> => {
    const userRef = doc(firestore, "users", userId);
    await updateDoc(userRef, updates);
    const d = await getDoc(userRef);
    return d.data() as User;
  },

  updateUserVerification: async (userId: string, status: VerificationStatus) => {
    try {
        await updateDoc(doc(firestore, "users", userId), { verificationStatus: status });
        
        let message = "";
        let type: 'success' | 'error' = 'success';
        if (status === 'verified') {
            message = "Chúc mừng! Tài khoản của bạn đã được xác minh danh tính.";
        } else if (status === 'rejected') {
            message = "Yêu cầu xác minh của bạn đã bị từ chối. Vui lòng kiểm tra lại thông tin.";
            type = 'error';
        }

        if (message) {
            await db.sendNotification({
                userId,
                title: "Cập nhật xác minh danh tính",
                message,
                type,
                link: "/profile"
            });
        }
    } catch (e) {
        console.error("Lỗi cập nhật xác minh:", e);
    }
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

  // --- F. ĐÁNH GIÁ (REVIEWS) ---

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

  getReviewsPaged: async ({ targetId, targetType, pageSize, startAfterDoc }: { 
      targetId: string, targetType: string, pageSize: number, startAfterDoc?: any 
  }) => {
      const colRef = collection(firestore, "reviews");
      let constraints: any[] = [
          where("targetId", "==", targetId),
          where("targetType", "==", targetType),
          orderBy("createdAt", "desc"),
          limit(pageSize)
      ];

      if (startAfterDoc) {
          constraints.push(startAfter(startAfterDoc));
      }

      const q = query(colRef, ...constraints);
      const snapshot = await getDocs(q);
      
      return {
          data: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review)),
          lastDoc: snapshot.docs[snapshot.docs.length - 1],
          hasMore: snapshot.docs.length === pageSize
      };
  },

  checkUserReviewed: async (targetId: string, authorId: string) => {
      const q = query(
          collection(firestore, "reviews"),
          where("targetId", "==", targetId),
          where("authorId", "==", authorId),
          limit(1)
      );
      const snap = await getDocs(q);
      return !snap.empty;
  },

  addReview: async (reviewData: Omit<Review, 'id' | 'createdAt'>) => {
    try {
      const res = await addDoc(collection(firestore, "reviews"), { ...reviewData, createdAt: new Date().toISOString() });
      
      let receiverId = "";
      let notifTitle = "";
      let link = "";

      if (reviewData.targetType === 'user') {
        receiverId = reviewData.targetId;
        notifTitle = "Bạn nhận được đánh giá mới";
        link = `/profile/${reviewData.authorId}`;
      } else if (reviewData.targetType === 'listing') {
        const listing = await db.getListingById(reviewData.targetId);
        if (listing) {
          receiverId = listing.sellerId;
          notifTitle = `Tin "${listing.title}" có đánh giá mới`;
          const slug = db.toSlug(listing.title);
          link = `/san-pham/${slug}-${reviewData.targetId}`; 
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

  updateReview: async (reviewId: string, data: { rating: number, comment: string }) => {
      const reviewRef = doc(firestore, 'reviews', reviewId);
      await updateDoc(reviewRef, {
          rating: data.rating,
          comment: data.comment,
          updatedAt: new Date().toISOString()
      });
  },

  deleteReview: async (reviewId: string) => {
      const reviewRef = doc(firestore, 'reviews', reviewId);
      await deleteDoc(reviewRef);
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

  uploadVideo: async (file: File | Blob, userId: string): Promise<string> => {
    try {
      const path = `videos/${userId}/${Date.now()}_short.mp4`;
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (e) {
      console.error("Lỗi tải video:", e);
      throw e;
    }
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

  // --- G. CHAT ---

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

  deleteChatRoom: async (roomId: string) => {
    try {
      await deleteDoc(doc(firestore, "chats", roomId));
      return { success: true };
    } catch (e: any) {
      console.error("Error deleting chat room:", e);
      throw e;
    }
  },
  
  addMessage: async (id: string, m: any) => {
    const ref = doc(firestore, "chats", id);
    const msg = { id: Date.now().toString(), ...m, timestamp: new Date().toISOString() };
    await updateDoc(ref, { messages: arrayUnion(msg), lastMessage: m.text, lastUpdate: msg.timestamp, seenBy: [m.senderId] });
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
  
  createChatRoom: async (l: any, buyer: User) => {
    try {
        if (!l?.id) throw new Error("Listing ID is missing");
        if (!buyer?.id) throw new Error("Buyer ID is missing");

        const q = query(
            collection(firestore, "chats"), 
            where("listingId", "==", l.id), 
            where("participantIds", "array-contains", buyer.id)
        );
        
        const s = await getDocs(q);
        if (!s.empty) return s.docs[0].id;

        const sellerName = l.sellerName || "Người bán";
        const sellerAvatar = l.sellerAvatar || "https://placehold.co/100?text=Seller";

        const participantsData = {
            [buyer.id]: {
                name: buyer.name,
                avatar: buyer.avatar
            },
            [l.sellerId]: {
                name: sellerName,
                avatar: sellerAvatar
            }
        };

        const res = await addDoc(collection(firestore, "chats"), {
            listingId: l.id, 
            listingTitle: l.title, 
            listingImage: l.images && l.images.length > 0 ? l.images[0] : 'https://placehold.co/100x100?text=Chat', 
            listingPrice: l.price || 0,
            
            participantIds: [buyer.id, l.sellerId], 
            participantsData: participantsData, 
            
            messages: [], 
            lastUpdate: new Date().toISOString(), 
            seenBy: [buyer.id]
        });
        return res.id;
    } catch (e) {
        console.error("Error creating chat room:", e);
        throw e;
    }
  },

  // --- I. TÍNH NĂNG MẶC CẢ (OFFERS) ---
  
  createOffer: async (listing: Listing, buyer: User, offerPrice: number) => {
    try {
      const offerData: Omit<Offer, 'id'> = {
        listingId: listing.id,
        listingTitle: listing.title,
        listingImage: listing.images[0] || "",
        buyerId: buyer.id,
        buyerName: buyer.name,
        sellerId: listing.sellerId,
        originalPrice: listing.price,
        offerPrice: offerPrice,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      const offerRef = await addDoc(collection(firestore, "offers"), offerData);
      const roomId = await db.createChatRoom(listing, buyer);

      const message = {
        senderId: buyer.id,
        text: `💰 Đã đề nghị mức giá: ${offerPrice.toLocaleString()} VNĐ`,
        type: 'offer', 
        offerId: offerRef.id,
        isSystem: true
      };
      await db.addMessage(roomId, message);

      await db.sendNotification({
        userId: listing.sellerId,
        title: "Nhận được lời mặc cả mới!",
        message: `Khách muốn mua "${listing.title}" với giá ${offerPrice.toLocaleString()}đ`,
        type: 'offer',
        link: `/chat/${roomId}` 
      });

      return { success: true, offerId: offerRef.id };
    } catch (e: any) {
      console.error("Lỗi tạo offer:", e);
      return { success: false, message: e.message };
    }
  },

  respondToOffer: async (offerId: string, status: 'accepted' | 'rejected', roomId: string) => {
    try {
      await updateDoc(doc(firestore, "offers", offerId), { status });

      const offerSnap = await getDoc(doc(firestore, "offers", offerId));
      const offerData = offerSnap.data() as Offer;

      const actionText = status === 'accepted' ? "✅ Đã CHẤP NHẬN" : "❌ Đã TỪ CHỐI";
      const message = {
        senderId: offerData.sellerId, 
        text: `${actionText} mức giá ${offerData.offerPrice.toLocaleString()} VNĐ`,
        type: 'text',
        isSystem: true
      };
      await db.addMessage(roomId, message);

      await db.sendNotification({
        userId: offerData.buyerId,
        title: status === 'accepted' ? "Tin vui! Mặc cả thành công" : "Mặc cả thất bại",
        message: `Người bán đã ${status === 'accepted' ? 'đồng ý' : 'từ chối'} giá bạn đưa ra.`,
        type: status === 'accepted' ? 'success' : 'error',
        link: `/chat/${roomId}`
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  // --- CRAWLER LINK ---
  scanLinkToImage: async (url: string) => {
    try {
      const captureFn = httpsCallable(functions, 'captureUrl');
      console.log("🚀 Đang gửi yêu cầu chụp ảnh tới Backend...");
      const result: any = await captureFn({ url });
      
      if (result.data.success) {
        return result.data.base64; 
      }
      return null;
    } catch (e) {
      console.error("Lỗi scan link:", e);
      return null;
    }
  },

  // --- DANH MỤC ĐỘNG ---
  getCategories: async (): Promise<Category[]> => {
    try {
      const colRef = collection(firestore, "categories");
      const q = query(colRef, orderBy("order", "asc")); 
      const snap = await getDocs(q);
      
      if (snap.empty) return []; 
      
      return snap.docs.map(d => d.data() as Category);
    } catch (e) {
      console.error("Lỗi lấy danh mục:", e);
      return [];
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

  deleteCategory: async (categoryId: string) => {
    try {
      await deleteDoc(doc(firestore, "categories", categoryId));
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  // --- H. SEED DATA (FULL DATASET VIETNAM) ---
  seedDatabase: async () => {
    try {
      console.log("🧹 Đang dọn dẹp dữ liệu rác...");
      
      const allUsers = await getDocs(collection(firestore, "users"));
      const allListings = await getDocs(collection(firestore, "listings"));
      const allCategories = await getDocs(collection(firestore, "categories"));

      // Chỉ xóa dữ liệu test (có prefix seed_)
      const seedUserDocs = allUsers.docs.filter(d => d.id.startsWith("seed_"));
      const seedListingDocs = allListings.docs.filter(d => d.id.startsWith("seed_"));
      
      // Xóa TOÀN BỘ danh mục cũ để nạp danh mục chuẩn mới
      const deleteBatch = writeBatch(firestore);
      let deleteCount = 0;

      seedUserDocs.forEach(d => { deleteBatch.delete(d.ref); deleteCount++; });
      seedListingDocs.forEach(d => { deleteBatch.delete(d.ref); deleteCount++; });
      allCategories.forEach(d => { deleteBatch.delete(d.ref); deleteCount++; }); // Xóa hết category cũ

      if (deleteCount > 0) {
        await deleteBatch.commit();
        console.log(`✅ Đã xóa ${deleteCount} items cũ.`);
      }

      console.log("🌱 Bắt đầu tạo dữ liệu mới...");
      const createBatch = writeBatch(firestore);

      // KHAI BÁO TỌA ĐỘ CÁC THÀNH PHỐ LỚN ĐỂ RANDOM
      const CITY_COORDS: Record<string, { lat: number, lng: number }> = {
        "Hà Nội": { lat: 21.0285, lng: 105.8542 },
        "TPHCM": { lat: 10.8231, lng: 106.6297 },
        "Đà Nẵng": { lat: 16.0544, lng: 108.2022 },
        "Cần Thơ": { lat: 10.0452, lng: 105.7469 },
        "Hải Phòng": { lat: 20.8449, lng: 106.6881 },
        "Bình Dương": { lat: 11.1705, lng: 106.6669 },
        "Đồng Nai": { lat: 10.9423, lng: 106.8242 }
      };
      const cityNames = Object.keys(CITY_COORDS);

      // 1. TẠO CẤU TRÚC DANH MỤC LỚN (12 NHÓM CHA)
      const RAW_CATEGORIES = [
        {
            id: "bat-dong-san", name: "Bất động sản", icon: "🏠",
            children: [
                { id: "can-ho", name: "Căn hộ/Chung cư", icon: "🏢", keyword: "apartment" },
                { id: "nha-o", name: "Nhà ở", icon: "🏡", keyword: "house" },
                { id: "dat", name: "Đất nền", icon: "🏞️", keyword: "land" },
                { id: "van-phong", name: "Văn phòng/Mặt bằng", icon: "💼", keyword: "office" },
                { id: "phong-tro", name: "Phòng trọ", icon: "🛏️", keyword: "room for rent" }
            ]
        },
        {
            id: "xe-co", name: "Xe cộ", icon: "🚗",
            children: [
                { id: "o-to", name: "Ô tô", icon: "🚙", keyword: "car" },
                { id: "xe-may", name: "Xe máy", icon: "🛵", keyword: "motorcycle" },
                { id: "xe-tai", name: "Xe tải/Ben", icon: "🚛", keyword: "truck" },
                { id: "xe-dien", name: "Xe điện", icon: "🛴", keyword: "electric scooter" },
                { id: "phu-tung-xe", name: "Phụ tùng xe", icon: "🔧", keyword: "spare parts" }
            ]
        },
        {
            id: "do-dien-tu", name: "Đồ điện tử", icon: "📱",
            children: [
                { id: "dien-thoai", name: "Điện thoại", icon: "📱", keyword: "smartphone" },
                { id: "laptop", name: "Laptop", icon: "💻", keyword: "laptop" },
                { id: "may-tinh-bang", name: "Máy tính bảng", icon: "📟", keyword: "tablet" },
                { id: "may-anh", name: "Máy ảnh/Camera", icon: "📷", keyword: "camera" },
                { id: "tivi", name: "Tivi, Âm thanh", icon: "📺", keyword: "tv audio" },
                { id: "phu-kien", name: "Phụ kiện số", icon: "🎧", keyword: "accessories" }
            ]
        },
        {
            id: "viec-lam", name: "Việc làm", icon: "💼",
            children: [
                { id: "lao-dong-pho-thong", name: "Lao động phổ thông", icon: "👷", keyword: "worker" },
                { id: "ban-hang", name: "Bán hàng/CSKH", icon: "💁", keyword: "sales" },
                { id: "van-phong-hcns", name: "Văn phòng/HCNS", icon: "📂", keyword: "admin job" },
                { id: "ky-thuat", name: "Kỹ sư/Kỹ thuật", icon: "🛠️", keyword: "engineer" },
                { id: "it", name: "CNTT/Thiết kế", icon: "👨‍💻", keyword: "developer" }
            ]
        },
        {
            id: "thu-cung", name: "Thú cưng", icon: "🐶",
            children: [
                { id: "cho", name: "Chó", icon: "🐕", keyword: "dog" },
                { id: "meo", name: "Mèo", icon: "🐈", keyword: "cat" },
                { id: "chim", name: "Chim cảnh", icon: "🐦", keyword: "bird" },
                { id: "phu-kien-thu-cung", name: "Phụ kiện/Thức ăn", icon: "🦴", keyword: "pet food" }
            ]
        },
        {
            id: "dien-lanh", name: "Điện lạnh", icon: "❄️",
            children: [
                { id: "may-lanh", name: "Máy lạnh", icon: "❄️", keyword: "air conditioner" },
                { id: "may-giat", name: "Máy giặt", icon: "🧺", keyword: "washing machine" },
                { id: "tu-lanh", name: "Tủ lạnh", icon: "🧊", keyword: "fridge" }
            ]
        },
        {
            id: "thoi-trang", name: "Thời trang", icon: "👗",
            children: [
                { id: "quan-ao-nam", name: "Quần áo Nam", icon: "👔", keyword: "men clothes" },
                { id: "quan-ao-nu", name: "Quần áo Nữ", icon: "👚", keyword: "women clothes" },
                { id: "giay-dep", name: "Giày dép", icon: "👟", keyword: "shoes" },
                { id: "dong-ho", name: "Đồng hồ/Trang sức", icon: "⌚", keyword: "watch jewelry" },
                { id: "tui-xach", name: "Túi xách/Ví", icon: "👜", keyword: "bag" }
            ]
        },
        {
            id: "me-va-be", name: "Mẹ và Bé", icon: "🍼",
            children: [
                { id: "xe-day", name: "Xe đẩy/Nôi", icon: "🛒", keyword: "baby stroller" },
                { id: "do-choi", name: "Đồ chơi", icon: "🧸", keyword: "toys" },
                { id: "quan-ao-be", name: "Quần áo bé", icon: "👶", keyword: "baby clothes" }
            ]
        },
        {
            id: "noi-that", name: "Nội thất", icon: "🛋️",
            children: [
                { id: "ban-ghe", name: "Bàn ghế", icon: "🪑", keyword: "table chair" },
                { id: "giuong-tu", name: "Giường/Tủ", icon: "🛏️", keyword: "bed cabinet" },
                { id: "bep", name: "Tủ bếp/Đồ bếp", icon: "🍳", keyword: "kitchenware" }
            ]
        },
        {
            id: "giai-tri", name: "Giải trí", icon: "🎸",
            children: [
                { id: "nhac-cu", name: "Nhạc cụ", icon: "🎹", keyword: "musical instrument" },
                { id: "sach", name: "Sách/Truyện", icon: "📚", keyword: "books" },
                { id: "the-thao", name: "Đồ thể thao", icon: "⚽", keyword: "sports" }
            ]
        },
        {
            id: "dich-vu", name: "Dịch vụ", icon: "🔧",
            children: [
                { id: "sua-chua", name: "Sửa chữa", icon: "🔨", keyword: "repair service" },
                { id: "van-tai", name: "Vận tải/Chuyển nhà", icon: "🚚", keyword: "moving service" },
                { id: "du-lich", name: "Du lịch", icon: "✈️", keyword: "travel" }
            ]
        },
        {
            id: "thuc-pham", name: "Thực phẩm", icon: "🥦",
            children: [
                { id: "trai-cay", name: "Trái cây", icon: "🍎", keyword: "fruit" },
                { id: "dac-san", name: "Đặc sản", icon: "🍯", keyword: "specialty food" }
            ]
        }
      ];

      // Lưu danh mục vào Firestore
      let orderCounter = 0;
      const flatCategoriesForListing: any[] = []; 

      RAW_CATEGORIES.forEach(parent => {
          // Lưu Parent
          const parentRef = doc(firestore, "categories", parent.id);
          createBatch.set(parentRef, {
              id: parent.id,
              name: parent.name,
              icon: parent.icon,
              slug: db.toSlug(parent.name),
              order: orderCounter++,
              parentId: null // Là cha
          });

          // Lưu Children
          parent.children.forEach(child => {
              const childRef = doc(firestore, "categories", child.id);
              createBatch.set(childRef, {
                  id: child.id,
                  name: child.name,
                  icon: child.icon,
                  slug: db.toSlug(child.name),
                  order: orderCounter++,
                  parentId: parent.id // Link tới cha
              });

              // Thêm vào mảng tạm để dùng sinh tin đăng
              flatCategoriesForListing.push({
                  id: child.id,
                  name: child.name,
                  parentId: parent.id,
                  keyword: child.keyword
              });
          });
      });

      // 2. TẠO USER GIẢ
      const firstNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng"];
      const middleNames = ["Văn", "Thị", "Hữu", "Đức", "Ngọc", "Minh", "Quốc", "Thanh", "Mỹ", "Anh"];
      const lastNames = ["An", "Bình", "Cường", "Dũng", "Giang", "Hương", "Khánh", "Lan", "Nam", "Tâm", "Tuấn", "Vy"];
      const getRandom = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
      const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

      const fakeUsers: User[] = [];
      for (let i = 0; i < 40; i++) {
        const uid = `seed_user_${i}`;
        const name = `${getRandom(firstNames)} ${getRandom(middleNames)} ${getRandom(lastNames)}`;
        
        // --- [MỚI] TẠO TỌA ĐỘ GIẢ CHO USER ---
        const cityName = getRandom(cityNames);
        const baseCoords = CITY_COORDS[cityName];
        const fakeLat = baseCoords.lat + (Math.random() - 0.5) * 0.05; 
        const fakeLng = baseCoords.lng + (Math.random() - 0.5) * 0.05;

        const userRef = doc(firestore, "users", uid);
        const newUser: any = {
          id: uid,
          name: name,
          email: `user${i}@seed.com`,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
          role: 'user',
          status: 'active',
          
          location: cityName,
          lat: fakeLat,
          lng: fakeLng,
          address: `Số ${randomInt(1, 999)}, Quận trung tâm, ${cityName}`,

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

      // 3. TẠO TIN ĐĂNG GIẢ (LISTINGS) - TĂNG LÊN 200 TIN
      for (let i = 0; i < 200; i++) {
        const lid = `seed_listing_${i}`;
        const seller = getRandom(fakeUsers);
        const cat = getRandom(flatCategoriesForListing); // Lấy ngẫu nhiên 1 danh mục con
        
        const isVip = Math.random() > 0.9; // 10% tin VIP
        const tier = isVip ? 'pro' : 'free';
        const basePrice = randomInt(100000, 50000000); 

        // Sinh tiêu đề & thuộc tính dựa trên loại danh mục
        let title = "";
        let attributes: any = {};

        // Logic sinh tên thông minh hơn
        if (cat.parentId === 'xe-co') {
            title = `${cat.name} ${getRandom(["Honda", "Yamaha", "VinFast", "Toyota", "Mazda"])} ${randomInt(2018, 2024)} Chính chủ`;
            attributes = {
                year: randomInt(2018, 2024),
                mileage: randomInt(5000, 50000),
                fuel: getRandom(["Xăng", "Dầu", "Điện"]),
                gearbox: getRandom(["Tự động", "Số sàn"])
            };
        } else if (cat.parentId === 'do-dien-tu') {
            title = `${cat.name} ${getRandom(["Apple", "Samsung", "Sony", "Dell", "Asus"])} Giá rẻ`;
            attributes = {
                storage: getRandom(["64GB", "128GB", "256GB"]),
                ram: getRandom(["8GB", "16GB"]),
                color: getRandom(["Đen", "Trắng", "Xám"])
            };
        } else if (cat.parentId === 'bat-dong-san') {
            title = `${cat.name} ${randomInt(30, 100)}m2 tại ${getRandom(["Quận 1", "Cầu Giấy", "Thủ Đức"])}`;
            attributes = {
                area: randomInt(30, 150),
                bedrooms: randomInt(1, 4),
                bathrooms: randomInt(1, 3)
            };
        } else if (cat.parentId === 'viec-lam') {
            title = `Tuyển dụng ${cat.name} lương cao`;
            attributes = { salary: `${randomInt(5, 20)} triệu` };
        } else {
            title = `Thanh lý ${cat.name} còn mới 90%`;
            attributes = { status: "Đã qua sử dụng" };
        }

        const mainImage = `https://loremflickr.com/800/600/${cat.keyword}?lock=${i}`;
        const subImage = `https://picsum.photos/seed/${i}/800/600`;
        const hasVideo = Math.random() > 0.8; 
        const videoUrl = hasVideo ? "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4" : null;

        const listingRef = doc(firestore, "listings", lid);
        
        // --- [MỚI] TẠO TỌA ĐỘ GIẢ CHO TIN ĐĂNG (DỰA THEO SELLER) ---
        // Jitter nhẹ để không trùng khít seller
        const listingLat = (seller.lat || 21.0285) + (Math.random() - 0.5) * 0.01;
        const listingLng = (seller.lng || 105.8542) + (Math.random() - 0.5) * 0.01;
        // ------------------------------------------------------------

        const newListing: Listing = {
          id: lid,
          title: title,
          slug: db.toSlug(title), 
          keywords: generateKeywords(title), 
          viewCount: randomInt(0, 500), 
          description: `Cần bán gấp ${title}. Ai có nhu cầu liên hệ ${seller.name}. Xem hàng tại ${seller.location}.`,
          price: basePrice,
          category: cat.id, 
          images: [mainImage, subImage], 
          videoUrl: videoUrl, 
          
          location: seller.location,
          address: seller.address,
          lat: listingLat, 
          lng: listingLng,

          sellerId: seller.id,
          sellerName: seller.name,
          sellerAvatar: seller.avatar,
          createdAt: new Date(Date.now() - randomInt(0, 604800000)).toISOString(),
          status: Math.random() > 0.1 ? 'approved' : 'pending',
          condition: Math.random() > 0.5 ? 'used' : 'new',
          tier: tier as SubscriptionTier,
          attributes: attributes
        };

        createBatch.set(listingRef, newListing);
      }

      await createBatch.commit();
      
      return { success: true, message: `Đã Reset: Tạo mới 12 Nhóm danh mục Cha & ~50 danh mục Con!` };

    } catch (e: any) {
      console.error("Seed error:", e);
      return { success: false, message: e.message };
    }
  },
  init: () => {}
};