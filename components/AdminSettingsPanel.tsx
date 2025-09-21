import React, { useState, useEffect, useMemo } from 'react';
import type { AdminConfig } from '../services/storageService';
import { Cog6ToothIcon, CheckIcon, InformationCircleIcon } from './Icons';

interface AdminSettingsPanelProps {
  gistId: string;
  currentConfig: AdminConfig | null;
  onSaveConfig: (newConfig: AdminConfig) => void;
  onTestConnection: (token: string) => Promise<{ success: boolean; message: string }>;
}

const AdminSettingsPanel: React.FC<AdminSettingsPanelProps> = ({ gistId, currentConfig, onSaveConfig, onTestConnection }) => {
  const [githubToken, setGithubToken] = useState('');
  const [testStatus, setTestStatus] = useState<{ type: 'idle' | 'testing' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });

  useEffect(() => {
    if (currentConfig) {
      setGithubToken(currentConfig.githubToken || '');
    }
  }, [currentConfig]);

  const isTokenOld = useMemo(() => {
    if (!currentConfig?.savedAt) return false;
    const savedDate = new Date(currentConfig.savedAt);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    return savedDate < sixtyDaysAgo;
  }, [currentConfig]);

  const handleTest = async () => {
    setTestStatus({ type: 'testing', message: 'Đang kiểm tra kết nối...' });
    const result = await onTestConnection(githubToken);
    if (result.success) {
      setTestStatus({ type: 'success', message: result.message });
    } else {
      setTestStatus({ type: 'error', message: result.message });
    }
  };

  const handleSave = () => {
    if (!githubToken.trim()) {
      setTestStatus({ type: 'error', message: 'GitHub Token không được để trống.' });
      return;
    }
    onSaveConfig({ githubToken, savedAt: new Date().toISOString() });
    setTestStatus({ type: 'success', message: 'Cấu hình đã được lưu thành công!' });
  };

  return (
    <div className="bg-gray-100 flex flex-col h-full">
      <div className="p-4">
        <h2 className="text-xl font-bold text-[#161D6F] flex items-center gap-2">
          <Cog6ToothIcon className="w-6 h-6"/>
          Cấu hình Quyền Ghi
        </h2>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-6 text-sm">
        {isTokenOld && (
            <div className="p-4 rounded-md bg-amber-100 text-amber-900 border-l-4 border-amber-500 flex items-start gap-3">
                <InformationCircleIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="font-semibold">Token có thể đã cũ</p>
                    <p className="mt-1">Token của bạn đã được lưu hơn 60 ngày. Vui lòng kiểm tra ngày hết hạn trên GitHub và tạo một token mới nếu cần để đảm bảo bạn có thể lưu các thay đổi.</p>
                </div>
            </div>
        )}
        
        <div className="neumorph-pressed p-4 space-y-4">
          <h3 className="font-bold text-md text-[#161D6F]">Cấp quyền Lưu trữ</h3>
          <p className="text-slate-600">Ứng dụng này đọc các nguồn từ một Gist công khai. Để lưu các thay đổi với tư cách quản trị viên, bạn cần cung cấp Personal Access Token (PAT) có quyền <strong>`gist`</strong>.</p>

           <div>
            <label htmlFor="gistId-display" className="block text-sm font-medium text-slate-700 mb-2">Gist ID Nguồn Dữ liệu Công khai (không thể thay đổi)</label>
            <input
              id="gistId-display"
              type="text"
              value={gistId}
              readOnly
              className="w-full bg-gray-200 neumorph-pressed p-3 focus:outline-none text-sm text-slate-500 cursor-not-allowed"
              title="Đây là nguồn dữ liệu công khai mà tất cả người dùng sẽ thấy."
            />
          </div>

          <div className="space-y-2">
              <p><strong className="font-semibold">Hướng dẫn: Tạo Personal Access Token (PAT)</strong></p>
              <ol className="list-decimal list-inside pl-4 text-slate-600 space-y-1">
                  <li>Truy cập <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">trang tạo token của GitHub</a>.</li>
                  <li>Nhấp vào "Generate new token" và chọn "Generate new token (classic)".</li>
                  <li>Đặt một tên dễ nhớ cho token, ví dụ: "AI Notebook App".</li>
                  <li>Trong mục "Select scopes", chỉ cần đánh dấu vào ô <strong>`gist`</strong>. Đây là quyền duy nhất cần thiết để cập nhật các nguồn.</li>
                  <li>Nhấp vào "Generate token" ở cuối trang.</li>
                  <li><strong>SAO CHÉP TOKEN NGAY LẬP TỨC.</strong> GitHub sẽ không hiển thị lại nó.</li>
              </ol>
          </div>

          <div>
            <label htmlFor="githubToken" className="block text-sm font-medium text-slate-700 mb-2">Dán Personal Access Token của bạn vào đây</label>
            <input
              id="githubToken"
              type="password"
              value={githubToken}
              onChange={(e) => {
                  setGithubToken(e.target.value);
                  setTestStatus({ type: 'idle', message: '' }); // Reset status on edit
              }}
              placeholder="ghp_..."
              className="w-full bg-transparent neumorph-pressed p-3 focus:outline-none text-sm"
            />
          </div>
        </div>


        {testStatus.message && (
          <div className={`text-sm p-3 rounded-md ${
            testStatus.type === 'success' ? 'bg-green-100 text-green-800' : 
            testStatus.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {testStatus.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleTest}
            disabled={testStatus.type === 'testing' || !githubToken}
            className="flex-1 px-5 py-3 neumorph-raised neumorph-button text-sm font-semibold text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testStatus.type === 'testing' ? 'Đang kiểm tra...' : 'Kiểm tra Kết nối'}
          </button>
          <button
            onClick={handleSave}
            disabled={!githubToken}
            className="flex items-center justify-center gap-2 flex-1 px-5 py-3 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{boxShadow: '3px 3px 6px #c4c9d1, -3px -3px 6px #ffffff'}}
          >
            <CheckIcon className="w-5 h-5"/>
            Lưu Token
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPanel;