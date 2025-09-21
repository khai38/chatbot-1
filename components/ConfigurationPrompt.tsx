import React from 'react';
import { Cog6ToothIcon } from './Icons';

interface ConfigurationPromptProps {
  onGoToSettings: () => void;
}

const ConfigurationPrompt: React.FC<ConfigurationPromptProps> = ({ onGoToSettings }) => {
  return (
    <div className="h-full flex items-center justify-center p-6 bg-gray-100">
      <div className="text-center max-w-lg p-10 neumorph-pressed">
        <Cog6ToothIcon className="w-20 h-20 mx-auto text-[#161D6F] mb-4" />
        <h2 className="text-2xl font-bold text-[#161D6F]">Yêu cầu Cấu hình</h2>
        <p className="mt-2 text-slate-600">
          Để đồng bộ hóa các nguồn dữ liệu trên mọi trình duyệt và thiết bị, bạn cần thiết lập kết nối lưu trữ.
        </p>
        <p className="mt-2 mb-6 text-slate-600">
          Đây là thao tác chỉ cần thực hiện một lần cho mỗi trình duyệt bạn sử dụng với tư cách quản trị viên.
        </p>
        <button
          onClick={onGoToSettings}
          className="flex items-center gap-2 px-6 py-3 neumorph-raised neumorph-button text-md font-semibold text-slate-800 mx-auto"
        >
          <Cog6ToothIcon className="w-5 h-5" />
          <span>Đi đến Cấu hình</span>
        </button>
      </div>
    </div>
  );
};

export default ConfigurationPrompt;
