
import React, { useState, useEffect, useRef } from 'react';
import { login } from '../services/authService';
import { getServerHost, setServerHost, apiCall } from '../services/apiService';
import { User } from '../types';
import { LogIn, KeyRound, Loader2, Settings, Server, Wifi, WifiOff, Save, RefreshCw, Globe, CheckCircle2, XCircle, Database, UploadCloud } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [isNative, setIsNative] = useState(false);
  
  // Restore DB State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  
  // Connection Test State
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    try {
        const savedUsername = localStorage.getItem('saved_username');
        if (savedUsername) setUsername(savedUsername);
        
        const native = Capacitor.isNativePlatform();
        setIsNative(native);

        // Load existing host
        const host = getServerHost();
        setServerUrl(host);

        // If native and no host, force config screen
        if (native && !host) {
            setShowServerConfig(true);
        }
    } catch(e) {
        console.error("Login Init Error", e);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isNative && !getServerHost()) {
        setError('لطفا ابتدا آدرس سرور را تنظیم کنید.');
        setShowServerConfig(true);
        return;
    }

    setLoading(true);
    setError('');
    
    try {
        const user = await login(username, password);
        if (user) {
          localStorage.setItem('saved_username', username);
          onLogin(user);
        }
    } catch (e: any) {
        setLoading(false);
        console.error("Login Error:", e);
        
        if (e.message === "SERVER_URL_MISSING") {
            setError("آدرس سرور تنظیم نشده است.");
            setShowServerConfig(true);
        } else if (e.message && e.message.includes('401')) {
            setError('نام کاربری یا رمز عبور اشتباه است.');
        } else {
            setError('عدم ارتباط با سرور. لطفا آدرس سرور یا اینترنت را بررسی کنید.');
        }
    }
  };

  const testConnection = async () => {
      if (!serverUrl) return;
      
      let urlToTest = serverUrl.trim().replace(/\/$/, '');
      if (!urlToTest.startsWith('http')) {
          urlToTest = `http://${urlToTest}`;
      }

      setTestStatus('testing');
      setTestMessage('در حال برقراری ارتباط...');

      try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s for test
          
          const response = await fetch(`${urlToTest}/api/version`, { 
              signal: controller.signal,
              headers: { 'Content-Type': 'application/json' }
          });
          clearTimeout(timeoutId);

          if (response.ok) {
              setTestStatus('success');
              setTestMessage('ارتباط با سرور موفقیت‌آمیز بود.');
              setServerUrl(urlToTest);
          } else {
              throw new Error(`Status: ${response.status}`);
          }
      } catch (err: any) {
          setTestStatus('failed');
          setTestMessage(`خطا در اتصال: ${err.message || 'Server Unreachable'}`);
      }
  };

  const handleSaveServer = (e: React.FormEvent) => {
      e.preventDefault();
      
      let inputUrl = serverUrl.trim();
      if(!inputUrl) {
          alert("لطفا آدرس سرور را وارد کنید");
          return;
      }
      
      inputUrl = inputUrl.replace(/\/$/, '');
      
      if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
          inputUrl = `http://${inputUrl}`;
      }
      
      setServerHost(inputUrl);
      setServerUrl(inputUrl);
      
      setShowServerConfig(false);
      setError('');
      setTestStatus('idle');
      
      alert('تنظیمات سرور ذخیره شد.');
  };

  const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!confirm('⚠️ هشدار جدی:\nآیا مطمئن هستید که می‌خواهید این فایل را بازگردانی کنید؟\nتمام اطلاعات فعلی سیستم با اطلاعات این فایل جایگزین خواهد شد و این عملیات غیرقابل بازگشت است.')) {
          e.target.value = '';
          return;
      }

      setRestoring(true);
      const reader = new FileReader();
      
      reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          try {
              // Using a direct fetch here to ensure we use the configured server host if native
              const response = await apiCall<{success: boolean}>('/emergency-restore', 'POST', { fileData: base64 });
              
              if (response.success) {
                  alert('✅ دیتابیس با موفقیت بازگردانی شد.\nصفحه رفرش می‌شود.');
                  window.location.reload();
              } else {
                  throw new Error("Server returned false");
              }
          } catch (error: any) {
              alert('خطا در بازگردانی دیتابیس: ' + (error.message || 'Unknown Error'));
          } finally {
              setRestoring(false);
              setShowRestoreModal(false);
          }
      };
      
      reader.onerror = () => {
          alert('خطا در خواندن فایل');
          setRestoring(false);
      };

      reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 p-4 relative font-sans" dir="rtl">
      
      {/* Settings Button */}
      <button 
        onClick={() => setShowServerConfig(!showServerConfig)} 
        className="absolute top-6 left-6 p-3 glass-panel rounded-full shadow-md text-gray-500 hover:text-blue-600 transition-colors z-50"
        title="تنظیمات اتصال"
      >
        <Settings size={24} />
      </button>

      {/* Database Restore Button (Corner fallback) */}
      <button 
        onClick={() => setShowRestoreModal(true)} 
        className="absolute top-6 right-6 p-3 glass-panel rounded-full shadow-md text-amber-500 hover:text-amber-700 transition-colors z-50 md:flex hidden"
        title="بازگردانی دیتابیس (اضطراری)"
      >
        <Database size={24} />
      </button>

      {/* Restore Modal */}
      {showRestoreModal && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 animate-fade-in backdrop-blur-sm">
              <div className="glass-panel rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
                      <Database size={32}/>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">بازگردانی دیتابیس</h3>
                  <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                      اگر فایل پشتیبان (backup) دارید، می‌توانید آن را اینجا آپلود کنید تا سیستم به حالت قبل برگردد.<br/>
                      <span className="text-red-500 font-bold">توجه: اطلاعات فعلی حذف خواهد شد.</span>
                  </p>
                  
                  <input 
                      type="file" 
                      ref={restoreFileInputRef} 
                      className="hidden" 
                      accept=".json,.txt" 
                      onChange={handleRestoreFileChange}
                  />
                  
                  <div className="space-y-3">
                      <button 
                          onClick={() => restoreFileInputRef.current?.click()} 
                          disabled={restoring}
                          className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold hover:bg-amber-600 flex items-center justify-center gap-2 shadow-lg shadow-amber-200"
                      >
                          {restoring ? <Loader2 size={20} className="animate-spin"/> : <UploadCloud size={20}/>}
                          {restoring ? 'در حال بازگردانی...' : 'انتخاب فایل بکاپ'}
                      </button>
                      <button 
                          onClick={() => setShowRestoreModal(false)} 
                          disabled={restoring}
                          className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200"
                      >
                          انصراف
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="glass-panel p-8 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 relative overflow-hidden animate-fade-in">
        
        {showServerConfig ? (
            <div className="animate-fade-in space-y-6">
                <div className="flex flex-col items-center mb-4">
                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-4 border-4 border-indigo-100 shadow-inner">
                        <Server size={40} />
                    </div>
                    <h1 className="text-2xl font-black text-gray-800">تنظیم آدرس سرور</h1>
                    <p className="text-gray-500 mt-2 text-sm text-center leading-relaxed px-4">
                        آدرس IP سرور یا دامنه را وارد کنید.<br/>
                        <span className="text-xs">(مثال: 192.168.1.10:3000)</span>
                    </p>
                </div>
                
                <form onSubmit={handleSaveServer} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-2 mr-1">آدرس سرور (با پورت)</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={serverUrl} 
                                onChange={(e) => { setServerUrl(e.target.value); setTestStatus('idle'); }} 
                                className="w-full border-2 border-gray-200/50 dark:border-white/10 rounded-xl px-4 py-4 pl-12 text-left dir-ltr font-mono font-bold text-gray-700 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none" 
                                placeholder="192.168.1.50:3000"
                                autoCapitalize="off"
                                autoCorrect="off"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <Globe size={20}/>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <button 
                            type="button" 
                            onClick={testConnection}
                            disabled={!serverUrl || testStatus === 'testing'}
                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {testStatus === 'testing' ? <Loader2 size={14} className="animate-spin"/> : <Wifi size={14}/>}
                            تست اتصال
                        </button>
                        
                        {testStatus === 'success' && (
                            <div className="bg-green-50 text-green-700 text-xs p-2 rounded border border-green-200 flex items-center gap-2">
                                <CheckCircle2 size={16}/> {testMessage}
                            </div>
                        )}
                        
                        {testStatus === 'failed' && (
                            <div className="bg-red-50 text-red-700 text-xs p-2 rounded border border-red-200 flex items-center gap-2">
                                <XCircle size={16}/> {testMessage}
                            </div>
                        )}
                    </div>

                    <div className="pt-2">
                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-lg">
                            <Save size={20}/>
                            ذخیره و بازگشت
                        </button>
                    </div>
                </form>
            </div>
        ) : (
            <>
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-tr from-[#4b90ff] via-[#aa72ff] to-[#ff6097] rounded-[1.5rem] rotate-3 flex items-center justify-center text-white mb-6 shadow-xl shadow-purple-500/15 animate-pulse-subtle">
                        <KeyRound size={36} className="-rotate-3" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight gemini-gradient-text bg-gradient-to-r from-[#4b90ff] via-[#aa72ff] to-[#ff6097]">ورود به سامانه</h1>
                    <div className="mt-3 flex items-center gap-2 px-3 py-1 bg-zinc-100/50 dark:bg-zinc-800/40 text-zinc-800 dark:text-zinc-200 rounded-full border border-zinc-200/50 dark:border-zinc-800/50">
                        <div className={`w-2 h-2 rounded-full ${isNative ? 'bg-purple-500' : 'bg-green-500'}`}></div>
                        <p className="text-gray-500 text-xs font-bold">{isNative ? 'نسخه موبایل' : 'نسخه وب'}</p>
                    </div>
                </div>
                
                {isNative && !serverUrl && (
                    <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-xs mb-6 flex items-start gap-3 border border-amber-200 shadow-sm cursor-pointer" onClick={() => setShowServerConfig(true)}>
                        <WifiOff size={20} className="shrink-0 mt-0.5"/>
                        <span className="leading-5">آدرس سرور تنظیم نشده است. برای اتصال کلیک کنید.</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                      <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm text-center border border-red-100 font-bold animate-pulse flex flex-col items-center gap-2">
                          <span>{error}</span>
                          {(error.includes('سرور') || error.includes('ارتباط')) && (
                              <button type="button" onClick={() => setShowServerConfig(true)} className="text-xs bg-red-100 px-3 py-1 rounded-full flex items-center gap-1 hover:bg-red-200 mt-1">
                                  <RefreshCw size={12}/> تغییر آدرس سرور
                              </button>
                          )}
                      </div>
                  )}

                  {/* Direct Server URL Setting (Highly visible for mobile only before login) */}
                  {isNative && (
                    <div className="space-y-2 bg-blue-50/50 dark:bg-blue-900/10 p-3.5 rounded-2xl border border-blue-100/70 dark:border-blue-900/30">
                        <div className="flex justify-between items-center mr-1">
                            <label className="text-xs font-black text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                                <Server size={14} className="text-blue-500"/>
                                آدرس سرور (اتصال)
                            </label>
                            <span className="text-[10px] text-gray-500 font-mono">
                                {testStatus === 'testing' ? 'در حال تست...' : testStatus === 'success' ? 'متصل' : ''}
                            </span>
                        </div>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={serverUrl} 
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setServerUrl(val);
                                    let cleanUrl = val.trim();
                                    if (cleanUrl) {
                                        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                                            setServerHost(`http://${cleanUrl}`);
                                        } else {
                                            setServerHost(cleanUrl);
                                        }
                                    } else {
                                        localStorage.removeItem('app_server_host');
                                    }
                                }} 
                                className="w-full border border-blue-200 dark:border-blue-800/80 rounded-xl px-4 py-3 pl-14 text-left dir-ltr font-mono font-bold text-xs text-blue-900 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-400" 
                                placeholder="192.168.1.50:3000"
                                autoCapitalize="off"
                                autoCorrect="off"
                            />
                            <button
                                type="button"
                                onClick={testConnection}
                                className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                                {testStatus === 'testing' ? <Loader2 size={12} className="animate-spin" /> : 'تست'}
                            </button>
                        </div>
                        {testStatus === 'success' && (
                            <div className="text-[11px] text-green-700 font-medium mr-1 flex items-center gap-1">
                                <CheckCircle2 size={12}/> اتصال موفقیت‌آمیز بود.
                            </div>
                        )}
                        {testStatus === 'failed' && (
                            <div className="text-[11px] text-red-600 font-medium mr-1 leading-4">
                                ⚠️ {testMessage}
                            </div>
                        )}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 block mr-1">نام کاربری</label>
                      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all glass-panel text-left dir-ltr outline-none font-medium" required />
                  </div>
                  
                  <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 block mr-1">رمز عبور</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all glass-panel text-left dir-ltr outline-none font-medium" required />
                  </div>

                  <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-lg mt-4">
                      {loading ? <Loader2 className="animate-spin" /> : <LogIn size={22} />}
                      ورود به حساب
                  </button>

                  {/* Add Visible Restore Button Here */}
                  <div className="pt-4 border-t border-gray-100 text-center">
                      <button 
                        type="button"
                        onClick={() => setShowRestoreModal(true)}
                        className="text-xs text-amber-600 hover:text-amber-800 font-bold flex items-center justify-center gap-1 mx-auto transition-colors px-3 py-2 rounded-lg hover:bg-amber-50"
                      >
                          <Database size={14} />
                          بازیابی اطلاعات (بازگردانی دیتابیس)
                      </button>
                  </div>
                </form>
            </>
        )}
      </div>
      
      <div className="absolute bottom-4 text-center text-gray-400 text-[10px] dir-ltr font-mono opacity-50">
          {isNative ? (serverUrl || 'No Server Configured') : 'Web Mode'}
      </div>
    </div>
  );
};
export default Login;
