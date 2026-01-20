import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { User, Listing } from '../types';
import ListingCard from '../components/ListingCard';
import { LOCATIONS } from '../constants';
import { formatPrice } from '../utils/format';
import { getLocationFromCoords } from '../utils/locationHelper'; 
import { compressAndGetBase64 } from '../utils/imageCompression';

// --- Import Leaflet cho bản đồ ---
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// --- IMPORT ICON VECTOR ---
import { 
  Camera, Settings, Package, Heart, Shield, LogOut, Upload, MapPin, 
  User as UserIcon, Mail, Phone, Home, Crown, Diamond, CheckCircle, 
  AlertTriangle, Loader2, CreditCard, ChevronRight, Edit2, ShieldCheck, 
  FileText, Clock, Zap
} from 'lucide-react';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const DraggableMarker = ({ position, onDragEnd }: { position: {lat: number, lng: number}, onDragEnd: (lat: number, lng: number) => void }) => {
    const markerRef = useRef<L.Marker>(null);
    useMapEvents({
        click(e) { onDragEnd(e.latlng.lat, e.latlng.lng); },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const eventHandlers = useMemo(() => ({
        dragend() {
          const marker = markerRef.current;
          if (marker != null) {
            const { lat, lng } = marker.getLatLng();
            onDragEnd(lat, lng);
          }
        },
    }), [onDragEnd]);
  
    return <Marker draggable={true} eventHandlers={eventHandlers} position={position} ref={markerRef} />;
}

interface ModalState {
    show: boolean; title: string; message: string; onConfirm: () => void; type: 'push' | 'delete' | 'alert';
}

const Profile: React.FC<{ user: User | null, onLogout: () => void, onUpdateUser: (u: User) => void }> = ({ user, onLogout, onUpdateUser }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'listings' | 'favorites' | 'settings'>('listings');
    const [myListings, setMyListings] = useState<Listing[]>([]);
    const [myFavs, setMyFavs] = useState<Listing[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isPushing, setIsPushing] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isFindingChat, setIsFindingChat] = useState<string | null>(null);
    const [modal, setModal] = useState<ModalState>({ show: false, title: '', message: '', type: 'alert', onConfirm: () => {} });

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [kycFiles, setKycFiles] = useState<{front: File | null, back: File | null}>({ front: null, back: null });
    const [kycPreviews, setKycPreviews] = useState<{front: string | null, back: string | null}>({ front: null, back: null });
    const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

    const [editForm, setEditForm] = useState({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        location: user?.location || 'TPHCM',
        address: user?.address || '',
        lat: user?.lat || 10.762622,
        lng: user?.lng || 106.660172
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        const loadProfileData = async () => {
            const [all, s] = await Promise.all([db.getListings(true), db.getSettings()]);
            setMyListings(all.filter(l => String(l.sellerId) === String(user.id)));
            setSettings(s);
            const favIds = await db.getFavorites(user.id);
            setMyFavs(all.filter(l => favIds.includes(l.id)));
            setEditForm(prev => ({
                ...prev, name: user.name, email: user.email, phone: user.phone || '',
                location: user.location || 'TPHCM', address: user.address || '',
                lat: user.lat || 10.762622, lng: user.lng || 106.660172
            }));
        };
        loadProfileData();
    }, [user, navigate]);

    const subscriptionData = useMemo(() => {
        if (!user || user.subscriptionTier === 'free' || !user.subscriptionExpires) 
            return { isExpired: true, daysRemaining: 0, effectiveTier: 'free', expiryDate: '' };
        const expires = new Date(user.subscriptionExpires);
        const now = new Date();
        const diffTime = expires.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isExpired = diffTime <= 0;
        return {
            daysRemaining: diffDays > 0 ? diffDays : 0,
            expiryDate: expires.toLocaleDateString('vi-VN'),
            isExpired, effectiveTier: isExpired ? 'free' : user.subscriptionTier
        };
    }, [user]);

    if (!user) return null;

    // --- AVATAR LOGIC ---
    const handleAvatarClick = () => avatarInputRef.current?.click();
    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) return alert("Vui lòng chọn file ảnh");
            setIsUploadingAvatar(true);
            try {
                const compressedBase64 = await compressAndGetBase64(file);
                const url = await db.uploadImage(compressedBase64, `avatars/${user.id}_${Date.now()}`);
                const updatedUser = await db.updateUserProfile(user.id, { avatar: url });
                onUpdateUser(updatedUser);
                alert("Đổi ảnh đại diện thành công!");
            } catch (error) { alert("Lỗi khi tải ảnh lên."); } 
            finally { setIsUploadingAvatar(false); }
        }
    };

    // --- KYC LOGIC ---
    const handleKycFileChange = (field: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setKycFiles(prev => ({ ...prev, [field]: file }));
            const reader = new FileReader();
            reader.onload = (ev) => setKycPreviews(prev => ({ ...prev, [field]: ev.target?.result as string }));
            reader.readAsDataURL(file);
        }
    };

    const handleSubmitKyc = async () => {
        if (!kycFiles.front || !kycFiles.back) return alert("Vui lòng tải đủ 2 mặt giấy tờ");
        if (!window.confirm("Xác nhận thông tin chính xác?")) return;
        setIsSubmittingKyc(true);
        try {
            const uploadPromises = [kycFiles.front, kycFiles.back].map(async (file) => {
                 const base64 = await compressAndGetBase64(file);
                 return await db.uploadImage(base64, `kyc/${user.id}_${Date.now()}_${Math.random()}`);
            });
            const urls = await Promise.all(uploadPromises);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updatedUser = await db.updateUserProfile(user.id, { 
                verificationStatus: 'pending', verificationDocuments: urls 
            } as any);
            onUpdateUser(updatedUser);
            alert("Đã gửi hồ sơ xác thực!");
            setKycFiles({ front: null, back: null }); setKycPreviews({ front: null, back: null });
        } catch (error) { alert("Lỗi gửi hồ sơ."); } 
        finally { setIsSubmittingKyc(false); }
    };

    // --- DELETE LOGIC ---
    const handleDelete = (id: string) => {
        setModal({
            show: true, title: "Xóa tin đăng", message: "Hành động này không thể hoàn tác.", type: 'delete',
            onConfirm: async () => {
                setModal(prev => ({ ...prev, show: false }));
                try { await db.deleteListing(id); setMyListings(prev => prev.filter(l => l.id !== id)); } catch (e) { alert("Lỗi xóa tin"); }
            }
        });
    };

    const handleLogout = async () => { await db.logout(); onLogout(); navigate('/'); };
    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault(); setIsSaving(true);
        try {
            const updated = await db.updateUserProfile(user.id, editForm);
            onUpdateUser(updated); alert('Cập nhật thành công!');
        } catch (err) { alert("Lỗi cập nhật."); } finally { setIsSaving(false); }
    };

    const pickCurrentLocation = () => {
        if (!navigator.geolocation) return alert("Không hỗ trợ GPS");
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            setEditForm(prev => ({ ...prev, lat: latitude, lng: longitude }));
            try {
                const info = await getLocationFromCoords(latitude, longitude);
                setEditForm(prev => ({ ...prev, address: info.address, location: info.city }));
            } catch (e) { console.error(e); }
        }, () => alert("Vui lòng bật định vị."));
    };

    const handleMarkerDragEnd = async (lat: number, lng: number) => {
        setEditForm(prev => ({ ...prev, lat, lng }));
        const info = await getLocationFromCoords(lat, lng);
        setEditForm(prev => ({ ...prev, address: info.address, location: info.city }));
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderVerificationStatus = (u: any) => {
        const s = u.verificationStatus || 'unverified';
        if (s === 'verified') return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Xác thực</span>;
        if (s === 'pending') return <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Chờ duyệt</span>;
        return <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Chưa xác thực</span>;
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4 md:px-0 relative font-sans animate-fade-in">
            {/* Modal */}
            {modal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                    <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative animate-fade-in-up border border-white">
                        <h3 className="text-2xl font-black text-slate-900 mb-2">{modal.title}</h3>
                        <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">{modal.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setModal(prev => ({ ...prev, show: false }))} className="flex-1 py-4 rounded-2xl font-black text-xs uppercase bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Hủy</button>
                            <button onClick={modal.onConfirm} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase text-white shadow-lg transition-transform active:scale-95 ${modal.type === 'delete' ? 'bg-red-500' : 'bg-primary'}`}>Đồng ý</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Header */}
            <div className="bg-white border border-slate-100 rounded-[3rem] p-8 md:p-12 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                    <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                        <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                        <img src={user.avatar} className="w-28 h-28 md:w-40 md:h-40 rounded-[2.5rem] border-4 border-white shadow-2xl object-cover transition-all group-hover:brightness-90" alt="" />
                        {isUploadingAvatar ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[2.5rem]"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-[2.5rem]"><Camera className="text-white w-8 h-8" /></div>
                        )}
                        <div className="absolute -bottom-2 -right-2 bg-primary text-white p-3 rounded-2xl shadow-xl border-4 border-white hover:bg-primaryHover transition-colors"><Edit2 className="w-4 h-4" /></div>
                    </div>
                    
                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">{user.name}</h1>
                            {renderVerificationStatus(user)}
                            {user.role === 'admin' && (
                                <Link to="/admin" className="bg-red-500 text-white text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-widest shadow-lg shadow-red-200 hover:scale-105 transition-transform flex items-center gap-2">
                                    <Shield className="w-3 h-3" /> Admin Panel
                                </Link>
                            )}
                        </div>
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest flex items-center justify-center md:justify-start gap-3">
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {user.email}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {user.phone || 'Chưa có SĐT'}</span>
                        </p>
                        
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-4">
                            {/* THẺ HẠNG THÀNH VIÊN */}
                            <div className={`p-6 rounded-[2rem] border-2 shadow-lg min-w-[260px] relative overflow-hidden group ${subscriptionData.effectiveTier === 'free' ? 'bg-slate-50 border-slate-100' : 'bg-gradient-to-br from-yellow-500 to-orange-600 border-yellow-400 text-white shadow-yellow-100'}`}>
                                <div className="flex justify-between items-start relative z-10">
                                    <div>
                                        <p className="text-[10px] font-black uppercase opacity-70 tracking-widest flex items-center gap-1"><Crown className="w-3 h-3" /> Hạng thành viên</p>
                                        <h4 className="text-2xl font-black uppercase mt-1">{(settings?.tierConfigs as any)?.[subscriptionData.effectiveTier]?.name || 'Cơ bản'}</h4>
                                    </div>
                                    <Diamond className={`w-8 h-8 ${subscriptionData.effectiveTier === 'free' ? 'text-slate-300' : 'text-white/80'}`} strokeWidth={1} />
                                </div>
                                <div className="mt-6 flex items-center justify-between relative z-10">
                                    {!subscriptionData.isExpired ? <p className="text-xs font-bold opacity-80">Còn {subscriptionData.daysRemaining} ngày</p> : <p className="text-xs font-bold opacity-80">Trải nghiệm VIP ngay</p>}
                                    <Link to="/upgrade" className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${subscriptionData.effectiveTier === 'free' ? 'bg-primary text-white shadow-lg hover:bg-primaryHover' : 'bg-white/20 border border-white/30 text-white hover:bg-white/30'}`}>Nâng cấp</Link>
                                </div>
                            </div>

                            {/* THẺ VÍ */}
                            <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl min-w-[200px] flex flex-col justify-center group hover:border-primary/20 transition-all">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Số dư ví</p>
                                <p className="text-3xl font-black text-primary tracking-tighter">{formatPrice(user.walletBalance)}</p>
                                <Link to="/wallet" className="text-[10px] font-black text-primary/60 hover:text-primary mt-3 uppercase flex items-center gap-1 group-hover:translate-x-1 transition-transform">Nạp thêm tiền <ChevronRight className="w-3 h-3" /></Link>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="md:self-start text-slate-400 font-black px-6 py-2 text-[10px] uppercase tracking-[0.2em] hover:text-red-500 transition-colors flex items-center gap-2 bg-slate-50 rounded-xl">
                        <LogOut className="w-3 h-3" /> Đăng xuất
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1.5 bg-slate-100 rounded-[2rem] max-w-md mx-auto md:mx-0">
                {[
                    { id: 'listings', label: 'Tin đăng', icon: <Package className="w-4 h-4" /> },
                    { id: 'favorites', label: 'Đã lưu', icon: <Heart className="w-4 h-4" /> },
                    { id: 'settings', label: 'Cài đặt', icon: <Settings className="w-4 h-4" /> }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTab === tab.id ? 'bg-white text-primary shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                        {tab.icon} <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="mt-8">
                {activeTab === 'listings' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {myListings.map(listing => (
                            <div key={listing.id} className="flex flex-col gap-3 group animate-fade-in-up">
                                <div className="relative">
                                    <ListingCard listing={listing} />
                                    {/* STATUS BADGES */}
                                    {listing.status === 'sold' && (
                                        <div className="absolute top-2 right-2 z-30 pointer-events-none">
                                            <span className="bg-blue-600 text-white text-[7px] font-black px-2 py-1 rounded-lg uppercase shadow-lg border border-white flex items-center gap-1"><CheckCircle className="w-2 h-2" /> Thành công</span>
                                        </div>
                                    )}
                                    {listing.status === 'pending' && (
                                        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center rounded-lg z-20 backdrop-blur-[1px]">
                                            <span className="bg-white text-slate-900 text-[10px] font-black px-3 py-1.5 rounded-full uppercase shadow-xl flex items-center gap-1"><Clock className="w-3 h-3" /> Chờ duyệt</span>
                                        </div>
                                    )}
                                    {listing.status === 'rejected' && (
                                        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center rounded-lg z-20 backdrop-blur-[1px]">
                                            <span className="bg-white text-red-500 text-[10px] font-black px-3 py-1.5 rounded-full uppercase shadow-xl flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Từ chối</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex flex-col gap-2 relative z-40">
                                    <Link to={`/edit/${listing.id}`} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-2xl text-[10px] font-black uppercase text-center transition-all">Sửa tin</Link>
                                    <button onClick={() => handleDelete(listing.id)} className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-sm">Xóa tin</button>
                                </div>
                            </div>
                        ))}
                        {myListings.length === 0 && (
                            <div className="col-span-full py-40 text-center bg-white rounded-[3.5rem] border border-slate-100 flex flex-col items-center justify-center gap-4 shadow-inner">
                                <Package className="w-16 h-16 text-slate-200" strokeWidth={1} />
                                <p className="text-slate-300 font-black uppercase tracking-widest text-sm">Trống trải quá, đăng tin ngay!</p>
                                <Link to="/post" className="text-primary font-bold text-xs uppercase hover:underline">Đăng tin mới +</Link>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'favorites' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {myFavs.map(l => <ListingCard key={l.id} listing={l} isFavorite={true} />)}
                        {myFavs.length === 0 && (
                            <div className="col-span-full py-40 text-center bg-white rounded-[3.5rem] border border-slate-100 flex flex-col items-center justify-center gap-4 shadow-inner">
                                <Heart className="w-16 h-16 text-slate-200" strokeWidth={1} />
                                <p className="text-slate-300 font-black uppercase tracking-widest text-sm">Chưa lưu tin nào cả</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="bg-white border border-slate-100 rounded-[3.5rem] p-8 md:p-16 shadow-2xl space-y-16 animate-fade-in-up">
                        <form onSubmit={handleSaveSettings} className="space-y-16">
                            <div className="grid lg:grid-cols-2 gap-16">
                                <div className="space-y-10">
                                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-4">
                                        <span className="w-12 h-12 bg-blue-50 text-blue-500 rounded-[1.2rem] flex items-center justify-center"><UserIcon className="w-6 h-6" /></span> Hồ sơ cá nhân
                                    </h3>
                                    <div className="space-y-6">
                                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Họ và tên</label><input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-slate-50 border-none rounded-[1.2rem] p-4 font-bold text-sm focus:ring-2 ring-primary/20 transition-all" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Email</label><input type="email" value={editForm.email} className="w-full bg-slate-50 border-none rounded-[1.2rem] p-4 font-bold text-sm opacity-50 cursor-not-allowed" disabled /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Số điện thoại</label><input type="tel" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full bg-slate-50 border-none rounded-[1.2rem] p-4 font-bold text-sm focus:ring-2 ring-primary/20 transition-all" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Địa chỉ cụ thể</label><textarea value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className="w-full bg-slate-50 border-none rounded-[1.2rem] p-4 font-bold text-sm h-32 resize-none focus:ring-2 ring-primary/20 transition-all" /></div>
                                    </div>
                                </div>

                                <div className="space-y-10">
                                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-4">
                                        <span className="w-12 h-12 bg-red-50 text-red-500 rounded-[1.2rem] flex items-center justify-center"><MapPin className="w-6 h-6" /></span> Vị trí hiển thị
                                    </h3>
                                    <div className="space-y-6">
                                        <div className="flex gap-4">
                                            <div className="flex-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Khu vực</label><select value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} className="w-full bg-slate-50 border-none rounded-[1.2rem] p-4 font-bold text-sm mt-2">{LOCATIONS.map(l=><option key={l} value={l}>{l}</option>)}</select></div>
                                            <button type="button" onClick={pickCurrentLocation} className="mt-8 bg-slate-900 text-white p-4 rounded-[1.2rem] hover:bg-primary transition-all shadow-lg active:scale-95"><Zap className="w-6 h-6" /></button>
                                        </div>
                                        <div className="relative aspect-video rounded-[2.5rem] overflow-hidden border-4 border-slate-50 shadow-inner z-0">
                                            <MapContainer key={`${editForm.lat}-${editForm.lng}`} center={[editForm.lat, editForm.lng]} zoom={15} scrollWheelZoom={false} style={{height:'100%',width:'100%'}}>
                                                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                                <DraggableMarker position={{ lat: editForm.lat, lng: editForm.lng }} onDragEnd={handleMarkerDragEnd} />
                                            </MapContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end"><button type="submit" disabled={isSaving} className="px-16 py-5 bg-primary text-white font-black rounded-[1.5rem] shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center gap-2">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} {isSaving ? 'Đang cập nhật...' : 'Lưu tất cả thay đổi'}</button></div>
                        </form>

                        <div className="pt-16 border-t-4 border-dashed border-slate-50 space-y-10">
                            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-4">
                                <span className="w-12 h-12 bg-purple-50 text-purple-500 rounded-[1.2rem] flex items-center justify-center"><ShieldCheck className="w-6 h-6" /></span> Xác thực danh tính
                            </h3>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {((user as any).verificationStatus === 'verified') ? (
                                <div className="bg-green-50 rounded-[2.5rem] p-10 text-center border border-green-100 shadow-inner flex flex-col items-center">
                                    <ShieldCheck className="w-16 h-16 text-green-600 mb-4" strokeWidth={1.5} />
                                    <h4 className="text-xl font-black text-green-700 uppercase tracking-widest">Tài khoản chính chủ</h4>
                                    <p className="text-sm text-green-600/80 font-bold mt-2">Bạn đã có tích xanh uy tín và quyền lợi ưu tiên hiển thị.</p>
                                </div>
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            ) : ((user as any).verificationStatus === 'pending') ? (
                                <div className="bg-yellow-50 rounded-[2.5rem] p-10 text-center border border-yellow-100 shadow-inner animate-pulse flex flex-col items-center">
                                    <Clock className="w-16 h-16 text-yellow-600 mb-4" strokeWidth={1.5} />
                                    <h4 className="text-xl font-black text-yellow-700 uppercase tracking-widest">Đang kiểm duyệt</h4>
                                    <p className="text-sm text-yellow-600/80 font-bold mt-2">Hồ sơ của bạn đang được Admin xác minh.</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    <p className="text-slate-500 font-bold px-4">Tải lên ảnh CCCD để nhận dấu tích xanh uy tín và tăng tỉ lệ chốt đơn.</p>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        {['front', 'back'].map((side) => (
                                            <div key={side} className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{side === 'front' ? 'Mặt trước' : 'Mặt sau'}</label>
                                                <div className="relative aspect-video bg-slate-50 border-4 border-dashed border-slate-100 rounded-[2.5rem] overflow-hidden group cursor-pointer hover:border-primary/30 transition-colors">
                                                    <input type="file" className="absolute inset-0 opacity-0 z-10 cursor-pointer" onChange={(e) => handleKycFileChange(side as any, e)} accept="image/*" />
                                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                    {(kycPreviews as any)[side] ? (
                                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        <img src={(kycPreviews as any)[side]} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center h-full text-slate-300 group-hover:text-primary transition-colors">
                                                            <Upload className="w-10 h-10 mb-2" strokeWidth={1.5} />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">Chọn ảnh</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-end pt-4">
                                        <button onClick={handleSubmitKyc} disabled={isSubmittingKyc || !kycFiles.front || !kycFiles.back} className="px-12 py-5 bg-purple-600 text-white font-black rounded-[1.5rem] shadow-2xl shadow-purple-200 hover:bg-purple-700 active:scale-95 disabled:opacity-50 transition-all uppercase tracking-widest text-xs flex items-center gap-2">
                                            {isSubmittingKyc ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} {isSubmittingKyc ? 'Đang xử lý...' : 'Gửi hồ sơ xác thực'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;
