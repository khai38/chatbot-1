import React, { useState, useEffect } from 'react';
import { LockClosedIcon, XMarkIcon } from './Icons';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginAttempt: (username, password) => boolean;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginAttempt }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  useEffect(() => {
    // Reset form when modal is closed
    if (!isOpen) {
      setUsername('');
      setPassword('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Tên người dùng và mật khẩu không được để trống.');
      return;
    }
    
    const success = onLoginAttempt(username, password);
    if (!success) {
      setError('Tên người dùng hoặc mật khẩu không chính xác.');
    }
  };
  
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="neumorph-raised w-full max-w-md p-8 relative"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 rounded-full neumorph-button"
          aria-label="Đóng cửa sổ đăng nhập"
        >
          <XMarkIcon className="w-5 h-5 text-slate-600" />
        </button>
        
        <div className="text-center mb-6">
            <LockClosedIcon className="w-12 h-12 mx-auto text-[#161D6F] mb-3" />
            <h2 className="text-2xl font-bold text-[#161D6F]">Đăng nhập Quản trị viên</h2>
            <p className="text-sm text-slate-500 mt-1">Truy cập bảng điều khiển quản lý nguồn.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-2">Tên người dùng</label>
                <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-transparent neumorph-pressed p-3 focus:outline-none text-sm"
                    autoComplete="username"
                    required
                />
            </div>
             <div>
                <label htmlFor="password-modal" className="block text-sm font-medium text-slate-700 mb-2">Mật khẩu</label>
                <input
                    id="password-modal"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent neumorph-pressed p-3 focus:outline-none text-sm"
                    autoComplete="current-password"
                    required
                />
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            
            <button
              type="submit"
              className="w-full px-5 py-3 neumorph-raised neumorph-button text-md font-semibold text-slate-800"
            >
              Đăng nhập
            </button>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
