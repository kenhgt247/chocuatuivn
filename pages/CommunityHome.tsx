import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../services/db';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl, removeVietnameseTones } from '../utils/format';
import MapView from '../components/MapView';

type FeedMode = 'free' | 'affordable' | 'all';
type CategoryFilter = 'all' | 'household' | 'books' | 'fashion' | 'kids' | 'electronics';

const PAGE_SIZE = 48;
const categories: { id: CategoryFilter; label: string; emoji: string; words: string[] }[] = [
  { id: 'all', label: 'Tất cả', emoji: '✨', words: [] },
  { id: 'household', label: 'Đồ gia dụng', emoji: '🏠', words: ['noi', 'chao', 'ban', 'ghe', 'tu', 'bep', 'giadung', 'gia dung', 'quat'] },
  { id: 'books', label: 'Sách & học tập', emoji: '📚', words: ['sach', 'vo', 'truyen', 'giao khoa', 'hoc tap'] },
  { id: 'fashion', label: 'Quần áo', emoji: '👕', words: ['quan', 'ao', 'giay', 'dep', 'tui xach', 'thoi trang'] },
  { id: 'kids', label: 'Mẹ & bé', emoji: '🧸', words: ['em be', 'tre em', 'do choi', 'xe day', 'bim', 'sua'] },
  { id: 'electronics', label: 'Điện tử', emoji: '💻', words: ['dien thoai', 'laptop', 'may tinh', 'dien tu', 'tivi', 'tai nghe'] },
];

const describeArea = (location: string) => location.trim() || 'Toàn quốc';
const isGiveaway = (item: Listing) => (item as Listing & { communityType?: string }).communityType === 'give';

const CommunityHome: React.FC<{ user: User | null }> = ({ user }) => {
  const [items, setItems] = useState<Listing[]>([]);
  const [mode, setMode] = useState<FeedMode>('free');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [area, setArea] = useState(user?.location || '');
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let live = true;
    db.getListingsPaged({ pageSize: PAGE_SIZE }).then(result => {
      if (!live) return;
      setItems(result.listings);
      setCursor(result.lastDoc);
      setHasMore(result.hasMore);
      setError(result.error ? 'Chưa thể tải danh sách. Vui lòng thử lại.' : '');
    }).catch(() => {
      if (live) setError('Không tải được tin đăng. Vui lòng kiểm tra kết nối.');
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await db.getListingsPaged({ pageSize: PAGE_SIZE, lastDoc: cursor });
      if (result.error) throw new Error(result.error);
      setItems(previous => {
        const seen = new Set(previous.map(p => p.id));
        return [...previous, ...result.listings.filter(p => !seen.has(p.id))];
      });
      setCursor(result.lastDoc);
      setHasMore(result.hasMore);
    } catch {
      setError('Không tải được trang tiếp theo. Hãy thử lại.');
    } finally { setLoadingMore(false); }
  };

  const visible = useMemo(() => {
    const needle = removeVietnameseTones(search);
    const local = removeVietnameseTones(area);
    const categoryWords = categories.find(c => c.id === category)?.words || [];
    return items.filter(item => {
      if (mode === 'free' && !isGiveaway(item)) return false;
      if (mode === 'affordable' && (isGiveaway(item) || item.price <= 0 || item.price > 200000)) return false;
      const haystack = removeVietnameseTones([item.title, item.description, item.category].join(' '));
      if (needle && !haystack.includes(needle)) return false;
      if (local && !removeVietnameseTones([item.location, item.address].join(' ')).includes(local)) return false;
      if (category !== 'all' && !categoryWords.some(word => haystack.includes(word))) return false;
      return true;
    });
  }, [items, mode, search, area, category]);

  const canShowMap = visible.some(item => Number.isFinite(item.lat) && Number.isFinite(item.lng) && item.lat && item.lng);
  const mapItem = visible.find(item => item.lat && item.lng);
  const mapCenter: [number, number] = mapItem?.lat && mapItem?.lng ? [mapItem.lat, mapItem.lng] : [21.0285, 105.8542];
  const destination = user ? '/post?mode=give' : '/login';

  return (
    <div className="min-h-screen bg-[#f7f8f3] text-[#183e2e] pb-24 md:pb-8">
      <Helmet>
        <title>Chợ Của Tui – Cho đi để nhận lại niềm vui</title>
        <meta name="description" content="Chia sẻ đồ dùng, tìm món quà miễn phí và kết nối hàng xóm trên Chợ Của Tui." />
      </Helmet>

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#e5eee7]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-[72px] flex items-center justify-between gap-4">
          <Link to="/chia-se" className="flex items-center gap-2.5 shrink-0">
            <span className="w-11 h-11 bg-[#14634a] rounded-2xl flex items-center justify-center text-2xl shadow-sm">🎁</span>
            <span className="flex flex-col leading-tight">
              <strong className="text-lg md:text-xl tracking-tight">Chợ Của Tui</strong>
              <span className="text-[10px] md:text-xs text-[#648274] font-semibold">Cho đi • Kết nối • Tiết kiệm</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm font-semibold">
            <Link to="/chia-se" className="text-[#14634a]">Khám phá</Link>
            <Link to="/chat" className="hover:text-[#14634a]">Tin nhắn</Link>
            <Link to="/profile" className="hover:text-[#14634a]">Tài khoản</Link>
          </div>
          <Link to={destination} className="shrink-0 rounded-full bg-[#14634a] text-white px-4 py-3 md:px-6 font-bold text-xs md:text-sm hover:bg-[#0b4935] transition-colors">
            + Đăng tặng đồ
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8">
        <section className="relative mt-5 md:mt-9 overflow-hidden rounded-[28px] bg-[#14583f] text-white">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#63a883]/20" aria-hidden />
          <div className="absolute bottom-0 right-8 text-[150px] opacity-15 leading-none select-none hidden lg:block" aria-hidden>🎁</div>
          <div className="relative p-6 md:p-12 max-w-2xl">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">🌿 Cộng đồng sẻ chia gần bạn</span>
            <h1 className="mt-5 text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">Đồ bạn không dùng,<br /><span className="text-[#bde9c7]">có thể là món quà của ai đó.</span></h1>
            <p className="mt-4 text-sm md:text-base leading-7 text-[#ddf1e5]">Tặng lại đồ còn tốt, tìm đồ cần dùng, kết nối với hàng xóm. Dễ dàng, miễn phí và tử tế.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to={destination} className="rounded-full bg-[#ffda8b] text-[#214530] px-6 py-3 font-bold text-sm hover:bg-[#ffe7b7]">🎁 Tôi muốn tặng đồ</Link>
              <a href="#kham-pha" className="rounded-full border border-white/35 px-6 py-3 font-bold text-sm hover:bg-white/10">Khám phá quanh tôi</a>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2 md:gap-4 mt-5">
          {[
            { icon: '🎁', label: 'Tặng đồ', hint: 'Trao món đồ còn tốt' },
            { icon: '🤝', label: 'Nhận đồ', hint: 'Kết nối với người tặng' },
            { icon: '🌱', label: 'Sống xanh', hint: 'Giảm bỏ phí, thêm niềm vui' },
          ].map(item => (
            <div key={item.label} className="rounded-2xl bg-white border border-[#e9efe9] p-3 md:p-5 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
              <span className="text-2xl">{item.icon}</span>
              <div><strong className="text-xs md:text-base block">{item.label}</strong><p className="hidden md:block text-xs text-[#7c9387] mt-1">{item.hint}</p></div>
            </div>
          ))}
        </section>

        <section id="kham-pha" className="mt-9 md:mt-12 scroll-mt-28">
          <div className="flex justify-between gap-4 items-end mb-5">
            <div>
              <span className="uppercase text-[11px] text-[#4c8d69] tracking-[.15em] font-bold">KHÁM PHÁ</span>
              <h2 className="text-2xl md:text-3xl font-extrabold mt-1">Có gì quanh bạn?</h2>
              <p className="text-sm text-[#6f8277] mt-2">Tìm đồ dùng hữu ích trong cộng đồng của mình.</p>
            </div>
            <Link to="/post?mode=give" className="hidden md:inline-flex text-sm font-bold text-[#157251] hover:underline">Đăng một món quà →</Link>
          </div>

          <div className="bg-white border border-[#e7eee8] shadow-sm rounded-[24px] p-3 md:p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_280px]">
              <label className="flex items-center gap-2 px-4 rounded-2xl bg-[#f5f8f5] border border-[#e1ebe3] h-12 focus-within:border-[#5fae84]">
                <span aria-hidden>🔎</span>
                <input aria-label="Tìm món đồ" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Bạn đang tìm gì? Sách, bàn học, đồ em bé..." className="w-full bg-transparent outline-none text-sm placeholder:text-[#97a79d]" />
              </label>
              <label className="flex items-center gap-2 px-4 rounded-2xl bg-[#f5f8f5] border border-[#e1ebe3] h-12 focus-within:border-[#5fae84]">
                <span aria-hidden>📍</span>
                <input aria-label="Lọc theo khu vực" value={area} onChange={e=>setArea(e.target.value)} placeholder="Nhập tỉnh, thành phố..." className="w-full bg-transparent outline-none text-sm placeholder:text-[#97a79d]" />
              </label>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {([
                ['free','🎁 Tặng miễn phí'],['affordable','🏷️ Giá dưới 200k'],['all','✨ Xem tất cả']
              ] as [FeedMode,string][]).map(([id,label])=>(
                <button type="button" key={id} onClick={()=>setMode(id)} className={`rounded-full px-4 py-2.5 text-xs md:text-sm font-bold transition-colors ${mode === id ? 'bg-[#14634a] text-white' : 'bg-[#eef4ef] text-[#486958] hover:bg-[#deece1]'}`}>{label}</button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {categories.map(cat=>(
              <button type="button" key={cat.id} onClick={()=>setCategory(cat.id)} className={`shrink-0 flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold border transition-colors ${category===cat.id ? 'bg-[#e6f4e8] border-[#9bceb0] text-[#14583f]' : 'bg-white border-[#e7eee8] text-[#566d60]'}`}><span className="text-lg">{cat.emoji}</span>{cat.label}</button>
            ))}
          </div>

          <div className="mt-7 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl md:text-2xl font-extrabold">{mode === 'free' ? 'Những món quà đang chờ bạn' : mode === 'affordable' ? 'Món đồ nhỏ, giá dễ thương' : 'Tin đăng mới nhất'}</h3>
              <p className="text-sm text-[#789082] mt-1">Khu vực: {describeArea(area)} · {loading ? 'Đang tải...' : `${visible.length} tin trong dữ liệu đã tải`}</p>
            </div>
            <div className="flex shrink-0 rounded-xl bg-white p-1 border border-[#e7eee8]">
              <button type="button" onClick={()=>setView('grid')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view==='grid' ? 'bg-[#e6f4e8] text-[#14634a]' : 'text-[#819386]'}`}>▦ Lưới</button>
              <button type="button" onClick={()=>setView('map')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view==='map' ? 'bg-[#e6f4e8] text-[#14634a]' : 'text-[#819386]'}`}>⌖ Bản đồ</button>
            </div>
          </div>

          {error && <p role="alert" className="mt-4 p-4 rounded-2xl bg-red-50 text-red-700 text-sm">{error}</p>}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5 mt-6">
              {Array.from({length:8}).map((_,i)=><div key={i} className="h-72 rounded-2xl bg-white animate-pulse border border-[#e7eee8]"/>)}
            </div>
          ) : visible.length === 0 ? (
            <div className="mt-6 bg-white border border-dashed border-[#c7dccc] rounded-3xl p-9 md:p-14 text-center">
              <span className="text-5xl block">🎁</span>
              <h4 className="font-extrabold text-xl mt-5">{mode === 'free' ? 'Chưa có món quà nào trong các tin đã tải' : 'Chưa tìm thấy món đồ phù hợp'}</h4>
              <p className="text-sm text-[#789082] leading-6 mt-3 max-w-md mx-auto">Thử bỏ lọc địa phương hoặc chọn danh mục khác. Tin đăng từ chợ cũ không tự động được coi là đồ tặng.</p>
              <Link to={destination} className="inline-flex mt-6 rounded-full bg-[#14634a] text-white px-6 py-3 text-sm font-bold">Đăng món đồ đầu tiên</Link>
            </div>
          ) : view === 'map' && canShowMap ? (
            <div className="mt-5 rounded-2xl overflow-hidden border border-[#e7eee8]"><MapView listings={visible} center={mapCenter}/></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5 mt-6">
              {visible.map(item => (
                <Link to={getListingUrl(item)} key={item.id} className="group rounded-[22px] overflow-hidden bg-white border border-[#e6ece6] shadow-sm hover:shadow-lg transition-shadow">
                  <div className="aspect-[4/3] overflow-hidden relative bg-[#eef4ef]">
                    {item.images?.[0] ? <img src={item.images[0]} alt={item.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/> : <div className="w-full h-full flex items-center justify-center text-5xl">📦</div>}
                    <span className={`absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] font-extrabold ${isGiveaway(item) ? 'bg-[#dcfbe5] text-[#14634a]' : 'bg-white text-[#b0572c]'}`}>{isGiveaway(item) ? '🎁 TẶNG MIỄN PHÍ' : 'ĐỒ GIÁ TỐT'}</span>
                  </div>
                  <div className="p-3.5 md:p-4">
                    <h4 className="font-bold text-sm leading-6 line-clamp-2 min-h-[48px]">{item.title}</h4>
                    <p className="text-[#14634a] text-base font-extrabold mt-2">{isGiveaway(item) ? 'Miễn phí' : item.price > 0 ? formatPrice(item.price) : 'Liên hệ'}</p>
                    <p className="text-xs text-[#829589] mt-2 line-clamp-1">📍 {item.location || 'Chưa rõ khu vực'}</p>
                    <div className="mt-3 pt-3 border-t border-[#edf0ec] flex justify-between items-center gap-1 text-[11px] text-[#87968c]">
                      <span>{formatTimeAgo(item.createdAt)}</span>
                      <span className="font-bold text-[#157251]">{isGiveaway(item) ? 'Xin nhận →' : 'Xem tin →'}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {!loading && hasMore && <div className="text-center mt-8"><button type="button" onClick={loadMore} disabled={loadingMore} className="rounded-full bg-white border border-[#b7d3bf] px-8 py-3 text-sm font-bold hover:bg-[#eaf5ec] disabled:opacity-60">{loadingMore ? 'Đang tải thêm...' : 'Xem thêm tin đăng'}</button></div>}
        </section>

        <section className="mt-12 mb-8 bg-[#e7f3e9] rounded-[28px] p-6 md:p-10 flex flex-col md:flex-row md:items-center gap-5 justify-between">
          <div><h3 className="font-extrabold text-2xl">Nhà bạn có món đồ còn tốt?</h3><p className="text-sm text-[#5e7c67] mt-2">Đừng vội bỏ đi. Hãy đăng tặng để món đồ có thêm một vòng đời mới.</p></div>
          <Link to={destination} className="inline-flex justify-center shrink-0 rounded-full px-7 py-3.5 bg-[#14634a] text-white font-bold text-sm">Tặng đồ ngay 🎁</Link>
        </section>
      </main>

      <nav aria-label="Điều hướng cộng đồng" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#e8efe7] h-[calc(66px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] grid grid-cols-4 items-center text-center">
        <Link to="/chia-se" className="text-[#14634a] text-xs font-bold flex flex-col gap-1 items-center"><span className="text-xl">⌂</span>Khám phá</Link>
        <Link to="/post?mode=give" className="text-[#14634a] text-xs font-bold flex flex-col gap-1 items-center"><span className="text-xl">⊕</span>Đăng tặng</Link>
        <Link to="/chat" className="text-[#728778] text-xs font-bold flex flex-col gap-1 items-center"><span className="text-xl">▤</span>Tin nhắn</Link>
        <Link to="/profile" className="text-[#728778] text-xs font-bold flex flex-col gap-1 items-center"><span className="text-xl">♙</span>Tôi</Link>
      </nav>
    </div>
  );
};

export default CommunityHome;
