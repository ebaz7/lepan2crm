import React, { useState } from 'react';
import { Megaphone, RefreshCw, X, Sparkles, DownloadCloud } from 'lucide-react';
import { AppVersionInfo, applyApplicationUpdate } from '../services/updateService';

interface UpdateBannerProps {
  updateInfo: AppVersionInfo | null;
  onDismiss?: () => void;
  className?: string;
  variant?: 'floating' | 'embedded';
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  updateInfo,
  onDismiss,
  className = '',
  variant = 'embedded'
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  if (!updateInfo) return null;

  const handleUpdateClick = async () => {
    setIsUpdating(true);
    try {
      await applyApplicationUpdate(updateInfo);
    } catch (e) {
      console.error('Update failed:', e);
      setIsUpdating(false);
    }
  };

  const titleText = updateInfo.title || 'نسخۀ جدید';
  const buildText = updateInfo.buildNumber 
    ? `بیلد ${updateInfo.buildNumber}` 
    : (updateInfo.version ? `نسخه ${updateInfo.version}` : 'آماده دریافت');

  return (
    <div 
      className={`relative z-50 w-full transition-all duration-300 ${className}`}
      dir="rtl"
    >
      <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-gray-200/80 dark:border-zinc-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 flex items-center justify-between gap-3 overflow-hidden">
        
        {/* Right Section: Megaphone Icon & Version Info */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Stylized Megaphone Illustration */}
          <div className="relative shrink-0 flex items-center justify-center">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 transform -rotate-3 transition-transform hover:rotate-0">
              <Megaphone size={22} className="text-white drop-shadow-sm transform -rotate-12" />
            </div>
            {/* Animated Star / Sparkle Accent */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-black text-sm sm:text-base text-gray-900 dark:text-white tracking-tight leading-none">
                {titleText}
              </h3>
              {updateInfo.version && (
                <span className="text-[10px] sm:text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                  v{updateInfo.version}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
              <span className="font-mono text-gray-600 dark:text-gray-300 font-bold">{buildText}</span>
              <span className="hidden xs:inline text-gray-300 dark:text-gray-600">•</span>
              <span className="hidden xs:inline truncate text-emerald-600 dark:text-emerald-400">
                {updateInfo.releaseNotes || 'به‌روزرسانی و بهینه‌سازی جدید'}
              </span>
            </div>
          </div>
        </div>

        {/* Left Section: Action Button & Close */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleUpdateClick}
            disabled={isUpdating}
            className="bg-[#05b875] hover:bg-[#049a62] active:bg-[#038353] text-white font-black text-xs sm:text-sm px-4 sm:px-6 py-2.5 rounded-2xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-75 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
          >
            {isUpdating ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>در حال دریافت...</span>
              </>
            ) : (
              <>
                <DownloadCloud size={15} className="hidden sm:inline" />
                <span>به‌روز رسانی</span>
              </>
            )}
          </button>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              title="بستن موقت"
            >
              <X size={16} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default UpdateBanner;
