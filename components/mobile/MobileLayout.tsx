
import React from 'react';
import { Home, PlusCircle, ListChecks, User as UserIcon, Menu, Sun, Moon } from 'lucide-react';
import { User } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

interface MobileLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onLogout: () => void;
  unreadCount: number;
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  currentUser,
  unreadCount,
  theme,
  toggleTheme
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-transparent text-gray-800 dark:text-gray-200 pb-20 relative overflow-hidden">
      {/* Background Blobs for fluid depth */}
      <div className="bg-blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
      </div>

      {/* Mobile Header with Google Gemini aesthetics */}
      <header className="glass-header p-4 sticky top-0 z-50 flex justify-between items-center safe-pt rounded-b-[2rem] shadow-b-[4px_0_30px_rgba(0,0,0,0.03)] border-none">
        <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-tr from-[#4b90ff] via-[#aa72ff] to-[#ff6097] text-white rounded-2xl flex items-center justify-center font-bold shadow-xl border-2 border-white/40 rotate-2 animate-pulse-subtle">
                {currentUser.fullName.charAt(0)}
            </div>
            <div>
              <h1 className="font-black text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-widest leading-none mb-1 gemini-gradient-text bg-gradient-to-r from-[#4b90ff] to-[#ff6097]">سامانه مالی</h1>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold">{currentUser.fullName}</p>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            {toggleTheme && (
                <button 
                  onClick={toggleTheme}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/20 dark:bg-white/10 backdrop-blur-3xl border border-white/40 dark:border-white/10 text-zinc-700 dark:text-zinc-300 shadow-md transition-transform active:scale-90"
                >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} className="text-yellow-400" />}
                </button>
            )}
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 p-4 overflow-y-auto relative z-10">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="bottom-nav-bar fixed bottom-6 left-6 right-6 glass-panel border border-zinc-200/50 dark:border-zinc-800/40 flex justify-around items-center py-2 rounded-[2.5rem] z-50 shadow-2xl backdrop-blur-3xl px-2">
        {(['dashboard', 'create', 'manage', 'settings'] as const).map((id) => {
          const isActive = activeTab === id;
          const config = {
            dashboard: { icon: Home, label: 'خانه' },
            create: { icon: PlusCircle, label: 'ثبت جدید' },
            manage: { icon: ListChecks, label: 'کارتابل' },
            settings: { icon: Menu, label: 'منو' }
          }[id];
          const Icon = config.icon;

          return (
            <button 
              key={id}
              onClick={() => setActiveTab(id)} 
              className={`flex flex-col items-center gap-1 p-2 transition-all duration-300 flex-1 relative`}
            >
              <div className="relative z-10 flex flex-col items-center">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-[#4b90ff] dark:text-[#ff8da1]' : 'text-zinc-400 dark:text-zinc-500'} />
                <span className={`text-[9px] font-black ${isActive ? 'text-zinc-900 dark:text-zinc-200' : 'text-zinc-400 dark:text-zinc-500'}`}>{config.label}</span>
                {isActive && unreadCount > 0 && id === 'manage' && (
                   <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>
                )}
              </div>
              
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-[#4b90ff]/10 dark:via-[#aa72ff]/10 dark:to-transparent rounded-2xl -z-0"
                  transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default MobileLayout;
