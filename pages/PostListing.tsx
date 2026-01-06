const renderDynamicFields = () => {
    const inputStyle = "w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all shadow-sm";
    const labelStyle = "text-[10px] font-black text-gray-400 uppercase tracking-widest px-1";
    const wrapperStyle = "space-y-1.5";

    const updateAttr = (key: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            attributes: { ...prev.attributes, [key]: value }
        }));
    };

    switch (formData.category) {
        case '1': // Bất động sản
            return (
                <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
                    <div className={wrapperStyle}><label className={labelStyle}>Diện tích (m²)</label><input type="number" placeholder="m²" className={inputStyle} value={formData.attributes.area || ''} onChange={(e) => updateAttr('area', e.target.value)} /></div>
                    <div className={wrapperStyle}><label className={labelStyle}>Số phòng ngủ</label><input type="number" placeholder="Phòng" className={inputStyle} value={formData.attributes.bedrooms || ''} onChange={(e) => updateAttr('bedrooms', e.target.value)} /></div>
                    <div className={wrapperStyle}><label className={labelStyle}>Số WC</label><input type="number" placeholder="Phòng" className={inputStyle} value={formData.attributes.bathrooms || ''} onChange={(e) => updateAttr('bathrooms', e.target.value)} /></div>
                    <div className={wrapperStyle}>
                        <label className={labelStyle}>Hướng nhà</label>
                        <select className={inputStyle} value={formData.attributes.direction || ''} onChange={(e) => updateAttr('direction', e.target.value)}>
                            <option value="">Chọn hướng</option>
                            {['Đông', 'Tây', 'Nam', 'Bắc', 'Đông Bắc', 'Đông Nam', 'Tây Bắc', 'Tây Nam'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div className={wrapperStyle}>
                        <label className={labelStyle}>Pháp lý</label>
                        <select className={inputStyle} value={formData.attributes.legal || ''} onChange={(e) => updateAttr('legal', e.target.value)}>
                            <option value="">Giấy tờ</option>
                            {['Sổ hồng/Sổ đỏ', 'Đang chờ sổ', 'Giấy tờ tay'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div className={wrapperStyle}>
                        <label className={labelStyle}>Loại hình</label>
                        <select className={inputStyle} value={formData.attributes.propertyType || ''} onChange={(e) => updateAttr('propertyType', e.target.value)}>
                            <option value="">Chọn loại</option>
                            {['Nhà ở', 'Căn hộ/Chung cư', 'Đất nền'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                </div>
            );

        case '2': // Xe cộ
            return (
                <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
                    <div className={wrapperStyle}><label className={labelStyle}>Số Km (ODO)</label><input type="number" placeholder="Km" className={inputStyle} value={formData.attributes.mileage || ''} onChange={(e) => updateAttr('mileage', e.target.value)} /></div>
                    <div className={wrapperStyle}><label className={labelStyle}>Năm sản xuất</label><input type="number" placeholder="YYYY" className={inputStyle} value={formData.attributes.year || ''} onChange={(e) => updateAttr('year', e.target.value)} /></div>
                    <div className={wrapperStyle}>
                        <label className={labelStyle}>Hộp số</label>
                        <select className={inputStyle} value={formData.attributes.gearbox || ''} onChange={(e) => updateAttr('gearbox', e.target.value)}>
                            <option value="">Chọn</option>
                            <option value="Số tự động">Số tự động</option>
                            <option value="Số sàn">Số sàn</option>
                        </select>
                    </div>
                    <div className={wrapperStyle}>
                        <label className={labelStyle}>Nhiên liệu</label>
                        <select className={inputStyle} value={formData.attributes.fuel || ''} onChange={(e) => updateAttr('fuel', e.target.value)}>
                            <option value="">Chọn</option>
                            {['Xăng', 'Dầu', 'Điện', 'Hybrid'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div className={wrapperStyle}><label className={labelStyle}>Kiểu dáng</label><input type="text" placeholder="Sedan, SUV..." className={inputStyle} value={formData.attributes.carType || ''} onChange={(e) => updateAttr('carType', e.target.value)} /></div>
                    <div className={wrapperStyle}><label className={labelStyle}>Số chỗ</label><input type="number" placeholder="Chỗ" className={inputStyle} value={formData.attributes.seatCount || ''} onChange={(e) => updateAttr('seatCount', e.target.value)} /></div>
                </div>
            );

        case '3': // Đồ điện tử
            return (
                <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
                    <div className={wrapperStyle}><label className={labelStyle}>Pin (%)</label><input type="number" placeholder="%" className={inputStyle} value={formData.attributes.battery || ''} onChange={(e) => updateAttr('battery', e.target.value)} /></div>
                    <div className={wrapperStyle}><label className={labelStyle}>Dung lượng</label><input type="text" placeholder="128GB, 256GB..." className={inputStyle} value={formData.attributes.storage || ''} onChange={(e) => updateAttr('storage', e.target.value)} /></div>
                    <div className={wrapperStyle}><label className={labelStyle}>RAM</label><input type="text" placeholder="8GB, 16GB..." className={inputStyle} value={formData.attributes.ram || ''} onChange={(e) => updateAttr('ram', e.target.value)} /></div>
                    <div className={wrapperStyle}><label className={labelStyle}>Màu sắc</label><input type="text" placeholder="Titanium, Gold..." className={inputStyle} value={formData.attributes.color || ''} onChange={(e) => updateAttr('color', e.target.value)} /></div>
                    <div className={wrapperStyle}><label className={labelStyle}>Bảo hành</label><input type="text" placeholder="Tình trạng BH" className={inputStyle} value={formData.attributes.warranty || ''} onChange={(e) => updateAttr('warranty', e.target.value)} /></div>
                </div>
            );

        case '11': // Việc làm
            return (
                <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
                    <div className={wrapperStyle}><label className={labelStyle}>Mức lương</label><input type="text" placeholder="Lương" className={inputStyle} value={formData.attributes.salary || ''} onChange={(e) => updateAttr('salary', e.target.value)} /></div>
                    <div className={wrapperStyle}><label className={labelStyle}>Kinh nghiệm</label><input type="text" placeholder="Kinh nghiệm" className={inputStyle} value={formData.attributes.experience || ''} onChange={(e) => updateAttr('experience', e.target.value)} /></div>
                    <div className={wrapperStyle}>
                        <label className={labelStyle}>Hình thức</label>
                        <select className={inputStyle} value={formData.attributes.jobType || ''} onChange={(e) => updateAttr('jobType', e.target.value)}>
                            <option value="">Chọn</option>
                            {['Toàn thời gian', 'Bán thời gian', 'Làm tại nhà', 'Thời vụ'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                </div>
            );

        case '8': // Thú cưng
            return (
                <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
                    <div className={wrapperStyle}><label className={labelStyle}>Giống loài</label><input type="text" placeholder="Giống" className={inputStyle} value={formData.attributes.breed || ''} onChange={(e) => updateAttr('breed', e.target.value)} /></div>
                    <div className={wrapperStyle}><label className={labelStyle}>Độ tuổi</label><input type="text" placeholder="Tuổi" className={inputStyle} value={formData.attributes.age || ''} onChange={(e) => updateAttr('age', e.target.value)} /></div>
                    <div className={wrapperStyle}>
                        <label className={labelStyle}>Giới tính</label>
                        <select className={inputStyle} value={formData.attributes.gender || ''} onChange={(e) => updateAttr('gender', e.target.value)}>
                            <option value="">Chọn</option>
                            <option value="Đực">Đực</option>
                            <option value="Cái">Cái</option>
                        </select>
                    </div>
                </div>
            );

        default:
            return null;
    }
};
export default PostListing;
