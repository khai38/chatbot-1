import React, { useState, useCallback, useMemo, useEffect } from 'react';
import SourcePanel from './components/SourcePanel';
import ChatPanel from './components/ChatPanel';
import NotesPanel from './components/NotesPanel';
import LoginModal from './components/LoginModal';
import AdminSettingsPanel from './components/AdminSettingsPanel';
import ConfigurationPrompt from './components/ConfigurationPrompt';
import ToastContainer from './components/ToastContainer';
import { getSources, saveSources, testStorageConnection, GistNotFoundError, DEFAULT_SOURCES } from './services/storageService';
import type { AdminConfig } from './services/storageService';
import type { Source, ChatMessage, Note, ToastMessage, ToastType } from './types';
import { BookIcon, BrainCircuitIcon, PinIcon, LockClosedIcon, ArrowRightOnRectangleIcon, XMarkIcon, Cog6ToothIcon, InformationCircleIcon } from './components/Icons';
import { querySources } from './services/geminiService';

// --- CONFIGURATION ---
// IMPORTANT: This is the public location for your sources. 
// All users will fetch data from this Gist. It must be a valid Gist ID.
const PUBLIC_GIST_ID = '66334a5aafde2cd3ed37c02a8379189b';

function useLocalStorageState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}


const App: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  
  const [sources, setSources] = useState<Source[]>([]);
  const [draftSources, setDraftSources] = useState<Source[]>([]);
  const [isFetchingSources, setIsFetchingSources] = useState(true);
  const [sourcesEtag, setSourcesEtag] = useState<string | null>(null);


  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Admin config now only stores the token. The Gist ID is a global constant.
  const [adminConfig, setAdminConfig] = useLocalStorageState<AdminConfig | null>('ai-notebook-admin-config', null);
  const [isConfigNeeded, setIsConfigNeeded] = useState(false);
  
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
  }, []);


  const fetchInitialSources = useCallback(async () => {
    setIsFetchingSources(true);
    setError(null);
    try {
        const { status, sources: fetchedSources, etag: newEtag } = await getSources(PUBLIC_GIST_ID);
        
        if (status === 200 && fetchedSources) {
            setSources(fetchedSources);
            setDraftSources(fetchedSources);
            setSourcesEtag(newEtag);
        } else {
             throw new Error("Không thể tải xuống nội dung nguồn ban đầu.");
        }
    } catch (err) {
        console.error("Failed to fetch sources:", err);
        let errorMessage = "Không thể tải các nguồn dữ liệu từ Gist đã cấu hình. Ứng dụng sẽ sử dụng dữ liệu mẫu mặc định.";
        if (err instanceof GistNotFoundError) {
          errorMessage = `Không tìm thấy Gist với ID '${PUBLIC_GIST_ID}'. Vui lòng kiểm tra lại Gist ID trong cấu hình của bạn.`;
        } else if (err instanceof Error && err.message.includes("API")) {
          errorMessage = `Đã đạt đến giới hạn truy cập API GitHub. Vui lòng thử lại sau.`;
        }
        setError(errorMessage);
        setSources(DEFAULT_SOURCES);
        setDraftSources(DEFAULT_SOURCES);
    } finally {
        setIsFetchingSources(false);
    }
  }, []);


  useEffect(() => {
    fetchInitialSources();
  }, [fetchInitialSources]);

  // Check if admin needs to configure their token after logging in
  useEffect(() => {
    if (isAdmin && (!adminConfig || !adminConfig.githubToken)) {
        setIsConfigNeeded(true);
    } else {
        setIsConfigNeeded(false);
    }
  }, [isAdmin, adminConfig]);

  // Check if the admin's token might be nearing expiration and show a toast.
  useEffect(() => {
    if (isAdmin && adminConfig?.savedAt) {
      const savedDate = new Date(adminConfig.savedAt);
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      if (savedDate < sixtyDaysAgo) {
        addToast("Lưu ý: Token GitHub của bạn đã được lưu hơn 60 ngày. Hãy đảm bảo nó chưa hết hạn để tránh lỗi lưu trữ.", 'info');
      }
    }
  }, [isAdmin, adminConfig, addToast]);
  
  const [adminMessages, setAdminMessages] = useLocalStorageState<ChatMessage[]>('ai-notebook-admin-messages', []);
  const [adminNotes, setAdminNotes] = useLocalStorageState<Note[]>('ai-notebook-admin-notes', []);
  
  const [guestMessages, setGuestMessages] = useState<ChatMessage[]>([]);
  const [guestNotes, setGuestNotes] = useState<Note[]>([]);
  
  const [mobileActivePanel, setMobileActivePanel] = useState<'chat' | 'sources' | 'notes'>('chat');
  const [adminActivePanel, setAdminActivePanel] = useState<'sources' | 'settings'>('sources');


  const hasUnsavedChanges = useMemo(() => 
    JSON.stringify(sources) !== JSON.stringify(draftSources),
    [sources, draftSources]
  );
  
  // Polling for source updates
  useEffect(() => {
    const POLLING_INTERVAL = 20000; // 20 seconds

    const intervalId = setInterval(async () => {
      if (hasUnsavedChanges || !sourcesEtag) {
        return;
      }

      try {
        const { status, sources: newSources, etag: newEtag } = await getSources(PUBLIC_GIST_ID, sourcesEtag);
        
        if (status === 200 && newSources) {
          console.log("Source update detected, refreshing data.");
          setSources(newSources);
          setSourcesEtag(newEtag);

          if (isAdmin) {
            setDraftSources(newSources);
            addToast("Nguồn dữ liệu đã được cập nhật bởi một quản trị viên khác.", 'info');
          } else {
            setGuestMessages([]);
            addToast("Nguồn dữ liệu đã được cập nhật. Cuộc trò chuyện của bạn đã được làm mới.", 'info');
          }
        }
      } catch (error) {
        console.error("Polling for source updates failed:", error);
      }
    }, POLLING_INTERVAL);

    return () => clearInterval(intervalId);
  }, [sourcesEtag, hasUnsavedChanges, isAdmin, addToast]);


  const messages = isAdmin ? adminMessages : guestMessages;
  const notes = isAdmin ? adminNotes : guestNotes;
  
  const handleLoginAttempt = (username, password) => {
    if (username === 'tinhocsaoviet' && password === 'Saoviet1') {
      setIsAdmin(true);
      setLoginModalOpen(false);
      setDraftSources(sources); // Sync drafts on login
      setMobileActivePanel('sources');
      return true;
    }
    return false;
  };
  
  const handleLogout = () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
      setIsAdmin(false);
      setGuestMessages([]);
      setGuestNotes([]);
      setMobileActivePanel('chat');
    }
  };

  const handleSaveChanges = async () => {
    if (!adminConfig || !adminConfig.githubToken) {
        addToast("Lỗi: Không tìm thấy cấu hình lưu trữ. Vui lòng định cấu hình GitHub Token trong tab Cấu hình.", 'error');
        setAdminActivePanel('settings'); // Guide user to settings
        return;
    }
    try {
        const { etag: newEtag } = await saveSources(draftSources, PUBLIC_GIST_ID, adminConfig.githubToken);
        setSources(draftSources);
        setSourcesEtag(newEtag); // Update ETag after successful save
        addToast('Các thay đổi đã được lưu và công khai cho tất cả người dùng.', 'success');
    } catch(err) {
        console.error("Failed to save sources:", err);
        addToast(`Đã xảy ra lỗi khi lưu thay đổi: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const handleCancelChanges = () => {
      if (hasUnsavedChanges && window.confirm("Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn hủy bỏ không?")) {
        setDraftSources(sources);
      } else if (!hasUnsavedChanges) {
        setDraftSources(sources);
      }
  };
  
  const addSource = (title: string, content: { mimeType: string, data: string }, fileName?: string) => {
    if (!isAdmin) return;
    const newSource: Source = { id: `source-${Date.now()}`, title, content, fileName };
    setDraftSources(prev => [...prev, newSource]);
  };

  const deleteSource = (id: string) => {
    if (!isAdmin) return;
    setDraftSources(prev => prev.filter(source => source.id !== id));
  };

  const addNote = (message: ChatMessage) => {
    const setNotes = isAdmin ? setAdminNotes : setGuestNotes;
    const currentNotes = isAdmin ? adminNotes : guestNotes;
    if (currentNotes.some(note => note.sourceMessageId === message.id)) return;
    
    const newNote: Note = { id: `note-${Date.now()}`, content: message.text, sourceMessageId: message.id };
    setNotes(prev => [newNote, ...prev]);
  };
  
  const deleteNote = (id: string) => {
    const setNotes = isAdmin ? setAdminNotes : setGuestNotes;
    setNotes(prev => prev.filter(note => note.id !== id));
  };
  
  const startNewChat = () => {
    const confirmMessage = "Bạn có chắc chắn muốn bắt đầu một cuộc trò chuyện mới không? Lịch sử trò chuyện hiện tại sẽ bị xóa.";
      
    if (window.confirm(confirmMessage)) {
        if (isAdmin) {
          setAdminMessages([]);
        } else {
          setGuestMessages([]);
        }
        setMobileActivePanel('chat');
    }
  };

  const sendMessage = useCallback(async (question: string) => {
    setError(null);
    const userMessage: ChatMessage = { id: `msg-${Date.now()}`, role: 'user', text: question };
    
    if (isAdmin) {
        setAdminMessages(prev => [...prev, userMessage]);
    } else {
        setGuestMessages(prev => [...prev, userMessage]);
    }
    
    setIsLoading(true);

    try {
      // The `sources` state is now always the latest public version.
      if (sources.length === 0) {
         throw new Error("Không có nguồn nào được tải lên. Vui lòng liên hệ quản trị viên.");
      }
      
      const { answer, citations: rawCitations } = await querySources(question, sources);
      
      const citations = rawCitations.map(cit => {
        const source = sources.find(s => s.id === cit.sourceId);
        return { ...cit, sourceTitle: source?.title || 'Nguồn không xác định' };
      });

      const modelMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'model',
        text: answer,
        citations: citations
      };

      if (isAdmin) {
        setAdminMessages(prev => [...prev, modelMessage]);
      } else {
        setGuestMessages(prev => [...prev, modelMessage]);
      }
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi không xác định.");
    } finally {
      setIsLoading(false);
    }
  }, [sources, isAdmin, setAdminMessages, setGuestMessages]);
  
  const AdminLeftPanel = () => (
    <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-2">
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-lg neumorph-pressed">
                 <button 
                    onClick={() => setAdminActivePanel('sources')} 
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all ${adminActivePanel === 'sources' ? 'neumorph-pressed font-semibold' : 'neumorph-raised'}`}
                >
                    <BookIcon className={`w-5 h-5`} />
                    Nguồn
                </button>
                 <button 
                    onClick={() => setAdminActivePanel('settings')} 
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all ${adminActivePanel === 'settings' ? 'neumorph-pressed font-semibold' : 'neumorph-raised'}`}
                >
                    <Cog6ToothIcon className={`w-5 h-5`} />
                    Cấu hình
                </button>
            </div>
        </div>
        <div className="flex-grow min-h-0">
             {adminActivePanel === 'sources' ? (
                <SourcePanel 
                    sources={draftSources} 
                    onAddSource={addSource} 
                    onDeleteSource={deleteSource} 
                    onStartNewChat={startNewChat}
                    onSaveChanges={handleSaveChanges}
                    onCancelChanges={handleCancelChanges}
                    hasUnsavedChanges={hasUnsavedChanges}
                />
            ) : (
                <AdminSettingsPanel 
                    gistId={PUBLIC_GIST_ID}
                    currentConfig={adminConfig}
                    onSaveConfig={(newConfig) => {
                        setAdminConfig(newConfig);
                        addToast("Cấu hình đã được lưu. Bạn có thể lưu các thay đổi nguồn ngay bây giờ.", 'success');
                    }}
                    onTestConnection={(token) => testStorageConnection(PUBLIC_GIST_ID, token)}
                />
            )}
        </div>
    </div>
  );

  const Header = () => (
    <header className="flex-shrink-0 p-4 neumorph-raised z-10 flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-bold text-[#161D6F] text-center flex items-center gap-3">
            <BrainCircuitIcon className="w-7 h-7 text-[#161D6F]" />
            <span>Chatbot Tra Cứu Thông Tin - Tin Học Sao Việt</span>
        </h1>
        {isAdmin ? (
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 neumorph-raised neumorph-button text-sm font-semibold text-slate-800" title="Đăng xuất">
                 <ArrowRightOnRectangleIcon className="w-5 h-5" />
                 <span className="hidden sm:inline">Đăng xuất</span>
            </button>
        ) : (
            <button onClick={() => setLoginModalOpen(true)} className="flex items-center gap-2 px-4 py-2 neumorph-raised neumorph-button text-sm font-semibold text-slate-800" title="Đăng nhập quản trị">
                <LockClosedIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Đăng nhập</span>
            </button>
        )}
    </header>
  );

  const GuestSourceInfoPanel: React.FC = () => (
    <div className="bg-gray-100 flex flex-col h-full items-center justify-center p-8 text-center">
        <InformationCircleIcon className="w-16 h-16 text-slate-400 mb-4" />
        <h2 className="text-xl font-bold text-[#161D6F]">Nguồn Dữ liệu đã Sẵn sàng</h2>
        <p className="text-slate-600 mt-2 mb-6 max-w-sm">
          Các nguồn dữ liệu cho chatbot này đã được tải và sẵn sàng để sử dụng trong tab "Trò chuyện".
          <br/><br/>
          Việc đăng nhập chỉ dành cho <strong>quản trị viên</strong> để quản lý các nguồn này.
        </p>
        <button onClick={() => setLoginModalOpen(true)} className="flex items-center gap-2 px-6 py-3 neumorph-raised neumorph-button text-md font-semibold text-slate-800">
            <LockClosedIcon className="w-5 h-5" />
            <span>Đăng nhập Quản trị viên</span>
        </button>
    </div>
  );
  
  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-gray-100">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <Header />
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mx-4 my-2 rounded-md shadow-md flex justify-between items-center" role="alert">
          <div>
            <p className="font-bold">Lỗi Tải Dữ Liệu</p>
            <p className="text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="p-1.5 rounded-full text-red-700 hover:bg-red-200 transition-colors" aria-label="Đóng thông báo">
             <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setLoginModalOpen(false)} 
        onLoginAttempt={handleLoginAttempt}
      />
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {isAdmin ? (
           <>
            {/* Admin Desktop Layout */}
            <div className="hidden lg:block lg:col-span-3 h-full">
                <AdminLeftPanel />
            </div>
            <main className="hidden lg:block lg:col-span-6 h-full">
              {isConfigNeeded ? (
                <ConfigurationPrompt onGoToSettings={() => setAdminActivePanel('settings')} />
              ) : (
                <ChatPanel 
                    messages={messages} 
                    sources={sources}
                    notes={notes}
                    isLoading={isLoading} 
                    isFetchingSources={isFetchingSources}
                    error={null} // Main error is handled globally
                    onSendMessage={sendMessage}
                    onAddNote={addNote}
                />
              )}
            </main>
            <div className="hidden lg:block lg:col-span-3 h-full">
                <NotesPanel notes={notes} onDeleteNote={deleteNote}/>
            </div>
           </>
        ) : (
            <>
            {/* Guest Desktop Layout */}
             <main className="hidden lg:block lg:col-span-8 h-full">
                <ChatPanel 
                    messages={messages} 
                    sources={sources}
                    notes={notes}
                    isLoading={isLoading} 
                    isFetchingSources={isFetchingSources}
                    error={null} // Main error is handled globally
                    onSendMessage={sendMessage}
                    onAddNote={addNote}
                />
            </main>
            <aside className="hidden lg:block lg:col-span-4 h-full border-l border-slate-200">
                <NotesPanel notes={notes} onDeleteNote={deleteNote}/>
            </aside>
            </>
        )}


        {/* Mobile Layout */}
        <div className="lg:hidden h-full pb-24">
          <div className={`${mobileActivePanel === 'sources' ? 'block' : 'hidden'} h-full`}>
              {isAdmin ? (
                   <div className="h-full">
                        <AdminLeftPanel />
                   </div>
              ) : (
                  <GuestSourceInfoPanel />
              )}
          </div>
          <div className={`${mobileActivePanel === 'chat' ? 'block' : 'hidden'} h-full`}>
            {isAdmin && isConfigNeeded ? (
                <ConfigurationPrompt onGoToSettings={() => {
                  setAdminActivePanel('settings');
                  setMobileActivePanel('sources');
                }} />
            ) : (
              <ChatPanel 
                messages={messages} 
                sources={sources}
                notes={notes}
                isLoading={isLoading} 
                isFetchingSources={isFetchingSources}
                error={null}
                onSendMessage={sendMessage}
                onAddNote={addNote}
              />
            )}
          </div>
          <div className={`${mobileActivePanel === 'notes' ? 'block' : 'hidden'} h-full`}>
              <NotesPanel notes={notes} onDeleteNote={deleteNote}/>
          </div>
        </div>

        {/* Mobile Bottom Bar (Nav + Footer) */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-100 border-t border-slate-200">
            <nav className="grid grid-cols-3 gap-2 p-2">
                <button 
                onClick={() => setMobileActivePanel('sources')} 
                className={`flex flex-col items-center py-2 rounded-lg transition-all ${mobileActivePanel === 'sources' ? 'neumorph-pressed' : 'neumorph-raised'}`}
                >
                    <BookIcon className={`w-6 h-6 ${mobileActivePanel === 'sources' ? 'text-slate-800' : 'text-slate-600'}`} />
                    <span className={`text-xs mt-1 ${mobileActivePanel === 'sources' ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{isAdmin ? 'Quản lý' : 'Nguồn'}</span>
                </button>
                <button 
                onClick={() => setMobileActivePanel('chat')} 
                className={`flex flex-col items-center py-2 rounded-lg transition-all ${mobileActivePanel === 'chat' ? 'neumorph-pressed' : 'neumorph-raised'}`}
                >
                    <BrainCircuitIcon className={`w-6 h-6 ${mobileActivePanel === 'chat' ? 'text-slate-800' : 'text-slate-600'}`} />
                    <span className={`text-xs mt-1 ${mobileActivePanel === 'chat' ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>Trò chuyện</span>
                </button>
                <button 
                onClick={() => setMobileActivePanel('notes')} 
                className={`flex flex-col items-center py-2 rounded-lg transition-all ${mobileActivePanel === 'notes' ? 'neumorph-pressed' : 'neumorph-raised'}`}
                >
                    <PinIcon className={`w-6 h-6 ${mobileActivePanel === 'notes' ? 'text-slate-800' : 'text-slate-600'}`} />
                    <span className={`text-xs mt-1 ${mobileActivePanel === 'notes' ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>Ghi chú</span>
                </button>
            </nav>
            <footer className="text-center text-xs text-slate-500 pb-2">
                Chatbot Beta - Copyright © 2025 Trung Tâm Tin Học Sao Việt
            </footer>
        </div>
      </div>
    </div>
  );
};

export default App;