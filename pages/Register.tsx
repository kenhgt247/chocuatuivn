// ... (Giữ nguyên các import và icon ở trên)

// --- MAIN COMPONENT ---
const Register: React.FC<{ onLogin: (user: any) => void }> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Thêm state để kiểm tra người dùng đã chọn vị trí chưa
  const [isLocationPicked, setIsLocationPicked] = useState(false); 

  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '',
    name: '', phone: '', gender: 'male', storeName: '',
    location: 'TPHCM', address: '',
    lat: 10.762622, lng: 106.660172
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Logic GPS (Đã thêm setIsLocationPicked(true))
  const pickCurrentLocation = () => {
    if (!navigator.geolocation) return alert("Trình duyệt không hỗ trợ GPS");
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        setFormData(prev => ({ ...prev, lat: latitude, lng: longitude }));
        setIsLocationPicked(true); // Đánh dấu đã chọn
        try {
            const info = await getLocationFromCoords(latitude, longitude);
            setFormData(prev => ({ ...prev, address: info.address, location: info.city }));
        } catch (e) { console.error(e); }
    }, () => alert("Vui lòng bật định vị để lấy vị trí chính xác."));
  };

  const handleMarkerDragEnd = async (lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, lat, lng }));
    setIsLocationPicked(true); // Đánh dấu đã chọn khi kéo thả
    const info = await getLocationFromCoords(lat, lng);
    setFormData(prev => ({ ...prev, address: info.address, location: info.city }));
  };

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
        
        // 🔥 TỰ ĐỘNG LẤY VỊ TRÍ KHI SANG BƯỚC 3
        setTimeout(() => pickCurrentLocation(), 500); 
    }
    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 🔥 KIỂM TRA: Bắt buộc phải chọn vị trí hoặc nhập địa chỉ
    if (!isLocationPicked && !formData.address) {
        return setError("Vui lòng chọn vị trí trên bản đồ hoặc nhập địa chỉ.");
    }

    setIsLoading(true);

    try {
      const user = await db.register(formData.email, formData.password, formData.name);
      const updatedUser = await db.updateUserProfile(user.id, {
        phone: formData.phone,
        gender: formData.gender,
        storeName: formData.storeName,
        location: formData.location,
        address: formData.address,
        lat: formData.lat,
        lng: formData.lng,
        role: 'user', 
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

  // ... (Phần render giữ nguyên, chỉ chú ý phần hiển thị lỗi và nút submit)
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="bg-white border border-slate-100 rounded-[3rem] p-8 md:p-12 shadow-2xl w-full max-w-4xl relative overflow-hidden animate-fade-in-up">
        
        {/* ... (Phần Background & Header giữ nguyên) ... */}

        {/* Hiển thị lỗi nổi bật hơn */}
        {error && (
            <div className="mb-6 bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-xs font-black text-center animate-pulse flex items-center justify-center gap-2">
                <IconAlertTriangle className="w-4 h-4" /> {error}
            </div>
        )}

        <form onSubmit={handleRegister} className="relative z-10">
            
            {/* STEP 1 & 2: GIỮ NGUYÊN ... */}
            {step === 1 && ( /* ... code step 1 ... */ <Step1Content formData={formData} handleChange={handleChange} /> )}
            {step === 2 && ( /* ... code step 2 ... */ <Step2Content formData={formData} handleChange={handleChange} /> )}

            {/* STEP 3: LOCATION & MAP (Cập nhật UI nhắc nhở) */}
            {step === 3 && (
                <div className="grid lg:grid-cols-2 gap-8 animate-fade-in">
                    <div className="space-y-6">
                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-700 text-xs font-bold flex items-start gap-2">
                             <IconMapPin className="w-5 h-5 flex-shrink-0" />
                             <p>Hãy kéo thả ghim đỏ trên bản đồ để chọn chính xác vị trí nhà/cửa hàng của bạn.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-3">Khu vực</label>
                            <select name="location" value={formData.location} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-sm focus:ring-2 ring-primary/20 transition-all">
                                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-3">Địa chỉ cụ thể</label>
                            <div className="relative">
                                <textarea name="address" value={formData.address} onChange={(e) => { handleChange(e); setIsLocationPicked(true); }} className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-12 font-bold text-sm h-28 resize-none focus:ring-2 ring-primary/20 transition-all" placeholder="Số nhà, tên đường..." />
                                <IconMapPin className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                            </div>
                        </div>
                        <button type="button" onClick={pickCurrentLocation} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                            <IconZap className="w-4 h-4" /> Lấy vị trí hiện tại
                        </button>
                    </div>

                    <div className="h-64 lg:h-auto rounded-[2.5rem] overflow-hidden border-4 border-slate-50 shadow-inner relative z-0">
                         <MapContainer center={[formData.lat, formData.lng]} zoom={15} scrollWheelZoom={false} style={{height:'100%',width:'100%'}}>
                            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <DraggableMarker position={{ lat: formData.lat, lng: formData.lng }} onDragEnd={handleMarkerDragEnd} />
                        </MapContainer>
                        {/* Overlay nhắc nhở nếu chưa chọn */}
                        {!isLocationPicked && !formData.address && (
                            <div className="absolute inset-0 bg-black/10 z-[1000] pointer-events-none flex items-center justify-center">
                                <span className="bg-white/90 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-slate-600 shadow-lg backdrop-blur-sm animate-bounce">👇 Kéo ghim để chọn</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* NAVIGATION BUTTONS */}
            <div className="flex items-center justify-between mt-10 max-w-md mx-auto lg:max-w-none">
                {step > 1 ? (
                    <button type="button" onClick={handleBack} className="px-8 py-4 rounded-2xl font-bold text-xs uppercase text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all flex items-center gap-2">
                        <IconArrowLeft className="w-4 h-4" /> Quay lại
                    </button>
                ) : <div className="w-10"></div>}

                {step < 3 ? (
                    <button type="button" onClick={handleNext} className="px-8 py-4 rounded-2xl font-black text-xs uppercase text-white bg-primary shadow-lg shadow-primary/30 hover:bg-primaryHover transition-all flex items-center gap-2 active:scale-95">
                        Tiếp tục <IconArrowRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button type="submit" disabled={isLoading} className={`px-12 py-4 rounded-2xl font-black text-xs uppercase text-white shadow-lg transition-all flex items-center gap-2 active:scale-95 ${(!isLocationPicked && !formData.address) ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-green-200 hover:scale-105'}`}>
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

// (Giữ nguyên các Component phụ Step1Content, Step2Content nếu bạn đã tách ra, hoặc paste code cũ vào)
// ...
