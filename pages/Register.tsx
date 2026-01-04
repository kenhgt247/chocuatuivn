
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../services/db';

const Register: React.FC<{ onLogin: (user: any) => void }> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return setError("Mật khẩu xác nhận không khớp.");
    }
    
    setError('');
    setIsLoading(true);

    try {
      const user = await db.register(formData.email, formData.password, formData.name);
      onLogin(user);
      alert("Đăng ký thành công!");
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("Email này đã được sử dụng.");
      } else {
        setError("Lỗi đăng ký: " + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft space-y-8 animate-fade-in-up">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white text-3xl mx-auto shadow-lg shadow-primary/20">🌱</div>
          <h1 className="text-2xl font-black">Tham gia cộng đồng</h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Tạo tài khoản Cloud miễn phí</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Họ và tên</label>
            <input 
              type="text" 
              placeholder="Nguyễn Văn A" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 focus:outline-none focus:border-primary font-bold text-sm"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Email</label>
            <input 
              type="email" 
              placeholder="name@example.com" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 focus:outline-none focus:border-primary font-bold text-sm"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Mật khẩu</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 focus:outline-none focus:border-primary font-bold text-sm"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Xác nhận mật khẩu</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 focus:outline-none focus:border-primary font-bold text-sm"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary text-white font-black py-4 rounded-2xl hover:bg-primaryHover transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center justify-center gap-2"
          >
            {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Đăng ký ngay'}
          </button>
        </form>

        <p className="text-center text-[10px] text-gray-400 font-black uppercase">
          Đã có tài khoản? <Link to="/login" className="text-primary hover:underline">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
