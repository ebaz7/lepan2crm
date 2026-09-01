import React, { useState, useEffect, useRef } from 'react';
import { login } from '../services/authService';
import { getServerHost, setServerHost, apiCall } from '../services/apiService';
import { User } from '../types';
import { 
  LogIn, 
  KeyRound, 
  Loader2, 
  Settings, 
  Server, 
  Wifi, 
  WifiOff, 
  Save, 
  RefreshCw, 
  Globe, 
  CheckCircle2, 
  XCircle, 
  Database, 
  UploadCloud, 
  Sparkles,
  ShieldCheck,
  Building2,
  Lock,
  User as UserIcon,
  Sun,
  Moon,
  Eye,
  EyeOff
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'motion/react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Interactive Lamp States
  const [isLampOn, setIsLampOn] = useState(true);
  const [isPulling, setIsPulling] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  
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

  const toggleLamp = () => {
    setIsPulling(true);
    setHasInteracted(true);
    
    // Slight audio feedback if supported
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isLampOn ? 440 : 880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      // AudioContext not allowed before user gesture or unavailable
    }

    setTimeout(() => {
      setIsLampOn(prev => !prev);
      setIsPulling(false);
    }, 180);
  };

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
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
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
    <div 
      className={`min-h-screen w-full flex items-center justify-center p-4 md:p-8 relative font-sans overflow-hidden select-none transition-colors duration-700 ${
        isLampOn 
          ? 'bg-[#090d16] text-slate-100' 
          : 'bg-[#03060a] text-slate-400'
      }`} 
      dir="rtl"
    >
      
      {/* --- REAL HIGH-QUALITY BACKGROUND IMAGE FROM THE PHOTO --- */}
      <motion.div 
        animate={{
          filter: isLampOn 
            ? 'brightness(1) contrast(1)' 
            : 'brightness(0.06) contrast(1.15) saturate(0.25)'
        }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="absolute inset-0 z-0 select-none pointer-events-none transition-all duration-700"
        style={{
          backgroundImage: "url('/login-bg.jpg')",
          backgroundPosition: '72.5% 50%',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat'
        }}
      />

      {/* Top Floating Control Bar */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-50">
        {/* Left Side: Server Config and Quick Indicators */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowServerConfig(!showServerConfig)} 
            className="p-3 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-amber-400 rounded-2xl border border-slate-700/60 shadow-lg shadow-black/40 backdrop-blur-md transition-all active:scale-95"
            title="تنظیمات سرور"
          >
            <Settings size={20} />
          </button>
          
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/60 border border-slate-700/50 rounded-full backdrop-blur-md text-xs font-medium text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>ارتباط امن SSL / 256-Bit</span>
          </div>
        </div>

        {/* Right Side: Lamp Quick Switch & Emergency Database Restore */}
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleLamp}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border backdrop-blur-md transition-all text-xs font-bold shadow-lg ${
              isLampOn 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20' 
                : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
            title="کلید روشنایی میز کار"
          >
            {isLampOn ? <Sun size={16} className="text-amber-400 animate-spin-slow"/> : <Moon size={16}/>}
            <span className="hidden sm:inline">{isLampOn ? 'روشنایی فعال' : 'روشنایی خاموش'}</span>
          </button>

          <button 
            onClick={() => setShowRestoreModal(true)} 
            className="p-3 bg-slate-900/80 hover:bg-slate-800 text-amber-400/80 hover:text-amber-300 rounded-2xl border border-slate-700/60 shadow-lg shadow-black/40 backdrop-blur-md transition-all active:scale-95 hidden md:flex"
            title="بازگردانی اضطراری دیتابیس"
          >
            <Database size={20} />
          </button>
        </div>
      </div>

      {/* --- REALISTIC INTERACTIVE PULL-STRING (سیم کششی خاموش و روشن کردن چراغ) --- */}
      <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
        <motion.div 
          onClick={toggleLamp}
          animate={{ 
            y: isPulling ? 15 : 0 
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 14 }}
          className="absolute left-[72.5%] top-[41%] h-[100px] pointer-events-auto cursor-pointer group flex flex-col items-center"
          style={{ transform: 'translateX(-50%)' }}
          title="برای خاموش/روشن کردن، کلیک کنید"
        >
          {/* Beaded Brass Pull Chain */}
          <div 
            className="w-[2.5px] h-[55px] bg-repeat-y group-hover:scale-x-125 transition-transform"
            style={{
              backgroundImage: 'radial-gradient(circle, #fcd34d 40%, #78350f 95%)',
              backgroundSize: '2.5px 5px'
            }}
          />
          
          {/* Weighted Solid Bronze Bell Tassel (دستگیره آویز کوچک‌تر) */}
          <div className="w-2.5 h-6 bg-gradient-to-b from-[#fef3c7] via-[#d97706] to-[#78350f] rounded-b-full rounded-t-sm shadow-2xl shadow-black/80 border border-[#fef3c7]/40 flex flex-col items-center justify-end pb-0.5 group-hover:scale-110 group-active:scale-95 transition-all">
            <div className="w-full h-0.5 bg-[#451a03]/50 mb-0.5" />
            <div className="w-1 h-1 rounded-full bg-amber-200/90" />
          </div>
        </motion.div>
      </div>

      {/* Main Stage Grid Container */}
      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center px-4">
        
        {/* RIGHT COLUMN: Company Identity (Visually on the Right Side under the Hanging Lamp on Desktop, but below Login on Mobile) */}
        <div className="lg:col-span-6 flex flex-col justify-center items-center order-2 lg:order-1 min-h-[160px] lg:min-h-[450px] relative z-10 py-6 text-center">
          {/* Spacer to push content under the hanging lamp area on desktop */}
          <div className="hidden lg:block h-32" />
          
          <motion.div 
            animate={{ 
              opacity: isLampOn ? 1 : 0.35,
              y: isLampOn ? 0 : 5
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="space-y-4 max-w-lg mx-auto"
          >
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-500 shadow-inner backdrop-blur-md ${
              isLampOn
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                : 'bg-slate-900/60 border border-slate-800/60 text-slate-400'
            }`}>
              <Building2 size={14} className={isLampOn ? 'text-amber-400 animate-pulse' : 'text-slate-500'} />
              <span>سامانه یکپارچه مالی و بازرگانی</span>
            </div>
            
            <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight transition-all duration-500 ${
              isLampOn 
                ? 'text-slate-100 drop-shadow-[0_0_15px_rgba(251,191,36,0.15)]' 
                : 'text-slate-500'
            }`}>
              مدیریت و کنترل هوشمند سازمانی
            </h2>
            
            <p className={`text-xs sm:text-sm max-w-md mx-auto leading-relaxed transition-all duration-500 ${
              isLampOn ? 'text-slate-300 font-medium' : 'text-slate-600'
            }`}>
              سیستم جامع مدیریت کارتابل دستور پرداخت، بیجک انبار، برگه‌های خروج و اسناد اعتباری
            </p>
          </motion.div>
        </div>

        {/* LEFT COLUMN: Modern Glass Login Panel (Visually on the Left Side on Desktop, and first on Mobile) */}
        <div className="lg:col-span-6 flex justify-center lg:justify-start order-1 lg:order-2 relative z-20">
          
          <motion.div 
            animate={{
              boxShadow: isLampOn 
                ? '0 30px 70px -15px rgba(251, 191, 36, 0.12), 0 0 50px rgba(245, 158, 11, 0.04)'
                : '0 20px 40px -15px rgba(0, 0, 0, 0.8)',
              borderColor: isLampOn ? 'rgba(251, 191, 36, 0.25)' : 'rgba(255, 255, 255, 0.06)'
            }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md bg-slate-950/80 backdrop-blur-xl border rounded-[2rem] p-7 sm:p-9 shadow-2xl relative overflow-hidden"
          >
            
            {/* Ambient Top Glow Border inside the Card */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] transition-all duration-700 ${
              isLampOn 
                ? 'bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-100' 
                : 'bg-gradient-to-r from-transparent via-slate-600 to-transparent opacity-30'
            }`} />

            {showServerConfig ? (
              /* --- SERVER CONFIGURATION VIEW --- */
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 mb-3 shadow-inner">
                    <Server size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-100">تنظیم آدرس سرور مرکزی</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    آدرس IP سرور محلی یا دامنه اختصاصی سامانه را وارد نمایید.
                  </p>
                </div>

                <form onSubmit={handleSaveServer} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block mr-1">آدرس سرور (به همراه پورت)</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={serverUrl} 
                        onChange={(e) => { setServerUrl(e.target.value); setTestStatus('idle'); }} 
                        className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3.5 pl-11 text-left dir-ltr font-mono font-bold text-sm text-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all" 
                        placeholder="192.168.1.50:3000"
                        autoCapitalize="off"
                        autoCorrect="off"
                      />
                      <Globe size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button 
                      type="button" 
                      onClick={testConnection}
                      disabled={!serverUrl || testStatus === 'testing'}
                      className="w-full text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 py-3 rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 font-bold"
                    >
                      {testStatus === 'testing' ? <Loader2 size={14} className="animate-spin text-amber-400"/> : <Wifi size={14}/>}
                      بررسی وضعیت اتصال
                    </button>
                    
                    {testStatus === 'success' && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs p-3 rounded-xl flex items-center gap-2 font-medium">
                        <CheckCircle2 size={16} className="shrink-0"/> 
                        <span>{testMessage}</span>
                      </div>
                    )}
                    
                    {testStatus === 'failed' && (
                      <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-xl flex items-center gap-2 font-medium">
                        <XCircle size={16} className="shrink-0"/> 
                        <span>{testMessage}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setShowServerConfig(false)}
                      className="w-1/3 bg-slate-800 text-slate-300 py-3.5 rounded-xl font-bold hover:bg-slate-700 text-sm transition-all"
                    >
                      انصراف
                    </button>
                    <button 
                      type="submit" 
                      className="w-2/3 bg-amber-500 hover:bg-amber-400 text-slate-950 py-3.5 rounded-xl font-black shadow-lg shadow-amber-500/20 text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Save size={18}/>
                      ذخیره و ثبت
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* --- PRIMARY LOGIN FORM VIEW --- */
              <div className="space-y-6">

                {/* Form Title & Login State Badge */}
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-black text-slate-100 flex items-center gap-1.5">
                      <span>ورود به حساب کاربری</span>
                      <Sparkles size={16} className={isLampOn ? 'text-amber-400 animate-pulse' : 'text-slate-600'} />
                    </h1>
                    <p className="text-[11px] text-slate-400 mt-0.5">مشخصات کاربری مجاز خود را وارد کنید</p>
                  </div>
                  
                  {/* Badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 border border-slate-800/80 rounded-xl text-[10px] font-bold text-slate-300">
                    <KeyRound size={12} className="text-amber-400" />
                    <span>{isNative ? 'موبایل' : 'نسخه وب'}</span>
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-2xl text-xs text-center font-bold flex flex-col items-center gap-2"
                  >
                    <span>{error}</span>
                    {(error.includes('سرور') || error.includes('ارتباط')) && (
                      <button 
                        type="button" 
                        onClick={() => setShowServerConfig(true)} 
                        className="text-[11px] bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 px-3 py-1 rounded-full flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw size={12}/> بررسی آدرس سرور
                      </button>
                    )}
                  </motion.div>
                )}

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* Username Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block mr-1 flex items-center justify-between">
                      <span>نام کاربری</span>
                      <span className="text-[10px] text-slate-500">شناسه پرسنلی / ایمیل</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        className="w-full bg-slate-950/70 border border-slate-700/70 rounded-2xl px-4 py-3.5 pr-11 text-right text-sm text-slate-100 font-medium placeholder:text-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all" 
                        placeholder="نام کاربری خود را وارد کنید"
                        required 
                      />
                      <UserIcon size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block mr-1 flex items-center justify-between">
                      <span>کلمه عبور</span>
                      <span className="text-[10px] text-slate-500">حساس به حروف بزرگ و کوچک</span>
                    </label>
                    <div className="relative">
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        className="w-full bg-slate-950/70 border border-slate-700/70 rounded-2xl px-4 py-3.5 pr-11 pl-11 text-right text-sm text-slate-100 font-medium placeholder:text-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all" 
                        placeholder="••••••••"
                        required 
                      />
                      <Lock size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                        title={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                      >
                        {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full mt-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 py-4 rounded-2xl font-black text-base shadow-xl shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin text-slate-950" size={20} />
                        <span>در حال بررسی اعتبار...</span>
                      </>
                    ) : (
                      <>
                        <LogIn size={20} />
                        <span>ورود به سامانه</span>
                      </>
                    )}
                  </button>

                  {/* Footer Security Badges */}
                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-500" />
                      <span>ورود امن سازمانی</span>
                    </div>
                    
                    <button 
                      type="button"
                      onClick={() => setShowRestoreModal(true)}
                      className="text-amber-400/80 hover:text-amber-300 font-bold transition-colors"
                    >
                      بازیابی دیتابیس
                    </button>
                  </div>

                </form>
              </div>
            )}

          </motion.div>
        </div>

      </div>

      {/* Database Emergency Restore Modal */}
      <AnimatePresence>
        {showRestoreModal && (
          <div className="fixed inset-0 bg-black/85 z-[100] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center text-slate-200"
            >
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-400">
                <Database size={32}/>
              </div>
              <h3 className="text-lg font-black text-slate-100 mb-2">بازگردانی اضطراری دیتابیس</h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                با آپلود فایل پشتیبان، تمام اطلاعات فعلی جایگزین خواهند شد.<br/>
                <span className="text-rose-400 font-bold">توجه: این عملیات غیرقابل بازگشت است.</span>
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
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 text-sm transition-all"
                >
                  {restoring ? <Loader2 size={18} className="animate-spin"/> : <UploadCloud size={18}/>}
                  {restoring ? 'در حال بازگردانی...' : 'انتخاب فایل بکاپ'}
                </button>
                <button 
                  onClick={() => setShowRestoreModal(false)} 
                  disabled={restoring}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3.5 rounded-xl font-bold text-sm transition-all"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* System Footer Tag */}
      <div className="absolute bottom-4 left-6 text-slate-600 text-[11px] font-mono dir-ltr opacity-60">
        {isNative ? (serverUrl || 'Native Mode') : 'Enterprise Security v1.3.2'}
      </div>

    </div>
  );
};

export default Login;
