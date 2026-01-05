import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../services/db';

const Auth: React.FC<{ onLogin: (user: any) => void }> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Xử lý đăng nhập Email/Pass cũ
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setError('');
    setIsLoading(true);

    try {
      const user = await db.login(email, password);
      onLogin(user);
      navigate('/');
    } catch (err: any) {
      console.error("Login error:", err.code, err.message);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-email') {
        setError("Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Tài khoản tạm khóa. Thử lại sau ít phút.");
      } else {
        setError("Lỗi hệ thống: " + (err.message || "Vui lòng thử lại."));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- Xử lý đăng nhập Google (MỚI) ---
  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
        const user = await db.loginWithGoogle();
        onLogin(user);
        navigate('/');
    } catch (err: any) {
        console.error("Google login error:", err);
        setError("Lỗi đăng nhập Google: " + err.message);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft space-y-8 animate-fade-in-up">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white text-3xl mx-auto shadow-lg shadow-primary/20">⚡</div>
          <h1 className="text-2xl font-black">Chào mừng trở lại!</h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Đăng nhập vào hệ thống Chợ của tui</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-xs font-bold animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Email</label>
            <input 
              type="email" 
              placeholder="name@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 focus:outline-none focus:border-primary font-bold text-sm"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Mật khẩu</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 focus:outline-none focus:border-primary font-bold text-sm"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary text-white font-black py-4 rounded-2xl hover:bg-primaryHover transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center justify-center gap-2"
          >
            {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Đăng nhập ngay'}
          </button>
        </form>

        {/* --- PHẦN NÚT GOOGLE (MỚI) --- */}
        <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-[10px] text-gray-400 font-bold uppercase">Hoặc</span>
            <div className="flex-grow border-t border-gray-200"></div>
        </div>

        <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white border-2 border-gray-100 text-gray-700 font-bold py-4 rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center gap-3 active:scale-95"
        >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
            <span>Tiếp tục với Google</span>
        </button>
        {/* ----------------------------- */}

        <p className="text-center text-[10px] text-gray-400 font-black uppercase">
          Chưa có tài khoản? <Link to="/register" className="text-primary hover:underline">Đăng ký tại đây</Link>
        </p>
      </div>
    </div>
  );
};

export default Auth;
