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

  countUserListingsToday: async (userId: string) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      const colRef = collection(firestore, "listings");
      const q = query(colRef, where("sellerId", "==", userId), where("createdAt", ">=", todayISO));
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
        await updateDoc(ref, { viewCount: increment(1) });
    } catch (e) { console.error("Lỗi tăng view:", e); }
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
      return { listings: snap.docs.map(d => ({ ...d.data(), id: d.id } as Listing)), error: null };
    } catch (e: any) { return { listings: [], error: e.toString() }; }
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
      const isSmartSearch = options.search && options.search.trim().length > 0;
      
      let q = query(colRef);
      let constraints: any[] = [];

      if (options.status) constraints.push(where("status", "==", options.status));
      else if (!options.sellerId) constraints.push(where("status", "==", "approved"));

      if (options.categoryId) constraints.push(where("category", "==", options.categoryId));
      else if (options.parentCategoryId) constraints.push(where("parentCategory", "==", options.parentCategoryId));

      if (options.sellerId) constraints.push(where("sellerId", "==", options.sellerId));
      if (options.isVip) constraints.push(where("tier", "==", "pro"));

      if (!isSmartSearch) {
          if (typeof options.minPrice === 'number') constraints.push(where("price", ">=", options.minPrice));
          if (typeof options.maxPrice === 'number') constraints.push(where("price", "<=", options.maxPrice));
          
          if (typeof options.minPrice === 'number' || typeof options.maxPrice === 'number') {
              constraints.push(orderBy("price", "desc"));
          } else {
              constraints.push(orderBy("createdAt", "desc"));
          }

          constraints.push(limit(options.pageSize));
          if (options.lastDoc) constraints.push(startAfter(options.lastDoc));
      }

      q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      let results = snap.docs.map(d => ({ ...d.data(), id: d.id } as Listing));

      if (isSmartSearch) {
          const queryText = options.search!.trim();
          if (options.minPrice !== undefined) results = results.filter(l => l.price >= options.minPrice!);
          if (options.maxPrice !== undefined) results = results.filter(l => l.price <= options.maxPrice!);

          if (options.location) {
              const locKey = removeVietnameseTones(options.location);
              results = results.filter(l => 
                  removeVietnameseTones(l.location || '').includes(locKey) || 
                  removeVietnameseTones(l.address || '').includes(locKey)
              );
          }

          const scoredResults = results.map(l => {
              const titleScore = calculateSearchScore(l.title, queryText);
              const descScore = calculateSearchScore(l.description || '', queryText) * 0.3; 
              const catScore = calculateSearchScore(l.categoryName || '', queryText) * 0.5;
              return { ...l, score: Math.max(titleScore, descScore, catScore) };
          });

          results = scoredResults
              // @ts-ignore
              .filter(l => l.score >= 10)
              // @ts-ignore
              .sort((a, b) => b.score - a.score);

          results = results.slice(0, 50);
      }

      const lastVisible = isSmartSearch ? null : (snap.docs[snap.docs.length - 1] || null);

      return {
        listings: results,
        lastDoc: lastVisible,
        hasMore: isSmartSearch ? false : (snap.docs.length === options.pageSize),
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
    } catch (e) { return null; }
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
      
      try {
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
    } catch (error) { throw error; }
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
        if (value !== undefined) { acc[key] = value; }
        return acc;
      }, {} as any);

      await updateDoc(doc(firestore, "listings", listingId), cleanUpdates);
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
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
    } catch (e: any) { return { success: false, error: e.message }; }
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
      batch.update(listingRef, { 
          createdAt: new Date().toISOString(),
          refreshedAt: new Date().toISOString() // Cập nhật cả cái này để sort
      });
      
      await batch.commit();

      await db.sendNotification({
          userId: userId,
          title: "⚡ Đẩy tin thành công",
          message: `Tài khoản bị trừ -${price.toLocaleString()}đ phí đẩy tin "${listingTitle}" lên đầu trang.`,
          type: 'system', 
          link: `/san-pham/${listingSlug}-${listingId}`
      });

      return { success: true };
    } catch (e: any) { return { success: false, message: e.message }; }
  },

  createPayOSPayment: async (amount: number, userId: string, fullName: string) => {
    try {
      const FUNCTION_URL = "https://createpaymentlink-4ybvtlflra-uc.a.run.app"; 
      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, userId, fullName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Lỗi server");
      }
      return await response.json();
    } catch (error: any) { throw error; }
  },

  requestDeposit: async (userId: string, amount: number, method: string) => {
    try {
      const res = await addDoc(collection(firestore, "transactions"), {
        userId, amount, type: 'deposit', method, 
        description: `Nạp tiền qua ${method}`, 
        status: 'pending', 
        createdAt: new Date().toISOString()
      });
      return res;
    } catch (e) { throw e; }
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

    try {
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
    } catch (e) {}

    return { success: true };
  },

  // --- 1. MUA GÓI BẰNG ĐIỂM (POINT) [NEW] ---
  buySubscriptionWithPoints: async (userId: string, tier: SubscriptionTier, points: number) => {
    try {
        return await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, "users", userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists()) return { success: false, message: "User not found" };

            const userData = userDoc.data();
            const currentPoints = userData.pointBalance || 0;

            if (currentPoints < points) {
                return { success: false, message: "Không đủ điểm thưởng." };
            }

            const expires = new Date();
            expires.setDate(expires.getDate() + 30);

            // 1. Trừ điểm & Cập nhật gói
            transaction.update(userRef, {
                pointBalance: increment(-points),
                subscriptionTier: tier,
                subscriptionExpires: expires.toISOString()
            });

            // 2. Lưu lịch sử
            const transRef = doc(collection(firestore, "transactions"));
            transaction.set(transRef, {
                userId,
                amount: points,
                type: 'redeem_point',
                status: 'success',
                description: `Dùng ${points} điểm đổi gói ${tier.toUpperCase()}`,
                createdAt: new Date().toISOString()
            });

            return { success: true };
        });
    } catch (error) {
        console.error("Lỗi đổi điểm:", error);
        return { success: false, message: "Lỗi hệ thống" };
    }
  },

  // --- 2. ĐẨY TIN BẰNG ĐIỂM (POINT) [NEW] ---
  pushListingWithPoints: async (listingId: string, userId: string, points: number) => {
    try {
        return await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, "users", userId);
            const listingRef = doc(firestore, "listings", listingId);
            
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "User missing";

            const currentPoints = userDoc.data().pointBalance || 0;
            if (currentPoints < points) return { success: false, message: "Không đủ điểm." };

            transaction.update(userRef, {
                pointBalance: increment(-points)
            });

            transaction.update(listingRef, {
                refreshedAt: new Date().toISOString(), 
                status: 'approved' 
            });

            const transRef = doc(collection(firestore, "transactions"));
            transaction.set(transRef, {
                userId,
                amount: points,
                type: 'redeem_point',
                description: `Dùng ${points} điểm đẩy tin`,
                status: 'success',
                createdAt: new Date().toISOString()
            });

            return { success: true };
        });
    } catch (error) {
        return { success: false, message: "Lỗi khi đẩy tin" };
    }
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
      return res;
    } catch (e) { throw e; }
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
    } catch (e: any) { return { success: false, message: e.message }; }
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
    } catch (e: any) { return { success: false, message: e.message }; }
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

  // --- D. NGƯỜI DÙNG ---
  
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
    } catch (e: any) { return { users: [], lastDoc: null, hasMore: false, error: e.toString() }; }
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

  getUserProfile: async (userId: string): Promise<User | null> => {
    try {
      const docRef = doc(firestore, "users", userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as User;
      }
      return null;
    } catch (error) { return null; }
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
    } catch (e) { console.error("Lỗi cập nhật xác minh:", e); }
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
    } catch (e) { return false; }
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
    } catch (e) { return { followers: 0, following: 0 }; }
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
    }, (error) => {
       if(error.code !== 'permission-denied') console.error(error);
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
    }, (error) => {
       if(error.code !== 'permission-denied') console.error(error);
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
    } catch (e) { throw e; }
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
    }, (error) => {
       if(error.code !== 'permission-denied') console.error(error);
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
    } catch (e: any) { throw e; }
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
      const compressedBlob = await db.compressImage(file);
      const path = `chat-images/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, compressedBlob);
      return await getDownloadURL(snapshot.ref);
    } catch (e) { throw e; }
  },

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
              link: `/chat/${roomId}`
            });
          }
      }
    } catch (error) { throw error; }
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
    } catch (e) { console.error("Error deleting message:", e); }
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
    } catch (e) { return null; }
  },

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
    } catch (e) { throw e; }
  },
  
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
        type: 'text',
        isSystem: true
      });

      return { success: true };
    } catch (error) { return { success: false, message: "Lỗi kết nối database" }; }
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
    } catch (e: any) { return { success: false, message: e.message }; }
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
    } catch (e: any) { return { success: false, message: e.message }; }
  },

  scanLinkToImage: async (url: string) => {
    try {
      const captureFn = httpsCallable(functions, 'captureUrl');
      console.log("🚀 Đang gửi yêu cầu chụp ảnh tới Backend...");
      const result: any = await captureFn({ url });
      
      if (result.data.success) {
        return result.data.base64; 
      }
      return null;
    } catch (e) { return null; }
  },

  // --- DANH MỤC ĐỘNG ---
  getCategories: async (): Promise<Category[]> => {
    try {
      const colRef = collection(firestore, "categories");
      const q = query(colRef, orderBy("order", "asc")); 
      const snap = await getDocs(q);
      
      if (snap.empty) return []; 
      
      return snap.docs.map(d => d.data() as Category);
    } catch (e) { return []; }
  },

  saveCategory: async (category: Category) => {
    try {
      await setDoc(doc(firestore, "categories", category.id), category);
      return { success: true };
    } catch (e: any) { return { success: false, message: e.message }; }
  },

  deleteCategory: async (categoryId: string) => {
    try {
      await deleteDoc(doc(firestore, "categories", categoryId));
      return { success: true };
    } catch (e: any) { return { success: false, message: e.message }; }
  },

  // --- H. ĐẤU GIÁ (AUCTION) ---

  getBids: (listingId: string, callback: (bids: Bid[]) => void) => {
    const q = query(
      collection(firestore, "bids"), 
      where("listingId", "==", listingId), 
      orderBy("amount", "desc")
    );
    return onSnapshot(q, (snap) => {
      const bids = snap.docs.map(d => ({ id: d.id, ...d.data() } as Bid));
      callback(bids);
    }, (error) => {
       if(error.code !== 'permission-denied') console.error(error);
    });
  },

  placeBid: async (listingId: string, userId: string, amount: number) => {
    try {
      return await runTransaction(firestore, async (transaction) => {
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
    } catch (e: any) { throw e; }
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
    } catch (e: any) { return { success: false, message: e.message }; }
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
        // ... (Giữ nguyên các item mẫu)
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

    } catch (e: any) { return { success: false, message: e.message }; }
  },

  seedSystemSettings: async () => {
    try {
      console.log("⚙️ Đang thiết lập cấu hình chuẩn...");
      
      const defaultSettings: SystemSettings = {
        pushPrice: 20000,
        pushDiscount: 10,
        tierDiscount: 20,
        bankName: "MB",
        accountNumber: "0912434666",
        accountName: "BUI VAN BAC",
        
        tierConfigs: {
          free: {
            name: "Thành viên Mới",
            price: 0,
            maxImages: 3,           
            postsPerDay: 5,         
            autoApprove: false,     
            allowVideo: false,      
            features: [
              "Đăng tối đa 5 tin/ngày",
              "Tối đa 3 ảnh/tin",
              "Tin chờ duyệt kiểm tra ⏳",
              "Hiển thị tiêu chuẩn",
              "Không hỗ trợ đăng Video/Story"
            ]
          },
          basic: {
            name: "Thành viên Bạc",
            price: 20000,           
            maxImages: 6,           
            postsPerDay: 15,        
            autoApprove: true,      
            allowVideo: true,       
            features: [
              "Đăng tối đa 15 tin/ngày",
              "Tối đa 6 ảnh/tin",
              "Duyệt tin TỰ ĐỘNG nhanh chóng ✅",
              "Huy hiệu Bạc & Ưu tiên hiển thị TB",
              "Đăng Video Story ngắn (15s) 🎥",
              "Mở khóa tính năng Đấu Giá 🔨"
            ]
          },
          pro: {
            name: "Đối tác Vàng",
            price: 99000,           
            maxImages: 10,          
            postsPerDay: 999,       
            autoApprove: true,      
            allowVideo: true,       
            features: [
              "Không giới hạn tin đăng 🔥",
              "Tối đa 10 ảnh/tin",
              "Duyệt tin TỰ ĐỘNG ngay lập tức",
              "Huy hiệu Vàng & Ưu tiên hiển thị CAO",
              "Đăng Video Story 60s + Lưu vĩnh viễn 💎",
              "Mở khóa Đấu Giá + Gắn thẻ sản phẩm"
            ]
          }
        },

        adsConfig: {
    home_below_categories: { 
        id: 'home_below_categories', 
        name: '🏠 Trang chủ - Top (1 Cột Ngang)', 
        enabled: true, 
        type: 'image', 
        image: 'https://placehold.co/1200x120/png?text=Banner+Top', 
        link: '#', 
        width: '100%', height: 'auto',
        bgColor: '#ffffff', textColor: '#000000'
    },
    home_top_left: { 
        id: 'home_top_left', 
        name: '🏠 Trang chủ - Top (Trái 1/2)', 
        enabled: false, 
        type: 'text', 
        textTitle: 'DEAL HỜI MỖI NGÀY',
        textDesc: 'Săn ngay hàng ngàn món đồ giá rẻ.',
        textBtnLabel: 'Xem ngay',
        link: '/search?sort=cheap',
        width: '100%', height: 'auto',
        bgColor: '#fdf4ff', textColor: '#c026d3' 
    },
    home_top_right: { 
        id: 'home_top_right', 
        name: '🏠 Trang chủ - Top (Phải 1/2)', 
        enabled: false, 
        type: 'text',
        textTitle: 'ĐĂNG TIN MIỄN PHÍ',
        textDesc: 'Tiếp cận hàng triệu khách hàng.',
        textBtnLabel: 'Đăng ngay',
        link: '/post',
        width: '100%', height: 'auto',
        bgColor: '#ecfccb', textColor: '#65a30d' 
    },
    home_middle_banner: { 
        id: 'home_middle_banner', 
        name: '🏠 Trang chủ - Giữa (1 Cột Ngang)', 
        enabled: false, 
        type: 'image', 
        image: 'https://placehold.co/1200x200/png?text=Banner+Giua', 
        link: '#', 
        width: '100%', height: 'auto',
        bgColor: '#ffffff', textColor: '#000000'
    },
    home_grid_left: { 
        id: 'home_grid_left', 
        name: '🏠 Trang chủ - Giữa (Trái 1/2)', 
        enabled: true, 
        type: 'text', 
        textTitle: 'XẢ KHO CÔNG NGHỆ',
        textDesc: 'Laptop, Điện thoại giảm đến 50%',
        textBtnLabel: 'Săn ngay',
        link: '/category/do-dien-tu',
        width: '100%', height: 'auto',
        bgColor: '#fff7ed', textColor: '#ea580c' 
    },
    home_grid_right: { 
        id: 'home_grid_right', 
        name: '🏠 Trang chủ - Giữa (Phải 1/2)', 
        enabled: true, 
        type: 'text',
        textTitle: 'THỜI TRANG HÈ',
        textDesc: 'Đón đầu xu hướng thời trang 2026',
        textBtnLabel: 'Khám phá',
        link: '/category/thoi-trang',
        width: '100%', height: 'auto',
        bgColor: '#eff6ff', textColor: '#2563eb' 
    },
    in_feed: { 
        id: 'in_feed', 
        name: '📂 Danh mục - Xen kẽ tin', 
        enabled: true, 
        type: 'text',
        textTitle: 'TIN ĐĂNG VIP',
        textDesc: 'Tiếp cận hàng ngàn khách hàng tiềm năng.',
        textBtnLabel: 'Đăng ngay',
        link: '/post', 
        interval: 6, 
        width: '100%', height: 'auto',
        bgColor: '#f0fdf4', textColor: '#16a34a' 
    },
    listing_sidebar_top: { 
        id: 'listing_sidebar_top', 
        name: '📄 Chi tiết - Cột phải', 
        enabled: true, 
        type: 'image', 
        image: 'https://placehold.co/300x250/png?text=Quang+Cao', 
        link: '#', 
        width: '100%', height: 'auto',
        bgColor: '#ffffff', textColor: '#000000'
    },
    listing_below_desc: {
        id: 'listing_below_desc',
        name: '📄 Chi tiết - Dưới mô tả',
        enabled: false, 
        type: 'code',
        code: '',
        width: '100%', height: 'auto',
        bgColor: '#ffffff', textColor: '#000000'
    },
    category_sidebar_right: {
        id: 'category_sidebar_right',
        name: '📂 Danh mục - Cột Phải (PC)',
        enabled: true, 
        type: 'image', 
        image: 'https://placehold.co/300x600/png?text=Banner+Doc', 
        link: '#', 
        width: '100%', height: 'auto',
        bgColor: '#ffffff', textColor: '#000000'
    }
  },

        bannerSlides: [
           { id: 1, type: 'text', title: "Đăng tin siêu tốc 🚀", desc: "Tiếp cận hàng ngàn khách hàng mỗi ngày.", btnText: "Đăng ngay", btnLink: "/post", colorFrom: "from-blue-600", colorTo: "to-indigo-600", icon: "⚡", isActive: true },
           { id: 2, type: 'text', title: "Nâng cấp VIP 👑", desc: "Tin đăng nổi bật, chốt đơn nhanh gấp 5 lần.", btnText: "Xem gói VIP", btnLink: "/profile", colorFrom: "from-orange-500", colorTo: "to-red-500", icon: "💎", isActive: true }
        ]
      };

      await setDoc(doc(firestore, "system", "settings"), defaultSettings);
      return { success: true, message: "Đã khôi phục cấu hình gói cước và quảng cáo thành công!" };
    } catch (e: any) {
      console.error("Lỗi seed settings:", e);
      return { success: false, message: e.message };
    }
  },

  // --- STORY FEATURES ---

  uploadStoryVideo: async (file: File, userId: string): Promise<string> => {
    const storageRef = ref(storage, `stories/${userId}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  },

  createStory: async (user: User, mediaUrl: string, mediaType: 'image' | 'video', listingId?: string) => {
    const tier = user.subscriptionTier || 'free';
    const isPro = tier === 'pro';
    const now = Date.now();
    const expiresAt = isPro ? null : now + (24 * 60 * 60 * 1000); 

    const storyData: any = {
      sellerId: user.id,
      sellerName: user.name,
      sellerAvatar: user.avatar || '',
      videoUrl: mediaUrl,
      mediaType: mediaType,
      createdAt: new Date().toISOString(),
      timestamp: now,
      expiresAt: expiresAt,
      isPermanent: isPro,
      views: 0,
      listingId: listingId || null,
      tier: tier
    };

    try {
        await addDoc(collection(firestore, 'stories'), storyData);
    } catch (e) { console.error("❌ Lỗi lưu Story:", e); }

    if (mediaType === 'video' && listingId && listingId.trim() !== "") {
        try {
            const listingRef = doc(firestore, 'listings', listingId);
            await updateDoc(listingRef, { videoUrl: mediaUrl });
        } catch (e) { console.error("❌ THẤT BẠI: Lỗi khi ghim video vào sản phẩm:", e); }
    }
  },

  getActiveStories: async (): Promise<Story[]> => {
    const now = Date.now();
    try {
      const q = query(
        collection(firestore, 'stories'),
        orderBy('createdAt', 'desc'),
        limit(100) 
      );
      
      const snapshot = await getDocs(q);
      const allStories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      return allStories.filter((s: any) => {
          if (s.isPermanent) return true; 
          return s.expiresAt > now; 
      });

    } catch (error) { return []; }
  },

  getHotVideos: async (): Promise<Story[]> => {
    try {
      const q = query(
        collection(firestore, 'stories'),
        where('tier', '==', 'pro'), 
        where('mediaType', '==', 'video'), 
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    } catch (e) { return []; }
  },

  replyToStory: async (story: Story, sender: User, text: string) => {
    try {
        if (!story || !sender || story.sellerId === sender.id) return { success: false };

        const roomId = `${sender.id}_${story.sellerId}`;
        const roomRef = doc(firestore, "chats", roomId);
        const roomSnap = await getDoc(roomRef);

        const safeStoryUrl = story.videoUrl || ""; 
        const safeStoryType = story.mediaType || "image";
        const safeSellerName = story.sellerName || "Người bán";
        const safeSellerAvatar = story.sellerAvatar || "";

        if (!roomSnap.exists()) {
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
                storyUrl: safeStoryUrl, 
                storyType: safeStoryType 
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

    } catch (error) { return { success: false }; }
  },

  // --- HÀM AFFILIATE CUỐI CÙNG ---
  trackAffiliate: async (refId: string, listingId: string) => {
    try {
      const API_URL = "https://us-central1-chocuatui-3e65c.cloudfunctions.net/trackAffiliateClick"; 
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refId, listingId })
      });
      return await response.json();
    } catch (error) { return { success: false }; }
  },

  getAffiliateStats: async (userId: string) => {
    try {
        const userDoc = await getDoc(doc(firestore, "users", userId));
        if(userDoc.exists()) {
            const data = userDoc.data();
            return {
                pointBalance: data.pointBalance || 0,
                totalPointsEarned: data.totalPointsEarned || 0
            };
        }
        return { pointBalance: 0, totalPointsEarned: 0 };
    } catch (error) {
        return { pointBalance: 0, totalPointsEarned: 0 };
    }
  },

  init: () => {}
};