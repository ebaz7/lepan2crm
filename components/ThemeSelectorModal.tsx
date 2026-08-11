import React, { useState, useEffect } from 'react';
import { X, Check, Sparkles, LayoutGrid, Box, Feather, Zap, Image, Layers, Moon, Sun } from 'lucide-react';

export type AppThemeMode = 'light-aurora' | 'theme-bento' | 'theme-claymorphism' | 'theme-skeuomorphism' | 'theme-minimalism' | 'theme-maximalism';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  onSelectTheme: (theme: AppThemeMode) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const THEME_OPTIONS: { id: AppThemeMode; name: string; desc: string; icon: any; badge: string; bgGradient: string; borderStyle: string }[] = [
  {
    id: 'light-aurora',
    name: 'شیشه‌ای (Glassmorphism)',
    desc: 'پوسته ترنسپرنت شیشه‌ای مدرن با بلور و گرادیان‌های اورورا (پیش‌فرض با پس‌زمینه فعال)',
    icon: Sparkles,
    badge: 'دیفالت',
    bgGradient: 'from-purple-500/20 via-pink-500/20 to-blue-500/20',
    borderStyle: 'border-white/40 backdrop-blur-md shadow-lg',
  },
  {
    id: 'theme-bento',
    name: 'بنتو گرید (Bento Grid)',
    desc: 'پوسته مدرن بنتو با کارت‌های مجزا، پس‌زمینه نیلی تیره، کنتراست بالا و لبه‌های گرد',
    icon: LayoutGrid,
    badge: 'مدرن',
    bgGradient: 'from-slate-900 via-indigo-950 to-slate-900',
    borderStyle: 'border-indigo-500/30 shadow-xl text-white',
  },
  {
    id: 'theme-claymorphism',
    name: 'سفالی ۳ بعدی (Claymorphism)',
    desc: 'پوسته حجیم خمیری با سایه‌های نرم پافی و رنگ‌های پاستلی شاد',
    icon: Box,
    badge: 'سه‌بعدی',
    bgGradient: 'from-purple-100 via-indigo-100 to-blue-100',
    borderStyle: 'border-white shadow-[6px_6px_12px_rgba(163,177,198,0.5),-6px_-6px_12px_rgba(255,255,255,0.8)] rounded-2xl',
  },
  {
    id: 'theme-skeuomorphism',
    name: 'واقع‌گرایانه (Skeuomorphism)',
    desc: 'پوسته کلاسیک واقع‌گرایانه با دکمه‌های برجسته، افکت‌های نوری بیول و حس ملموس',
    icon: Layers,
    badge: 'برجسته',
    bgGradient: 'from-gray-200 via-slate-300 to-zinc-200',
    borderStyle: 'border-white/90 shadow-[inset_0_1px_2px_rgba(255,255,255,1),0_6px_12px_rgba(0,0,0,0.15)] bg-gradient-to-b from-gray-100 to-gray-300 text-slate-800',
  },
  {
    id: 'theme-minimalism',
    name: 'مینیمالیسم (Minimalism)',
    desc: 'پوسته بسیار ساده، تمیز و خلوت با خطوط ظریف و فضای تنفس زیاد',
    icon: Feather,
    badge: 'خلوت',
    bgGradient: 'from-gray-50 to-slate-100',
    borderStyle: 'border-gray-300 shadow-sm rounded-lg',
  },
  {
    id: 'theme-maximalism',
    name: 'ماکسیمالیسم / نئوبروتالیسم (Maximalism)',
    desc: 'پوسته پرانرژی با خطوط مشکی ضخیم، رنگ‌های نیون زنده و سایه پاپ-آرت',
    icon: Zap,
    badge: 'پاپ‌آرت',
    bgGradient: 'from-yellow-200 via-lime-200 to-amber-200',
    borderStyle: 'border-2 border-black shadow-[4px_4px_0px_#000] bg-[#dfff00] text-black font-black',
  },
];

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  const [bgEnabled, setBgEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('app_enable_bg_image');
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    return currentTheme === 'light-aurora';
  });

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('app_enable_bg_image');
      if (saved === 'true') {
        setBgEnabled(true);
      } else if (saved === 'false') {
        setBgEnabled(false);
      } else {
        setBgEnabled(currentTheme === 'light-aurora');
      }
    }
  }, [isOpen, currentTheme]);

  if (!isOpen) return null;

  const handleToggleBg = () => {
    const newValue = !bgEnabled;
    setBgEnabled(newValue);
    localStorage.setItem('app_enable_bg_image', newValue ? 'true' : 'false');
    window.dispatchEvent(new Event('APP_THEME_BG_CHANGED'));
  };

  const handleSelectThemeOption = (themeId: AppThemeMode) => {
    onSelectTheme(themeId);
    // If user hasn't explicitly set bg_image preference, default it according to theme rule
    const saved = localStorage.getItem('app_enable_bg_image');
    if (!saved) {
      // Auto logic: only light-aurora gets bg image by default
      const autoBg = themeId === 'light-aurora';
      setBgEnabled(autoBg);
    }
    window.dispatchEvent(new Event('APP_THEME_BG_CHANGED'));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">انتخاب پوسته و سبک رابط کاربری (UI Style)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">سبک ظاهری مورد علاقه خود را انتخاب کنید (بدون تغییر در امکانات سیستم)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Options & Settings */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Dark Mode Toggle */}
          {onToggleDarkMode && (
            <div className="p-4 bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                  {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
                </div>
                <div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white block">حالت شب / دارک مود (Dark Mode)</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    {isDarkMode 
                      ? 'حالت دارک حرفه‌ای و اصولی روی پوسته فعلی فعال است' 
                      : 'حالت روشن (Light Mode)'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleDarkMode}
                className={`w-12 h-7 rounded-full transition-colors relative p-1 shrink-0 ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${isDarkMode ? 'translate-x-0' : '-translate-x-5'}`} />
              </button>
            </div>
          )}

          {/* Background Wallpaper Toggle */}
          <div className="p-4 bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/15 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
                <Image size={20} />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">تصویر/والپیپر پس‌زمینه (Background Image)</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {bgEnabled 
                    ? 'تصویر یا والپیپر پس‌زمینه فعال است' 
                    : 'پس‌زمینه ساده و تک‌رنگ (پیش‌فرض برای تم‌های غیر شیشه‌ای)'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleBg}
              className={`w-12 h-7 rounded-full transition-colors relative p-1 shrink-0 ${bgEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${bgEnabled ? 'translate-x-0' : '-translate-x-5'}`} />
            </button>
          </div>

          <div className="space-y-3">
            {THEME_OPTIONS.map((theme) => {
              const Icon = theme.icon;
              const isSelected = currentTheme === theme.id;

              return (
                <div
                  key={theme.id}
                  onClick={() => handleSelectThemeOption(theme.id)}
                  className={`group relative p-4 rounded-2xl cursor-pointer transition-all duration-200 border-2 flex items-center justify-between gap-4 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 shadow-md ring-2 ring-blue-600/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start gap-4 flex-1">
                    {/* Theme Badge Visual Preview */}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${theme.bgGradient} ${theme.borderStyle} shrink-0`}>
                      <Icon size={24} className={theme.id === 'theme-maximalism' ? 'text-black' : theme.id === 'theme-bento' ? 'text-indigo-400' : 'text-slate-800 dark:text-white'} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 dark:text-white text-base">{theme.name}</h4>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {theme.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{theme.desc}</p>
                    </div>
                  </div>

                  {/* Selected Checkmark */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
                    isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-700 text-transparent'
                  }`}>
                    <Check size={16} strokeWidth={3} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
          <span className="text-xs text-slate-500">تغییرات بلافاصله ذخیره می‌شود.</span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl text-xs hover:opacity-90 transition-opacity"
          >
            تایید و بستن
          </button>
        </div>
      </div>
    </div>
  );
};

