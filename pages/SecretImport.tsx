import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase'; // ⚠️ Kiểm tra lại đường dẫn này xem file firebase của bạn ở đâu

const SecretImport = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  
  // ID của tài khoản "Admin" hoặc "Sưu tầm" (Bạn lấy trong Authentication hoặc User list)
  const [sellerId, setSellerId] = useState(''); 

  const handleImport = async () => {
    if (!jsonInput || !sellerId) {
      alert("Thiếu JSON hoặc ID người bán!");
      return;
    }

    setLoading(true);
    setStatus("Đang phân tích dữ liệu...");

    try {
      const products = JSON.parse(jsonInput);

      if (!Array.isArray(products)) {
        alert("Lỗi: Dữ liệu không phải danh sách mảng []");
        setLoading(false);
        return;
      }

      let successCount = 0;
      
      // Chạy vòng lặp để bơm từng tin
      for (const item of products) {
        try {
            // Tạo dữ liệu sản phẩm chuẩn
            const newProduct = {
                title: item.title || "Sản phẩm không tên",
                // Ép kiểu giá về số (đề phòng Excel chưa sạch hẳn)
                price: Number(String(item.price).replace(/[^0-9]/g, '')) || 0,
                description: item.description || "Hàng sưu tầm, vui lòng liên hệ trực tiếp để kiểm tra tình trạng.",
                images: item.image ? [item.image] : ["https://via.placeholder.com/300"],
                category: "others", // Tạm thời để mục Khác
                sellerId: sellerId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                verificationStatus: 'unverified',
                location: "Toàn Quốc",
                status: "active",
                searchKeywords: [item.title?.toLowerCase()] // Để tìm kiếm được
            };

            await addDoc(collection(db, "products"), newProduct);
            successCount++;
            setStatus(`Đang bơm: ${successCount}/${products.length} tin...`);
        } catch (err) {
            console.error("Lỗi tin này:", item);
        }
      }

      setStatus(`✅ XONG! Đã bơm thành công ${successCount} sản phẩm.`);
    } catch (error) {
      setStatus("❌ Lỗi định dạng JSON! Hãy kiểm tra lại.");
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🛠 Công cụ Bơm Tin (Admin)</h1>
      
      <div style={{ marginBottom: 20 }}>
        <label style={{display: 'block', fontWeight: 'bold'}}>1. UID Người Đăng (Admin/Sưu tầm):</label>
        <input 
          type="text" 
          value={sellerId}
          onChange={e => setSellerId(e.target.value)}
          placeholder="Nhập UID của nick Admin vào đây..."
          style={{ width: '100%', padding: '10px', marginTop: '5px' }}
        />
       {/* Thay dấu mũi tên bằng chữ hoặc dấu phẩy */}
<small>Vào Firestore, chọn mục users, sau đó copy ID của tài khoản bạn muốn đứng tên đăng tin.</small>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{display: 'block', fontWeight: 'bold'}}>2. Dán JSON vào đây:</label>
        <textarea 
          rows={10} 
          value={jsonInput}
          onChange={e => setJsonInput(e.target.value)}
          placeholder='[ {"title": "iPhone X", "price": 5000000, "image": "http..."} ... ]'
          style={{ width: '100%', padding: '10px', marginTop: '5px' }}
        />
      </div>

      <button 
        onClick={handleImport} 
        disabled={loading}
        style={{
            padding: '15px 30px', 
            backgroundColor: loading ? '#ccc' : '#2563eb', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
        }}
      >
        {loading ? 'Đang chạy máy bơm...' : '🚀 BẮT ĐẦU BƠM TIN'}
      </button>

      <h3 style={{ marginTop: 20, color: 'green' }}>{status}</h3>
    </div>
  );
};

export default SecretImport;
