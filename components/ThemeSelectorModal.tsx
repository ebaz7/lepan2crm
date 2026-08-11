import React from 'react';
import { X, Check, Sparkles, LayoutGrid, Box, Feather, Zap } from 'lucide-react';

export type AppThemeMode = 'light-aurora' | 'theme-bento' | 'theme-claymorphism' | 'theme-minimalism' | 'theme-maximalism';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  onSelectTheme: (theme: AppThemeMode) => void;
}

export const THEME_OPTIONS: { id: AppThemeMode; name: string; desc: string; icon: any; badge: string; bgGradient: string; borderStyle: string }[] = [
  {
    id: 'light-aurora',
    name: 'شیشه‌ای (Glassmorphism)',
    desc: 'پوسته ترنسپرنت شیشه‌ای مدرن با بلور و گرادیان‌های اورورا (پیش‌فرض)',
    icon: Sparkles,
    badge: 'دیفالت',
    bgGradient: 'from-purple-500/20 via-pink-500/20 to-blue-500/20',
    borderStyle: 'border-white/40 backdrop-blur-md shadow-lg',
  },
  {
    id: 'theme-bento',
    name: 'بنتو گرید (Bento Grid)',
    desc: 'پوسته مدرن بنتو با کارت‌های مجزا، پس‌زمینه داست‌آبی یا نیلی و لبه‌های گرد',
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
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
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

        {/* Options Grid */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          {THEME_OPTIONS.map((theme) => {
            const Icon = theme.icon;
            const isSelected = currentTheme === theme.id;

            return (
              <div
                key={theme.id}
                onClick={() => {
                  onSelectTheme(theme.id);
                  onClose();
                }}
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

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
          <span className="text-xs text-slate-500">انتخاب شما بلافاصله ذخیره می‌شود.</span>
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
