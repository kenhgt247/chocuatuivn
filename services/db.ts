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
import { Listing, ChatRoom, User, Transaction, SubscriptionTier, Report, Notification, Review, VerificationStatus, Offer, Category, Bid, Message, Story } from '../types';

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
export { app, auth, storage, firestore };
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
    parentCategoryId?: string,
    sellerId?: string,
    status?: string,
    search?: string,
    location?: string,
    isVip?: boolean,
    minPrice?: number, 
    maxPrice?: number  
  }) => {
    try {
      const colRef = collection(firestore, "listings");
      let constraints: any[] = [];

      // 1. TÌM KIẾM
      if (options.search && options.search.trim().length > 0) {
         const searchKeywords = generateKeywords(options.search);
         if (searchKeywords.length > 0) {
             const primaryKeyword = searchKeywords[0];
             constraints.push(where("keywords", "array-contains", primaryKeyword));
         }
      }

      // 2. TRẠNG THÁI
      if (options.status) {
          constraints.push(where("status", "==", options.status));
      } else if (!options.sellerId) {
          constraints.push(where("status", "==", "approved"));
      }

      // 3. LỌC DANH MỤC
      if (options.categoryId) {
          constraints.push(where("category", "==", options.categoryId));
      } else if (options.parentCategoryId) {
          constraints.push(where("parentCategory", "==", options.parentCategoryId));
      }

      // 4. CÁC BỘ LỌC KHÁC
      if (options.sellerId) constraints.push(where("sellerId", "==", options.sellerId));
      if (options.location) constraints.push(where("location", "==", options.location));
      if (options.isVip) constraints.push(where("tier", "==", "pro"));

      // 5. LỌC KHOẢNG GIÁ
      if (typeof options.minPrice === 'number') {
        constraints.push(where("price", ">=", options.minPrice));
      }
      if (typeof options.maxPrice === 'number') {
        constraints.push(where("price", "<=", options.maxPrice));
      }

      // 6. SẮP XẾP
      if (typeof options.minPrice === 'number' || typeof options.maxPrice === 'number') {
          constraints.push(orderBy("price", "desc"));
      } else if (!options.search) {
          constraints.push(orderBy("createdAt", "desc"));
      }

      // 7. PHÂN TRANG
      constraints.push(limit(options.pageSize));
      if (options.lastDoc) {
        constraints.push(startAfter(options.lastDoc));
      }

      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      
      let results = snap.docs.map(d => ({ ...d.data(), id: d.id } as Listing));

      // 8. TÌM KIẾM CLIENT SIDE
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

  saveListing: async (listingData: any) => {
    try {
      const seller = await db.getUserById(listingData.sellerId);

      let parentCategory = null;
      if (listingData.category) {
         const catDoc = await getDoc(doc(firestore, "categories", listingData.category));
         if (catDoc.exists()) {
             parentCategory = catDoc.data().parentId || null;
         }
      }

      const finalLat = listingData.lat || seller?.lat || null;
      const finalLng = listingData.lng || seller?.lng || null;
      const finalLocation = listingData.location || seller?.location || "Toàn quốc";
      const finalAddress = listingData.address || seller?.address || "";

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

      if (data.category) {
          const catDoc = await getDoc(doc(firestore, "categories", data.category));
          if (catDoc.exists()) {
              updates.parentCategory = catDoc.data().parentId || null;
          }
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
    try {
      const [settings, user, listingSnap] = await Promise.all([
        db.getSettings(),
        db.getUserById(userId),
        getDoc(doc(firestore, "listings", listingId))
      ]);
      
      const listingData = listingSnap.exists() ? listingSnap.data() : null;
      const listingTitle = listingData ? listingData.title : "Sản phẩm";
      const listingSlug = listingData ? listingData.slug : "san-pham";

      const rawPrice = settings?.pushPrice || 20000;
      const discount = settings?.pushDiscount || 0; 
      const price = rawPrice * (1 - discount / 100);

      if (!user || (user.walletBalance || 0) < price) {
        return { success: false, message: "Ví không đủ tiền. Vui lòng nạp thêm." };
      }
      
      const batch = writeBatch(firestore);
      const userRef = doc(firestore, "users", userId);
      const listingRef = doc(firestore, "listings", listingId);

      batch.update(userRef, { walletBalance: (user.walletBalance || 0) - price });
      batch.update(listingRef, { createdAt: new Date().toISOString() });
      
      await batch.commit();

      await db.sendNotification({
          userId: userId,
          title: "⚡ Đẩy tin thành công",
          message: `Tài khoản bị trừ -${price.toLocaleString()}đ phí đẩy tin "${listingTitle}" lên đầu trang.`,
          type: 'system', 
          link: `/san-pham/${listingSlug}-${listingId}`
      });

      await addDoc(collection(firestore, "mail"), {
          to: [ADMIN_EMAIL],
          message: {
            subject: `[DOANH THU] User đẩy tin`,
            html: `User ${userId} vừa đẩy tin: <strong>${listingTitle}</strong>.<br>Doanh thu: <strong>${price.toLocaleString()} VNĐ</strong>.`
          }
      });

      return { success: true };

    } catch (e: any) {
      console.error("Lỗi đẩy tin:", e);
      return { success: false, message: e.message };
    }
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
        
        if (!txSnap.exists()) throw new Error("Giao dịch không tồn tại");
        
        const txData = txSnap.data() as Transaction & { metadata?: any };
        
        if (txData.status !== 'pending') throw new Error("Giao dịch này đã được xử lý trước đó");

        targetUserId = txData.userId;
        amount = txData.amount;
        type = txData.type;

        const userRef = doc(firestore, "users", txData.userId);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists()) throw new Error("Không tìm thấy User");
        
        const userData = userSnap.data() as User;

        if (txData.type === 'deposit') {
          const currentBalance = userData.walletBalance || 0;
          transaction.update(userRef, { walletBalance: currentBalance + txData.amount });
        } else if (txData.type === 'payment' && txData.metadata?.targetTier) {
          const expires = new Date();
          expires.setDate(expires.getDate() + 30); 
          transaction.update(userRef, { 
            subscriptionTier: txData.metadata.targetTier, 
            subscriptionExpires: expires.toISOString() 
          });
        }
        
        transaction.update(txRef, { status: 'success' });
      });

      if (targetUserId) {
         await db.sendNotification({
           userId: targetUserId,
           title: type === 'deposit' ? '💰 Nạp tiền thành công' : '✅ Gói dịch vụ đã kích hoạt',
           message: type === 'deposit' 
             ? `Hệ thống đã cộng ${amount.toLocaleString()} VNĐ vào ví của bạn.` 
             : `Gói thành viên của bạn đã được nâng cấp thành công.`,
           type: 'success', 
           link: '/wallet'
         });
      }
      
      return { success: true };
    } catch (e: any) {
      console.error("Lỗi duyệt giao dịch:", e);
      return { success: false, message: e.message };
    }
  },

  rejectTransaction: async (txId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      await updateDoc(doc(firestore, "transactions", txId), { status: 'failed' });
      
      const txSnap = await getDoc(doc(firestore, "transactions", txId));
      if (txSnap.exists()) {
          const txData = txSnap.data() as Transaction;
          await db.sendNotification({
              userId: txData.userId,
              title: "⚠️ Giao dịch bị từ chối",
              message: `Yêu cầu giao dịch ${txData.amount.toLocaleString()}đ của bạn không được duyệt. Vui lòng liên hệ Admin.`,
              type: 'error',
              link: '/wallet'
          });
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  getTransactions: async (userId?: string): Promise<Transaction[]> => {
    const colRef = collection(firestore, "transactions");
    let q;
    
    if (userId) {
        q = query(colRef, where("userId", "==", userId), orderBy("createdAt", "desc"));
    } else {
        q = query(colRef, orderBy("createdAt", "desc"));
    }

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction));
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

  // [HÀM MỚI CHÈN VÀO] - Lắng nghe thay đổi user (cho ví tự cập nhật)
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
  
  // --- Thay thế toàn bộ hàm addMessage cũ bằng đoạn này ---
  addMessage: async (roomId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
    const roomRef = doc(firestore, "chats", roomId);
    
    // 1. Tạo tin nhắn mới
    const newMessage = {
      ...message,
      // Thay crypto.randomUUID() bằng chuỗi ngẫu nhiên thủ công
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString()
    };

    try {
      // 2. Lấy thông tin phòng chat
      const roomSnap = await getDoc(roomRef);
      
      if (!roomSnap.exists()) {
          // Nếu chưa có phòng thì tạo mới (Logic cũ giữ nguyên)
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
          // 3. Nếu phòng đã có, cập nhật tin nhắn
          await updateDoc(roomRef, {
            messages: arrayUnion(newMessage),
            lastMessage: message.type === 'image' ? '📷 Hình ảnh' : (message.type === 'offer' ? '💸 Đề nghị giá' : (message.type === 'swap' ? '🔄 Đề nghị đổi đồ' : message.text)),
            lastUpdate: new Date().toISOString(),
            seenBy: [message.senderId] 
          });

          // 🔥 [QUAN TRỌNG] ĐOẠN CODE MỚI THÊM ĐỂ BẮN THÔNG BÁO 🔥
          // Logic: Tìm người nhận (là người kia trong phòng chat) và gửi thông báo cho họ
          const roomData = roomSnap.data() as ChatRoom;
          const receiverId = roomData.participantIds?.find(id => id !== message.senderId);

          if (receiverId) {
            // Lấy tên người gửi để hiện lên thông báo cho đẹp
            const senderName = roomData.participantsData?.[message.senderId]?.name || "Ai đó";
            
            await db.sendNotification({
              userId: receiverId,
              title: `Tin nhắn mới từ ${senderName} 💬`,
              message: message.type === 'image' ? 'Đã gửi một ảnh' : (message.text || 'Bạn có tin nhắn mới'),
              type: 'message',
              link: `/chat/${roomId}`
            });
          }
          // -----------------------------------------------------
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

  findChatRoomByListing: async (listingId: string) => {
    try {
      const q = query(
        collection(firestore, "chats"),
        where("listingId", "==", listingId),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs[0].id;
      }
      return null;
    } catch (e) {
      console.error("Lỗi tìm phòng chat:", e);
      return null;
    }
  },

  // [FIXED] Đảm bảo dùng setDoc để tạo phòng
  createChatRoom: async (l: Listing, buyer: User): Promise<string> => {
    try {
        const roomId = `${buyer.id}_${l.id}`;
        const roomRef = doc(firestore, "chats", roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
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
  
  // Hàm xử lý Đồng ý/Từ chối đổi đồ
  respondToSwap: async (roomId: string, messageId: string, status: 'accepted' | 'rejected') => {
    const roomRef = doc(firestore, "chats", roomId);
    try {
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) throw new Error("Phòng chat không tồn tại");

      const roomData = roomSnap.data() as ChatRoom;
      
      const updatedMessages = roomData.messages.map(msg => {
        if (msg.id === messageId && msg.type === 'swap' && msg.swapData) {
          return {
            ...msg,
            swapData: {
              ...msg.swapData,
              status: status 
            }
          };
        }
        return msg;
      });

      await updateDoc(roomRef, {
        messages: updatedMessages
      });

      const resultText = status === 'accepted' 
        ? "✅ Đã ĐỒNG Ý yêu cầu đổi đồ! Hãy trao đổi chi tiết địa điểm giao dịch."
        : "❌ Đã TỪ CHỐI yêu cầu đổi đồ.";
        
      await db.addMessage(roomId, {
        senderId: 'system', 
        text: resultText,
        type: 'text'
      });

      return { success: true };
    } catch (error) {
      console.error("Lỗi respondToSwap:", error);
      return { success: false, message: "Lỗi kết nối database" };
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
  // --- H. ĐẤU GIÁ (AUCTION) ---

  // Lấy danh sách người đấu giá (Realtime)
  getBids: (listingId: string, callback: (bids: Bid[]) => void) => {
    const q = query(
      collection(firestore, "bids"), 
      where("listingId", "==", listingId), 
      orderBy("amount", "desc")
    );
    return onSnapshot(q, (snap) => {
      const bids = snap.docs.map(d => ({ id: d.id, ...d.data() } as Bid));
      callback(bids);
    });
  },

  // Thực hiện đặt giá (Transaction an toàn)
  placeBid: async (listingId: string, userId: string, amount: number) => {
    try {
      return await runTransaction(firestore, async (transaction) => {
        // 1. Lấy thông tin tin đăng & user
        const listingRef = doc(firestore, "listings", listingId);
        const userRef = doc(firestore, "users", userId);
        
        const listingSnap = await transaction.get(listingRef);
        const userSnap = await transaction.get(userRef);

        if (!listingSnap.exists()) throw new Error("Tin không tồn tại");
        if (!userSnap.exists()) throw new Error("User không tồn tại");

        const listing = listingSnap.data() as Listing;
        const user = userSnap.data() as User;

        if (listing.sellerId === userId) {
            throw new Error("🚫 Bạn không thể tự đấu giá sản phẩm của chính mình!");
        }

        if (!listing.isAuction) throw new Error("Tin này không phải đấu giá");
        if (listing.auctionEndAt && new Date(listing.auctionEndAt) < new Date()) throw new Error("Đã hết thời gian đấu giá");
        
        const currentPrice = listing.price || 0;
        if (amount <= currentPrice) throw new Error(`Giá đặt phải cao hơn ${currentPrice.toLocaleString()}đ`);
        
        const previousBidderId = listing.highestBidderId;

        transaction.update(listingRef, { 
          price: amount,
          highestBidderId: userId,
          bidsCount: increment(1)
        });

        const newBidRef = doc(collection(firestore, "bids"));
        transaction.set(newBidRef, {
          listingId,
          userId,
          userName: user.name,
          userAvatar: user.avatar || "https://placehold.co/50",
          amount,
          createdAt: new Date().toISOString()
        });

        return { 
            previousBidderId, 
            listingTitle: listing.title, 
            slug: listing.slug || 'san-pham',
            sellerId: listing.sellerId 
        };
      });
    } catch (e: any) {
      console.error("Lỗi đấu giá:", e);
      throw e;
    }
  },

  notifyBidSuccess: async (data: any, currentUserId: string, amount: number) => {
      if (data.previousBidderId && data.previousBidderId !== currentUserId) {
          await db.sendNotification({
              userId: data.previousBidderId,
              title: "⚡ BẠN ĐÃ BỊ VƯỢT GIÁ!",
              message: `Ai đó vừa trả ${amount.toLocaleString()}đ cho tin "${data.listingTitle}". Vào đấu lại ngay!`,
              type: 'warning',
              link: `/san-pham/${data.slug}-${data.id}`
          });
      }

      if (data.sellerId && data.sellerId !== currentUserId) {
           await db.sendNotification({
              userId: data.sellerId,
              title: "💰 Có lượt trả giá mới!",
              message: `Khách vừa trả ${amount.toLocaleString()}đ cho sản phẩm "${data.listingTitle}" của bạn.`,
              type: 'success', 
              link: `/san-pham/${data.slug}-${data.id}`
          });
      }
  },

  clearDatabase: async () => {
    try {
      console.log("🧹 Đang quét rác (seed_user, seed_listing)...");
      const currentUser = auth.currentUser;

      const collections = ["listings", "users", "transactions", "notifications", "reviews", "reports", "chats", "offers", "favorites"];
      
      const batch = writeBatch(firestore);
      let count = 0;
      let batchCount = 0;

      const isFakeData = (id: string) => {
        if (id.startsWith("seed_")) return true;
        if (/^[lu]\d+$/.test(id)) return true;
        return false; 
      };

      for (const colName of collections) {
        const snap = await getDocs(collection(firestore, colName));
        
        for (const d of snap.docs) {
          if (colName === 'users' && currentUser && d.id === currentUser.uid) {
            console.log(`🛡️ Giữ lại Admin: ${d.id}`);
            continue;
          }

          if (isFakeData(d.id)) {
             batch.delete(d.ref);
             count++;
             batchCount++;
          } 
          
          if (batchCount >= 450) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
      
      return { success: true, message: `Đã dọn dẹp ${count} dữ liệu mẫu (seed_*)!` };
    } catch (e: any) {
      console.error("Lỗi dọn dẹp:", e);
      return { success: false, message: e.message };
    }
  },

  seedDatabase: async () => {
    try {
      console.log("🌱 Bắt đầu tạo dữ liệu mẫu cao cấp...");
      const batch = writeBatch(firestore);

      const sellerId = "seed_user_vip";
      const sellerRef = doc(firestore, "users", sellerId);
      
      batch.set(sellerRef, {
        id: sellerId,
        name: "Cửa Hàng Uy Tín ⭐️",
        email: "store@chocuatui.vn",
        avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop",
        role: "user",
        status: "active",
        joinedAt: new Date().toISOString(),
        location: "TP.HCM",
        address: "Quận 1, TP.HCM",
        lat: 10.7769, 
        lng: 106.7009,
        verificationStatus: "verified",
        walletBalance: 5000000
      });

      const SHOWCASE_ITEMS = [
        {
          title: "iPhone 15 Pro Max Titan Tự nhiên 256GB VNA Fullbox",
          price: 28500000,
          category: "dien-thoai",
          parent: "do-dien-tu",
          image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80",
          location: "TP.HCM"
        },
        {
          title: "Honda SH 150i ABS 2023 Màu Xám Xi Măng Lướt 2000km",
          price: 98000000,
          category: "xe-may",
          parent: "xe-co",
          image: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&q=80",
          location: "Hà Nội"
        },
        {
          title: "Căn hộ Vinhome Central Park 2PN View Sông - Nội thất cao cấp",
          price: 5200000000,
          category: "can-ho-chung-cu",
          parent: "bat-dong-san",
          image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
          location: "TP.HCM"
        },
        {
          title: "MacBook Air M2 Midnight 8GB/256GB Sạc 10 lần",
          price: 21500000,
          category: "laptop",
          parent: "do-dien-tu",
          image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca4?w=800&q=80",
          location: "Đà Nẵng"
        },
        {
          title: "Mèo Anh Lông Ngắn Bicolor - Mập ú nu, đã tiêm phòng",
          price: 3500000,
          category: "meo",
          parent: "thu-cung",
          image: "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=800&q=80",
          location: "Hải Phòng"
        },
        {
          title: "VinFast Lux A2.0 Bản Cao Cấp - Xe Gia Đình Giữ Kỹ",
          price: 550000000,
          category: "o-to",
          parent: "xe-co",
          image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80",
          location: "TP.HCM"
        },
        {
          title: "Tuyển Nhân Viên Bán Hàng Cửa Hàng Tiện Lợi (Ca Xoay)",
          price: 7000000, 
          category: "ban-hang",
          parent: "viec-lam",
          image: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=800&q=80",
          location: "Hà Nội"
        },
        {
          title: "Thanh lý Sofa Da Bò Thật Nhập Khẩu Ý - Còn mới 95%",
          price: 12000000,
          category: "ban-ghe",
          parent: "noi-that",
          image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
          location: "TP.HCM"
        },
        {
          title: "Giày Nike Jordan 1 High Panda Auth - Size 42 Cond 9/10",
          price: 2800000,
          category: "giay-dep",
          parent: "thoi-trang",
          image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
          location: "Cần Thơ"
        },
        {
          title: "Tủ Lạnh Hitachi Inverter 4 Cánh 540L - Bảo hành 1 năm",
          price: 15500000,
          category: "tu-lanh",
          parent: "dien-lanh",
          image: "https://images.unsplash.com/photo-1584622050111-993a426fbf0a?w=800&q=80",
          location: "Đồng Nai"
        },
        {
          title: "Chó Corgi Mông Trái Tim 3 Tháng Tuổi - Giấy tờ VKA",
          price: 8000000,
          category: "cho",
          parent: "thu-cung",
          image: "https://images.unsplash.com/photo-1612536053381-696179b53685?w=800&q=80",
          location: "TP.HCM"
        },
        {
          title: "Đồng Hồ Apple Watch Series 8 45mm Nhôm GPS - Fullbox",
          price: 6500000,
          category: "dong-ho",
          parent: "thoi-trang",
          image: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&q=80",
          location: "Bình Dương"
        }
      ];

      SHOWCASE_ITEMS.forEach((item, index) => {
        const lid = `seed_listing_${index + 1}`;
        const listingRef = doc(firestore, "listings", lid);
        
        const listingData: Listing = {
          id: lid,
          title: item.title,
          description: `Cần bán gấp ${item.title}. Sản phẩm chính chủ, bao test thoải mái. Giao dịch trực tiếp tại nhà cho an tâm. Fix nhẹ tiền xăng cho anh em thiện chí.`,
          price: item.price,
          category: item.category,
          parentCategory: item.parent,
          images: [item.image, "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=800&q=80"],
          location: item.location,
          address: `Quận trung tâm, ${item.location}`,
          lat: 10.8231, 
          lng: 106.6297,
          
          sellerId: sellerId,
          sellerName: "Cửa Hàng Uy Tín ⭐️",
          sellerAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop",
          
          createdAt: new Date().toISOString(),
          status: 'approved',
          condition: index % 2 === 0 ? 'used' : 'new',
          tier: index < 4 ? 'pro' : 'free',
          
          slug: db.toSlug(item.title),
          keywords: generateKeywords(item.title),
          viewCount: Math.floor(Math.random() * 500) + 50,
          attributes: {}
        };

        batch.set(listingRef, listingData);
      });

      await batch.commit();
      return { success: true, message: "Đã tạo 12 tin mẫu VIP đẹp lung linh!" };

    } catch (e: any) {
      console.error("Lỗi seed:", e);
      return { success: false, message: e.message };
    }
  },
 // 👇 DÁN 3 HÀM NÀY VÀO ĐÂY (Ngang hàng với các hàm trên) 👇
  
  // --- STORY FEATURES ---
  async uploadStoryVideo(file: File, userId: string): Promise<string> {
    const storageRef = ref(storage, `stories/${userId}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  },

  async createStory(user: User, mediaUrl: string, mediaType: 'image' | 'video') {
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; 

    // Dùng Omit để loại bỏ 'id' vì Firestore tự sinh ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storyData: any = {
      sellerId: user.id,
      sellerName: user.name,
      sellerAvatar: user.avatar || '',
      videoUrl: mediaUrl,
      mediaType: mediaType,
      createdAt: now,
      expiresAt: expiresAt,
      views: 0
    };

    // Đảm bảo dùng biến 'firestore' (không phải dbInstance nếu bạn chưa khai báo)
    await addDoc(collection(firestore, 'stories'), storyData);
  },

  async getActiveStories(): Promise<Story[]> {
    const now = Date.now();
    try {
      const q = query(
        collection(firestore, 'stories'),
        where('expiresAt', '>', now),
        orderBy('expiresAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as any));
    } catch (error) {
      console.error("Lỗi lấy Story:", error);
      return [];
    }
  },

  // --- STORY INTERACTION (CHAT) ---
  async replyToStory(story: Story, sender: User, text: string) {
    try {
        if (!story || !sender || story.sellerId === sender.id) return { success: false };

        const roomId = `${sender.id}_${story.sellerId}`;
        const roomRef = doc(firestore, "chats", roomId);
        const roomSnap = await getDoc(roomRef);

        // Đảm bảo dữ liệu không bị undefined (Firestore không nhận undefined)
        const safeStoryUrl = story.videoUrl || ""; 
        const safeStoryType = story.mediaType || "image";
        const safeSellerName = story.sellerName || "Người bán";
        const safeSellerAvatar = story.sellerAvatar || "";

        if (!roomSnap.exists()) {
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const newRoom: any = {
                id: roomId,
                participantIds: [sender.id, story.sellerId],
                participantsData: {
                  [sender.id]: { name: sender.name, avatar: sender.avatar || "" },
                  [story.sellerId]: { name: safeSellerName, avatar: safeSellerAvatar }
                },
                listingId: `story_${story.id}`,
                listingTitle: "Phản hồi Story",
                listingImage: safeStoryUrl, 
                listingPrice: 0,
                lastMessage: text,
                lastUpdate: new Date().toISOString(),
                messages: [],
                seenBy: [sender.id]
            };
            await setDoc(roomRef, newRoom);
        }

        const message = {
            senderId: sender.id,
            text: text,
            type: 'text',
            metadata: { 
                isStoryReply: true, 
                storyUrl: safeStoryUrl, // FIX: Đã xử lý undefined
                storyType: safeStoryType // FIX: Đã xử lý undefined
            }
        };

        await updateDoc(roomRef, {
            messages: arrayUnion({
                ...message,
                id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                timestamp: new Date().toISOString()
            }),
            lastMessage: text,
            lastUpdate: new Date().toISOString(),
            seenBy: [sender.id]
        });

        return { success: true };

    } catch (error) {
        console.error("Lỗi reply story:", error);
        return { success: false };
    }
  },
  init: () => {}
};
