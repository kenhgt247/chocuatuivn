import React, { useState, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../services/db';
import { LOCATIONS } from '../constants'; // Đảm bảo bạn có file này hoặc define mảng LOCATIONS ở đây
import { getLocationFromCoords } from '../utils/locationHelper';

// --- LEAFLET MAP ---
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// --- ICONS (Lấy từ bộ icon bạn cung cấp) ---
const IconUser = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconMail = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const IconLock = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconPhone = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const IconMapPin = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconStore = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IconArrowRight = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const IconArrowLeft = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
const IconCheck = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconZap = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IconLoader2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;

// --- CONFIG MAP ---
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const DraggableMarker = ({ position, onDragEnd }: { position: {lat: number, lng: number}, onDragEnd: (lat: number, lng: number) => void }) => {
    const markerRef = useRef<L.Marker>(null);
    useMapEvents({ click(e) { onDragEnd(e.latlng.lat, e.latlng.lng); } });
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

// --- MAIN COMPONENT ---
const Register: React.FC<{ onLogin: (user: any) => void }> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Info, 2: Detail, 3: Location
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    // Step 1
    email: '',
    password: '',
    confirmPassword: '',
    // Step 2
    name: '',
    phone: '',
    gender: 'male', // male | female | other
    storeName: '', // Tên cửa hàng (Optional)
    // Step 3
    location: 'TPHCM', // Thành phố/Tỉnh
    address: '',
    lat: 10.762622, 
    lng: 106.660172
  });

  // Handle Input Change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Logic GPS
  const pickCurrentLocation = () => {
    if (!navigator.geolocation) return alert("Trình duyệt không hỗ trợ GPS");
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        setFormData(prev => ({ ...prev, lat: latitude, lng: longitude }));
        try {
            const info = await getLocationFromCoords(latitude, longitude);
            setFormData(prev => ({ ...prev, address: info.address, location: info.city }));
        } catch (e) { console.error(e); }
    }, () => alert("Vui lòng bật định vị."));
  };

  const handleMarkerDragEnd = async (lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, lat, lng }));
    const info = await getLocationFromCoords(lat, lng);
    setFormData(prev => ({ ...prev, address: info.address, location: info.city }));
  };

  // Next Step Validation
  const handleNext = () => {
    setError('');
    if (step === 1) {
        if (!formData.email || !formData.password || !formData.confirmPassword) return setError("Vui lòng nhập đủ thông tin.");
        if (formData.password !== formData.confirmPassword) return setError("Mật khẩu không khớp.");
        if (formData.password.length < 6) return setError("Mật khẩu phải trên 6 ký tự.");
    }
    if (step === 2) {
        if (!formData.name) return setError("Vui lòng nhập Họ tên.");
        if (!formData.phone) return setError("Vui lòng nhập Số điện thoại.");
    }
    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  // Submit Final
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. Tạo User Auth
      const user = await db.register(formData.email, formData.password, formData.name);
      
      // 2. Cập nhật thông tin chi tiết vào Firestore
      const updatedUser = await db.updateUserProfile(user.id, {
        phone: formData.phone,
        gender: formData.gender,
        storeName: formData.storeName,
        location: formData.location,
        address: formData.address,
        lat: formData.lat,
        lng: formData.lng,
        role: 'user', // Mặc định
        verificationStatus: 'unverified'
      });

      onLogin(updatedUser);
      alert("🎉 Đăng ký thành công! Chào mừng bạn.");
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') setError("Email này đã được sử dụng.");
      else setError("Lỗi: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="bg-white border border-slate-100 rounded-[3rem] p-8 md:p-12 shadow-2xl w-full max-w-4xl relative overflow-hidden animate-fade-in-up">
        
        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-500/5 rounded-full -ml-32 -mb-32 blur-3xl"></div>

        {/* Header */}
        <div className="text-center mb-8 relative z-10">
            <h1 className="text-3xl font-black text-slate-900 mb-2">Đăng ký thành viên</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Bước {step} / 3: {step === 1 ? 'Tài khoản' : step === 2 ? 'Thông tin cá nhân' : 'Vị trí cửa hàng'}</p>
            
            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-100 rounded-full mt-4 overflow-hidden max-w-xs mx-auto">
                <div 
                    className="h-full bg-primary transition-all duration-500 ease-out" 
                    style={{ width: `${(step / 3) * 100}%` }}
                ></div>
            </div>
        </div>

        {error && (
            <div className="mb-6 bg-red-50 border border-red-100 text-red-500 p-4 rounded-2xl text-xs font-black text-center animate-pulse">
                {error}
            </div>
        )}

        <form onSubmit={handleRegister} className="relative z-10">
            
            {/* STEP 1: ACCOUNT */}
            {step === 1 && (
                <div className="space-y-6 max-w-md mx-auto animate-fade-in">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-3">Email đăng nhập</label>
                        <div className="relative">
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-12 font-bold text-sm focus:ring-2 ring-primary/20 transition-all" placeholder="name@email.com" autoFocus />
                            <IconMail className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-3">Mật khẩu</label>
                        <div className="relative">
                            <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-12 font-bold text-sm focus:ring-2 ring-primary/20 transition-all" placeholder="••••••••" />
                            <IconLock className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-3">Nhập lại mật khẩu</label>
                        <div className="relative">
                            <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-12 font-bold text-sm focus:ring-2 ring-primary/20 transition-all" placeholder="••••••••" />
                            <IconCheck className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: PROFILE INFO */}
            {step === 2 && (
                <div className="space-y-6 max-w-md mx-auto animate-fade-in">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-3">Họ và tên</label>
                        <div className="relative">
                            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-12 font-bold text-sm focus:ring-2 ring-primary/20 transition-all" placeholder="Nguyễn Văn A" autoFocus />
                            <IconUser className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-3">Số điện thoại</label>
                        <div className="relative">
                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-12 font-bold text-sm focus:ring-2 ring-primary/20 transition-all" placeholder="0909xxxxxx" />
                            <IconPhone className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-3">Tên Cửa hàng (Tùy chọn)</label>
                        <div className="relative">
                            <input type="text" name="storeName" value={formData.storeName} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-12 font-bold text-sm focus:ring-2 ring-primary/20 transition-all" placeholder="Shop của Tui" />
                            <IconStore className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-3">Giới tính</label>
                        <div className="flex gap-4">
                            {['male', 'female', 'other'].map(g => (
                                <label key={g} className={`flex-1 cursor-pointer py-3 rounded-2xl border-2 text-center text-xs font-black uppercase transition-all ${formData.gender === g ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                                    <input type="radio" name="gender" value={g} checked={formData.gender === g} onChange={handleChange} className="hidden" />
                                    {g === 'male' ? 'Nam' : g === 'female' ? 'Nữ' : 'Khác'}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: LOCATION & MAP */}
            {step === 3 && (
                <div className="grid lg:grid-cols-2 gap-8 animate-fade-in">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-3">Khu vực / Tỉnh thành</label>
                            <select name="location" value={formData.location} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-sm focus:ring-2 ring-primary/20 transition-all">
                                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-3">Địa chỉ cụ thể</label>
                            <div className="relative">
                                <textarea name="address" value={formData.address} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-12 font-bold text-sm h-32 resize-none focus:ring-2 ring-primary/20 transition-all" placeholder="Số nhà, tên đường..." />
                                <IconMapPin className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                            </div>
                        </div>
                        <button type="button" onClick={pickCurrentLocation} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                            <IconZap className="w-4 h-4" /> Lấy vị trí hiện tại của tôi
                        </button>
                    </div>

                    <div className="h-64 lg:h-auto rounded-[2.5rem] overflow-hidden border-4 border-slate-50 shadow-inner relative z-0">
                         <MapContainer center={[formData.lat, formData.lng]} zoom={15} scrollWheelZoom={false} style={{height:'100%',width:'100%'}}>
                            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <DraggableMarker position={{ lat: formData.lat, lng: formData.lng }} onDragEnd={handleMarkerDragEnd} />
                        </MapContainer>
                    </div>
                </div>
            )}

            {/* NAVIGATION BUTTONS */}
            <div className="flex items-center justify-between mt-10 max-w-md mx-auto lg:max-w-none">
                {step > 1 ? (
                    <button type="button" onClick={handleBack} className="px-8 py-4 rounded-2xl font-bold text-xs uppercase text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all flex items-center gap-2">
                        <IconArrowLeft className="w-4 h-4" /> Quay lại
                    </button>
                ) : (
                    <div className="w-10"></div> /* Spacer */
                )}

                {step < 3 ? (
                    <button type="button" onClick={handleNext} className="px-8 py-4 rounded-2xl font-black text-xs uppercase text-white bg-primary shadow-lg shadow-primary/30 hover:bg-primaryHover transition-all flex items-center gap-2 active:scale-95">
                        Tiếp tục <IconArrowRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button type="submit" disabled={isLoading} className="px-12 py-4 rounded-2xl font-black text-xs uppercase text-white bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-200 hover:scale-105 transition-all flex items-center gap-2 active:scale-95">
                        {isLoading ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconCheck className="w-4 h-4" />}
                        {isLoading ? 'Đang tạo...' : 'Hoàn tất Đăng ký'}
                    </button>
                )}
            </div>

            <div className="mt-8 text-center">
                 <p className="text-[10px] text-slate-400 font-black uppercase">
                    Đã có tài khoản? <Link to="/login" className="text-primary hover:underline">Đăng nhập</Link>
                </p>
            </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
