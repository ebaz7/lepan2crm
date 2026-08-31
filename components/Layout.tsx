
import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, LayoutDashboard, Search, PlusCircle, ListChecks, FileText, Inbox, Users, LogOut, 
  User as UserIcon, Settings, Bell, BellOff, MessageSquare, X, Check, Container, KeyRound, Save, 
  Upload, Camera, Download, Share, ChevronRight, Home, Send, BrainCircuit, Mic, StopCircle, Loader2, 
  Truck, ClipboardList, Package, Printer, CheckSquare, ShieldCheck, Shield, Phone, RefreshCw, 
  Smartphone, MonitorDown, BellRing, Smartphone as MobileIcon, Trash2, Menu, Edit3, Sun, Moon, 
  ShoppingCart, Wallet, Sparkles, Pin, PinOff,
  BadgePlus, Receipt, ArrowLeftRight, ScrollText, ClipboardCheck, Warehouse, BarChart3, 
  CalendarDays, FolderArchive, Banknote, MessagesSquare, Globe, Boxes, Handshake, Headset, UserCog
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, UserRole, AppNotification, SystemSettings } from '../types';
import { logout, hasPermission, getRolePermissions, updateUser } from '../services/authService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp, sendNotification } from '../services/notificationService';
import { getSettings, saveSettings, uploadFile } from '../services/storageService';
import { apiCall, resolveImageUrl } from '../services/apiService';
import { DEFAULT_MOBILE_NAV_ORDER } from '../constants';
import { Capacitor } from '@capacitor/core';

interface LayoutProps {
  children: React.ReactNode;
  onBack: () => boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onLogout: () => void;
  notifications: AppNotification[];
  clearNotifications: () => void;
  markAllNotificationsAsRead?: () => void;
  onDeleteNotification?: (id: string) => void;
  onAddNotification: (title: string, message: string) => void;
  onRemoveNotification: (id: string) => void;
  financialYear?: string;
  setFinancialYear?: (y: string) => void;
  settings?: SystemSettings | null;
  theme: string;
  toggleTheme: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  unreadChatCount?: number;
}

import { SearchModal } from './SearchModal';
import { UpdateBanner } from './UpdateBanner';
import { checkServerUpdate, AppVersionInfo } from '../services/updateService';

const Layout: React.FC<LayoutProps> = ({ children, onBack, activeTab, setActiveTab, currentUser, onLogout, notifications, clearNotifications, markAllNotificationsAsRead, onDeleteNotification, onAddNotification, onRemoveNotification, financialYear, setFinancialYear, settings: propSettings, theme, toggleTheme, isDarkMode, onToggleDarkMode, unreadChatCount = 0 }) => {
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(propSettings || null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [bgMode, setBgMode] = useState<string>(() => localStorage.getItem('app_bg_mode') || 'preset');
  const [bgPreset, setBgPreset] = useState<string>(() => localStorage.getItem('app_preset_bg') || 'aurora-light');
  const [customBgImage, setCustomBgImage] = useState<string | null>(() => localStorage.getItem('app_custom_bg_image'));
  const [customBgBlur, setCustomBgBlur] = useState<number>(() => {
    const saved = localStorage.getItem('app_custom_bg_blur');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [bgImageVersion, setBgImageVersion] = useState<number>(0);

  useEffect(() => {
    const handleBgChange = () => {
      setBgMode(localStorage.getItem('app_bg_mode') || 'preset');
      setBgPreset(localStorage.getItem('app_preset_bg') || 'aurora-light');
      setCustomBgImage(localStorage.getItem('app_custom_bg_image'));
      const savedBlur = localStorage.getItem('app_custom_bg_blur');
      setCustomBgBlur(savedBlur ? parseInt(savedBlur, 10) : 0);
      setBgImageVersion(v => v + 1);
    };
    window.addEventListener('APP_THEME_BG_CHANGED', handleBgChange);
    return () => window.removeEventListener('APP_THEME_BG_CHANGED', handleBgChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove old background-related classes
    root.classList.remove(
      'has-custom-bg', 
      'has-preset-bg-cosmic-dark', 
      'has-preset-bg-aurora-light', 
      'has-preset-bg-cyan-cosmic', 
      'has-preset-bg-dark-midnight', 
      'has-preset-bg-light-modern'
    );
    
    // Check if background image should be enabled
    const savedBgOverride = localStorage.getItem('app_enable_bg_image');
    const isBgActive = savedBgOverride === 'true' || (savedBgOverride !== 'false' && theme === 'light-aurora');

    if (isBgActive) {
      if (bgMode === 'custom' && customBgImage) {
        root.classList.add('has-custom-bg');
      } else if (bgMode === 'preset') {
        root.classList.add(`has-preset-bg-${bgPreset || 'aurora-light'}`);
      }
    }
  }, [bgMode, bgPreset, customBgImage, theme, bgImageVersion]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            setIsSearchOpen(true);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleGlobalClose = () => {
        setShowNotifDropdown(false);
        setShowMobileMenu(false);
        setShowProfileModal(false);
        setShowIOSPrompt(false);
    };
    window.addEventListener('CLOSE_ACTIVE_MODALS', handleGlobalClose);
    return () => window.removeEventListener('CLOSE_ACTIVE_MODALS', handleGlobalClose);
  }, []);

  useEffect(() => {
    if (propSettings) {
        setSettings(propSettings);
        if (propSettings.customBgImage !== undefined) {
            setCustomBgImage(propSettings.customBgImage || null);
            if (propSettings.customBgImage) {
                localStorage.setItem('app_custom_bg_image', propSettings.customBgImage);
            } else {
                localStorage.removeItem('app_custom_bg_image');
            }
        }
        if (propSettings.bgMode) {
            setBgMode(propSettings.bgMode);
            localStorage.setItem('app_bg_mode', propSettings.bgMode);
        }
        if (propSettings.bgPreset) {
            setBgPreset(propSettings.bgPreset);
            localStorage.setItem('app_preset_bg', propSettings.bgPreset);
        }
        if (propSettings.customBgBlur !== undefined) {
            setCustomBgBlur(propSettings.customBgBlur);
            localStorage.setItem('app_custom_bg_blur', propSettings.customBgBlur.toString());
        }
    }
  }, [propSettings]);
  const isSecure = window.isSecureContext;
  const notifRef = useRef<HTMLDivElement>(null);
  const mobileNotifRef = useRef<HTMLDivElement>(null);
  
  // Mobile Drawer State
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  // Desktop Sidebar State: Collapsed by default, opens on mouse hover, can be pinned permanently
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(() => {
    return localStorage.getItem('app_sidebar_pinned') === 'true';
  });
  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);
  const isSidebarOpen = isSidebarPinned || isSidebarHovered;

  const toggleSidebarPin = () => {
    setIsSidebarPinned(prev => {
      const next = !prev;
      localStorage.setItem('app_sidebar_pinned', String(next));
      return next;
    });
  };

  // PWA & Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  // Profile/Password Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Dynamic Modal Detection to Hide Bottom Nav
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasBackAction, setHasBackAction] = useState(false);

  useEffect(() => {
    const checkModal = () => {
      // Check for any active modal/dialog backdrops
      const modals = document.querySelectorAll('.fixed.inset-0:not(.pointer-events-none), [role="dialog"], .modal-active, .absolute.inset-0.bg-black\\/50');
      let visible = false;
      modals.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          // Ignore background blobs or bottom navbar
          if (!el.classList.contains('bottom-nav-bar') && !el.classList.contains('bg-blobs')) {
            visible = true;
          }
        }
      });
      setIsModalOpen(visible);
    };
    
    checkModal();
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    
    const handleRegister = () => setHasBackAction(true);
    const handleUnregister = () => setHasBackAction(false);
    window.addEventListener('REGISTER_BACK_ACTION', handleRegister);
    window.addEventListener('UNREGISTER_BACK_ACTION', handleUnregister);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('REGISTER_BACK_ACTION', handleRegister);
      window.removeEventListener('UNREGISTER_BACK_ACTION', handleUnregister);
    };
  }, []);

  // Local Profile Form State
  const [profileForm, setProfileForm] = useState<{
      password?: string;
      confirmPassword?: string;
      telegramChatId: string;
      phoneNumber: string;
      receiveNotifications: boolean;
      mobileNavOrder: string[];
  }>({
      password: '',
      confirmPassword: '',
      telegramChatId: '',
      phoneNumber: '',
      receiveNotifications: true,
      mobileNavOrder: []
  });

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const prevShowDropdown = useRef(showNotifDropdown);
  useEffect(() => {
      if (prevShowDropdown.current && !showNotifDropdown) {
          if (clearNotifications && notifications.length > 0) {
              clearNotifications();
          }
      }
      prevShowDropdown.current = showNotifDropdown;
  }, [showNotifDropdown, clearNotifications, notifications]);

  useEffect(() => {
    if (showProfileModal && currentUser) {
        setProfileForm({
            password: '',
            confirmPassword: '',
            telegramChatId: currentUser.telegramChatId || '',
            phoneNumber: currentUser.phoneNumber || '',
            receiveNotifications: currentUser.receiveNotifications !== false,
            mobileNavOrder: currentUser.mobileNavOrder || []
        });
    }
  }, [showProfileModal, currentUser]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
        setNotifEnabled(isNotificationEnabledInApp());
    } else {
        try {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && isNotificationEnabledInApp()) {
                setNotifEnabled(true);
            } else {
                setNotifEnabled(false);
            }
        } catch(e) {
            console.warn("Notification API not supported or blocked");
            setNotifEnabled(false);
        }
    }
  }, []);

  // Update Detection State
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isUpdateDismissed, setIsUpdateDismissed] = useState(false);

  const checkVersion = async () => {
    try {
      const updateResult = await checkServerUpdate();
      if (updateResult.hasUpdate && updateResult.serverInfo) {
        setUpdateInfo(updateResult.serverInfo);
        setIsUpdateAvailable(true);
      }
    } catch (e) {
      console.debug('Version check error', e);
    }
  };

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, 45000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setIsUpdateAvailable(true);
      });
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    getSettings().then(data => {
        setSettings(data);
        if (data.appName) {
            document.title = data.appName;
        }
        if (data.pwaIcon) {
            const timestamp = Date.now();
            const iconUrl = data.pwaIcon.includes('?') ? `${data.pwaIcon}&t=${timestamp}` : `${data.pwaIcon}?t=${timestamp}`;
            
            // Update Apple Icon
            const appleLink = document.querySelector("link[rel*='apple-touch-icon']") as HTMLLinkElement;
            if (appleLink) { appleLink.href = iconUrl; } else { const newLink = document.createElement('link'); newLink.rel = 'apple-touch-icon'; newLink.href = iconUrl; document.head.appendChild(newLink); }
            
            // Update Shortcut Icon
            const iconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
            if (iconLink) { iconLink.href = iconUrl; } else { const newLink = document.createElement('link'); newLink.rel = 'shortcut icon'; newLink.href = iconUrl; document.head.appendChild(newLink); }
        }
    });
    
    const handleClickOutside = (event: MouseEvent) => { 
        const target = event.target as Element;
        if (showNotifDropdown && !target.closest('.notification-dropdown-container') && !target.closest('.notification-trigger')) {
            setShowNotifDropdown(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    
    window.addEventListener('beforeinstallprompt', (e) => { 
        e.preventDefault(); 
        setDeferredPrompt(e); 
    });

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    try {
        const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;
        const isDisplayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
        setIsStandalone(isInStandaloneMode || isDisplayModeStandalone);
    } catch(e) {
        setIsStandalone(false);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifDropdown]);

  const handleLogout = () => { logout(); onLogout(); };
  
  const handleToggleNotif = async () => { 
      if (!Capacitor.isNativePlatform()) {
          if (typeof window === 'undefined' || !('Notification' in window)) {
              alert("این دستگاه/مرورگر از اعلان‌های وب پشتیبانی نمی‌کند.");
              return;
          }

          if (!isSecure && window.location.hostname !== 'localhost') { 
              alert("⚠️ مرورگرها اجازه فعال‌سازی نوتیفیکیشن در شبکه غیرامن (HTTP) را نمی‌دهند."); 
              return; 
          } 
      }
      
      if (notifEnabled) { 
          setNotifEnabled(false); 
          setNotificationPreference(false); 
          return;
      } 

      try {
          const granted = await requestNotificationPermission(); 
          if (granted) { 
              setNotifEnabled(true); 
              setNotificationPreference(true); 
              onAddNotification("سیستم دستور پرداخت", "نوتیفیکیشن‌ها با موفقیت فعال شدند."); 
          } else {
              setNotifEnabled(false);
              if (!Capacitor.isNativePlatform()) {
                  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
                      alert("دسترسی به نوتیفیکیشن توسط شما مسدود شده است.");
                  } else {
                      alert("امکان فعال‌سازی وجود ندارد یا توسط مرورگر پشتیبانی نمی‌شود.");
                  }
              }
          } 
      } catch (err) {
          console.error("Notification toggle error:", err);
          if(!Capacitor.isNativePlatform()) alert("خطا در فعال‌سازی نوتیفیکیشن");
      }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      const updates: Partial<User> = {}; 
      if (profileForm.password) { 
          if (profileForm.password !== profileForm.confirmPassword) { alert('رمز عبور و تکرار آن مطابقت ندارند.'); return; } 
          if (profileForm.password.length < 4) { alert('رمز عبور باید حداقل ۴ کاراکتر باشد.'); return; } 
          updates.password = profileForm.password; 
      } 
      updates.telegramChatId = profileForm.telegramChatId;
      updates.phoneNumber = profileForm.phoneNumber;
      updates.receiveNotifications = profileForm.receiveNotifications;
      updates.mobileNavOrder = profileForm.mobileNavOrder;
      try { await updateUser({ ...currentUser, ...updates }); alert('اطلاعات با موفقیت بروزرسانی شد.'); setProfileForm(prev => ({...prev, password: '', confirmPassword: ''})); setShowProfileModal(false); window.location.reload(); } catch (err) { alert('خطا در بروزرسانی اطلاعات'); } 
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => { 
      const file = e.target.files?.[0]; if (!file) return; 
      setUploadingAvatar(true); 
      const reader = new FileReader(); 
      reader.onload = async (ev) => { 
          const base64 = ev.target?.result as string; 
          try { const result = await uploadFile(file.name, base64); await updateUser({ ...currentUser, avatar: result.url }); window.location.reload(); } catch (error) { alert('خطا در آپلود تصویر'); } finally { setUploadingAvatar(false); } 
      }; 
      reader.readAsDataURL(file); 
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  // Calculate Permissions
  const perms = settings ? getRolePermissions(currentUser.role, settings, currentUser) : { canCreatePaymentOrder: false, canViewPaymentOrders: false };
  
  // Specific Access Flags
  const canCreatePayment = perms.canCreatePaymentOrder === true;
  const canViewPayment = perms.canViewPaymentOrders === true;
  const canCreateExit = perms.canCreateExitPermit === true;
  const canViewInvoices = perms.canViewInvoices === true;
  const canViewExit = perms.canViewExitPermits === true;
  const canManageWarehouse = currentUser.role === UserRole.ADMIN || perms.canManageWarehouse === true;
  const canSeeTrade = currentUser.role === UserRole.ADMIN || perms.canManageTrade === true;
  const canSeeBalances = currentUser.role === UserRole.ADMIN || (perms as any).canViewCustomerBalances === true;
  const canSeeProducts = currentUser.role === UserRole.ADMIN || perms.canManageSales === true;
  const canSeeSettings = currentUser.role === UserRole.ADMIN || perms.canManageSettings === true || perms.canManageTradeSettings === true;
  const canSeeSecurity = currentUser.role === UserRole.ADMIN || perms.canViewSecurity === true;
  const canSeeKnowledgeBase = currentUser.role === UserRole.ADMIN || perms.canViewKnowledgeBase === true || perms.canManageKnowledgeBase === true;
  const canSeeMeetings = currentUser.role === UserRole.ADMIN || perms.canViewMeetings === true;
  const canSeePurchase = currentUser.role === UserRole.ADMIN || (perms.canView === true);
  const canSeeCcti = currentUser.role === UserRole.ADMIN || perms.canAccessCcti === true;
  const canSeeSayan = currentUser.role === UserRole.ADMIN || 
    perms.canViewSayan === true || 
    perms.canViewSayanTraz === true || 
    perms.canViewSayanSales === true || 
    perms.canViewSayanProduction === true || 
    perms.canViewSayanProdReturns === true || 
    perms.canViewSayanCheques === true || 
    perms.canViewSayanRemittances === true || 
    perms.canViewSayanWarehouseOverview === true || 
    perms.canAccessSayanReports === true;
  const canSeeNotifications = true;

  const navItems = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  ];
  if (canCreatePayment) navItems.push({ id: 'create', label: 'ثبت پرداخت', icon: BadgePlus });
  if (canViewPayment) navItems.push({ id: 'manage', label: 'سوابق پرداخت', icon: Receipt });
  if (canSeeCcti) navItems.push({ id: 'ccti', label: 'تبدیل CCTI', icon: ArrowLeftRight });
  if (canCreateExit) navItems.push({ id: 'create-exit', label: 'ثبت خروج', icon: Truck });
  if (canViewInvoices) navItems.push({ id: 'manage-invoices', label: 'مدیریت فاکتورها', icon: ScrollText });
  if (canViewExit) navItems.push({ id: 'manage-exit', label: 'سوابق خروج', icon: ClipboardCheck });
  if (canManageWarehouse) navItems.push({ id: 'warehouse', label: 'مدیریت انبار', icon: Warehouse });
  if (canSeeSayan) navItems.push({ id: 'sayan', label: 'گزارشات سایان', icon: BarChart3 });
  if (canSeeSecurity) navItems.push({ id: 'security', label: 'انتظامات', icon: ShieldCheck });
  if (canSeeMeetings) navItems.push({ id: 'meetings', label: 'جلسات تولید', icon: CalendarDays });
  if (canSeePurchase) navItems.push({ id: 'purchase', label: 'درخواست خرید', icon: ShoppingCart });
  navItems.push({ id: 'secretariat', label: 'دبیرخانه اداری', icon: FolderArchive });
  navItems.push({ id: 'cheque-receipts', label: 'رسید دریافت چک', icon: Banknote });
  navItems.push({ id: 'chat', label: 'گفتگو', icon: MessagesSquare });
  if (canSeeKnowledgeBase) navItems.push({ id: 'knowledge', label: 'اطلاعات و یادداشت ها', icon: BookOpen });
  if (canSeeTrade) navItems.push({ id: 'trade', label: 'بازرگانی', icon: Globe });
  if (canSeeBalances) navItems.push({ id: 'balances', label: 'مانده حساب مشتریان', icon: Wallet });
  if (canSeeProducts) {
      navItems.push({ id: 'products', label: 'کالاها', icon: Boxes });
      navItems.push({ id: 'sales', label: 'مشتریان', icon: Handshake });
      navItems.push({ id: 'tickets', label: 'تیکت‌ها', icon: Headset });
  }
  if (hasPermission(currentUser, 'manage_users')) navItems.push({ id: 'users', label: 'کاربران', icon: UserCog });
  if (canSeeSettings) navItems.push({ id: 'settings', label: 'تنظیمات', icon: Settings });

  // Dynamic Navigation Logic
  const mobileNavOrder_val = currentUser.mobileNavOrder || settings?.mobileNavOrder || DEFAULT_MOBILE_NAV_ORDER;

  const allAvailableItems = navItems.filter(item => {
      // Dashboard is usually always there if possible
      if (item.id === 'dashboard') return true;
      return true; // navItems is already filtered by perms
  });

  const sortedItems = [...allAvailableItems].sort((a, b) => {
      const idxA = mobileNavOrder_val.indexOf(a.id);
      const idxB = mobileNavOrder_val.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
  });

  const limit = 5;
  const bottomVisibleItems = sortedItems.slice(0, 4);
  const menuItems = sortedItems.slice(4);

  const isBottomBarVisible = !showMobileMenu && !isModalOpen && !hasBackAction && bottomVisibleItems.some(item => item.id === activeTab);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('BOTTOM_NAV_VISIBLE', { detail: isBottomBarVisible }));
  }, [isBottomBarVisible]);

  const NotificationDropdown = () => ( 
    <div role="dialog" aria-label="اعلان‌ها" className="notification-dropdown-container fixed top-16 left-4 right-4 md:absolute md:top-auto md:bottom-16 md:left-2 md:right-auto md:w-80 glass-panel rounded-xl shadow-2xl border border-gray-200/50 dark:border-white/10 text-gray-800 dark:text-gray-200 z-[9999] overflow-hidden origin-top md:origin-bottom-left animate-scale-in max-h-[60vh] flex flex-col">
        <div className="bg-blue-50 p-3 flex justify-between items-center border-b border-blue-100 shrink-0">
            <div className="flex items-center gap-2">
                {notifEnabled ? <Bell size={16} className="text-blue-600"/> : <BellOff size={16} className="text-gray-500 dark:text-gray-500"/>}
                <span className="text-xs font-bold text-blue-800">وضعیت اعلان‌ها:</span>
            </div>
            <button onClick={handleToggleNotif} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${notifEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 hover:bg-red-200 animate-pulse'}`}>
                {notifEnabled ? 'فعال است' : 'فعال‌سازی'}
            </button>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 p-2 flex justify-between items-center border-b shrink-0">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">پیام‌های سیستم</span>
            {notifications.length > 0 && (
                <button onClick={clearNotifications} className="text-gray-400 hover:text-red-500 flex items-center gap-1 text-[10px] cursor-pointer">
                    <Trash2 size={12} /> پاک کردن همه
                </button>
            )}
        </div>
        <div className="overflow-y-auto flex-1 custom-scrollbar">
            {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 flex flex-col items-center">
                    <BellOff size={24} className="mb-2 opacity-20"/>
                    هیچ پیامی نیست
                </div>
            ) : (
                notifications.map((n: any) => (
                    <div key={n.id} 
                         onClick={() => {
                             onRemoveNotification(n.id);
                             if (n.url) {
                                 let tab = n.url.replace(/^\//, ''); // Remove leading slash
                                 setActiveTab(tab);
                                 setShowMobileMenu(false);
                             }
                         }}
                         className={`p-3 border-b hover:bg-gray-50 text-right last:border-0 relative group cursor-pointer ${n.read ? 'opacity-50' : ''}`}>
                        <div className="flex justify-between items-start pl-14">
                            <div className="text-xs font-bold text-gray-800 mb-1">{n.title}</div>
                            <div className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(n.timestamp).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                        <div className="text-xs text-gray-600 leading-tight pl-14">{n.message}</div>
                        
                        <div className="absolute top-2.5 left-2 flex items-center gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {!n.read && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onRemoveNotification(n.id); }} 
                                className="text-gray-400 hover:text-green-500 p-1.5 rounded-full hover:bg-green-50 transition-colors"
                                title="علامت خوانده شده"
                            >
                                <Check size={14}/>
                            </button>
                            )}
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteNotification && onDeleteNotification(n.id); }} 
                                className="text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                                title="حذف اعلان"
                            >
                                <Trash2 size={14}/>
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div> 
  );

  const showCustomBg = bgMode === 'custom' && !!customBgImage;
  const resolvedBgImage = customBgImage ? resolveImageUrl(customBgImage) : null;
  const isPlainLight = theme === 'light' && !showCustomBg && bgMode !== 'preset';

  return (
    <div className={`flex h-[100dvh] w-full text-[var(--text-primary)] font-sans relative overflow-hidden ${isPlainLight ? 'bg-gray-100 dark:bg-gray-900' : 'bg-transparent'}`}>
      {/* Background Blobs & Custom Background Image */}
      {(!isPlainLight || showCustomBg || bgMode === 'preset') && (
        <div 
          className={`bg-blobs ${bgMode === 'preset' ? `bg-preset-${bgPreset}` : ''}`}
          style={showCustomBg && resolvedBgImage ? {
            backgroundImage: `url(${resolvedBgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
            filter: customBgBlur > 0 ? `blur(${customBgBlur}px)` : undefined,
            transform: customBgBlur > 0 ? 'scale(1.08)' : undefined,
            width: customBgBlur > 0 ? '108%' : '100%',
            height: customBgBlur > 0 ? '108%' : '100%',
            top: customBgBlur > 0 ? '-4%' : '0',
            left: customBgBlur > 0 ? '-4%' : '0',
            position: 'fixed'
          } : undefined}
        >
          {bgMode === 'preset' && (
            <>
              <div className="blob blob-1"></div>
              <div className="blob blob-2"></div>
              <div className="blob blob-3"></div>
            </>
          )}
        </div>
      )}
      
      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 animate-fade-in">
            <div className="glass-panel rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative max-h-[85vh] flex flex-col">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex flex-col items-center justify-center text-white relative shrink-0">
                    <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
                    <div className="relative group cursor-pointer mb-2" onClick={() => avatarInputRef.current?.click()}>
                        <div className="w-16 h-16 rounded-full bg-white/20 border-4 border-white/30 overflow-hidden shadow-lg">
                            {currentUser.avatar ? <img src={resolveImageUrl(currentUser.avatar)} alt="Profile" className="w-full h-full object-cover" /> : <UserIcon size={32} className="w-full h-full p-3 text-white" />}
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {uploadingAvatar ? <Loader2 size={20} className="animate-spin text-white"/> : <Camera size={20} className="text-white"/>}
                        </div>
                        <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={uploadingAvatar} />
                    </div>
                    <h3 className="text-md font-black tracking-tight">{currentUser.fullName}</h3>
                    <p className="text-[10px] font-bold opacity-80">{currentUser.role}</p>
                </div>
                <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                    <form onSubmit={handleUpdateProfile} className="space-y-4 pb-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><label className="text-xs font-bold text-gray-500">رمز عبور جدید</label><input type="password" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="******"/></div>
                            <div className="space-y-1"><label className="text-xs font-bold text-gray-500">تکرار رمز</label><input type="password" value={profileForm.confirmPassword} onChange={e => setProfileForm({...profileForm, confirmPassword: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="******"/></div>
                        </div>
                        <div className="space-y-1"><label className="text-xs font-bold text-gray-500">شماره موبایل (واتساپ)</label><input type="tel" value={profileForm.phoneNumber} onChange={e => setProfileForm({...profileForm, phoneNumber: e.target.value})} className="w-full border rounded-lg p-2 text-sm dir-ltr" placeholder="98912..."/></div>
                        
                        <div className="space-y-4 pt-4 border-t">
                            <h4 className="text-xs font-bold text-gray-700 flex items-center gap-2"><Smartphone size={16}/> اولویت نوار پایین موبایل</h4>
                            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-[10px] text-blue-700 leading-relaxed mb-2">
                                ترتیب آیکون‌ها در نوار پایین گوشی را می‌توانید شخصی‌سازی کنید.
                            </div>
                            <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-100">
                                {(profileForm.mobileNavOrder?.length ? profileForm.mobileNavOrder : DEFAULT_MOBILE_NAV_ORDER).map((itemId, idx) => {
                                    const navLabel = {
                                        dashboard: 'داشبورد',
                                        create: 'ثبت پرداخت',
                                        manage: 'سوابق پرداخت',
                                        'create-exit': 'ثبت خروج',
                                        'manage-invoices': 'مدیریت فاکتورها',
                                        'manage-exit': 'سوابق خروج',
                                        warehouse: 'مدیریت انبار',
                                        security: 'انتظامات',
                                        meetings: 'جلسات تولید',
                                        purchase: 'درخواست خرید',
                                        chat: 'گفتگو',
                                        knowledge: 'اطلاعات و یادداشت ها',
                                        trade: 'بازرگانی',
                                        balances: 'مانده حساب مشتریان',
                                        products: 'کالاها',
                                        sales: 'مشتریان',
                                        tickets: 'تیکت‌ها',
                                        users: 'کاربران',
                                        ccti: 'تبدیل CCTI',
                                        sayan: 'گزارشات سایان',
                                        settings: 'تنظیمات'
                                    }[itemId] || itemId;

                                    return (
                                        <div key={itemId} className="flex items-center justify-between bg-white p-1.5 rounded-lg border border-gray-100 shadow-sm">
                                            <span className="text-[10px] font-bold text-gray-700 truncate">{navLabel}</span>
                                            <div className="flex gap-1">
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            const defaultOrder = DEFAULT_MOBILE_NAV_ORDER;
                                                            const currentOrder = profileForm.mobileNavOrder?.length ? profileForm.mobileNavOrder : defaultOrder;
                                                            const order = [...currentOrder];
                                                            if (idx > 0) {
                                                                const temp = order[idx];
                                                                order[idx] = order[idx-1];
                                                                order[idx-1] = temp;
                                                                setProfileForm({...profileForm, mobileNavOrder: order});
                                                            }
                                                        }}
                                                        className="p-1 hover:bg-gray-100 rounded text-gray-500"
                                                        disabled={idx === 0}
                                                    >
                                                        <RefreshCw size={12} className="rotate-90"/>
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            const defaultOrder = DEFAULT_MOBILE_NAV_ORDER;
                                                            const currentOrder = profileForm.mobileNavOrder?.length ? profileForm.mobileNavOrder : defaultOrder;
                                                            const order = [...currentOrder];
                                                            if (idx < order.length - 1) {
                                                                const temp = order[idx];
                                                                order[idx] = order[idx+1];
                                                                order[idx+1] = temp;
                                                                setProfileForm({...profileForm, mobileNavOrder: order});
                                                            }
                                                        }}
                                                        className="p-1 hover:bg-gray-100 rounded text-gray-500"
                                                        disabled={idx === (profileForm.mobileNavOrder?.length || 19) - 1}
                                                    >
                                                        <RefreshCw size={12} className="-rotate-90"/>
                                                    </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 pt-2">
                            <input 
                                type="checkbox" 
                                id="receiveNotifications" 
                                checked={profileForm.receiveNotifications} 
                                onChange={e => setProfileForm({...profileForm, receiveNotifications: e.target.checked})} 
                                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <label htmlFor="receiveNotifications" className="text-xs font-bold text-gray-700 select-none">دریافت نوتیفیکیشن‌های سیستم</label>
                        </div>
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 mt-4 shadow-md">
                            <Save size={14}/> ذخیره اطلاعات پروفایل
                        </button>
                    </form>
                </div>
            </div>
        </div>
      )}
      {/* Desktop Sidebar Container - Layout slot stays fixed unless pinned */}
      <div 
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
          className={`hidden md:block flex-shrink-0 relative transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)] my-4 mr-4 ml-2 z-[70] ${
              isSidebarPinned ? 'w-64' : 'w-20'
          }`}
      >
          <aside 
              className={`flex flex-col no-print h-[calc(100vh-2rem)] rounded-[24px] text-zinc-900 dark:text-zinc-100 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
                  isSidebarPinned
                      ? 'w-64 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border border-white/50 dark:border-zinc-800/40 shadow-[0_8px_30px_rgba(0,0,0,0.03)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.25)]'
                      : isSidebarHovered
                          ? 'absolute top-0 right-0 w-64 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border border-blue-500/25 dark:border-blue-400/25 ring-1 ring-blue-500/15 dark:ring-blue-400/15 shadow-[0_20px_50px_rgba(0,0,0,0.14),0_10px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_25px_65px_rgba(0,0,0,0.7)] z-[80]'
                          : 'w-20 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl border border-white/40 dark:border-zinc-900/30 shadow-[0_8px_24px_rgba(0,0,0,0.02)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.2)]'
              }`}
          >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <div className={`flex items-center gap-2.5 overflow-hidden transition-all duration-200 ${!isSidebarOpen ? 'hidden w-0 opacity-0' : 'flex-1 min-w-0 opacity-100'}`}>
                      <div className="bg-blue-600 p-2 rounded-xl text-white shadow-sm shrink-0"><Sparkles className="w-4 h-4" /></div>
                      <div className="whitespace-nowrap overflow-hidden">
                          <h1 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white truncate">{settings?.appName || 'سیستم مالی'}</h1>
                          <span className="text-[10px] text-zinc-400 font-bold block truncate">سیستم مدیریت مالی و اداری</span>
                      </div>
                  </div>
                  
                  <div className={`flex items-center gap-1.5 shrink-0 ${!isSidebarOpen ? 'mx-auto' : ''}`}>
                      {/* Pin Button */}
                      {isSidebarOpen && (
                          <button 
                              type="button"
                              onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSidebarPin();
                              }} 
                              className={`p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center ${
                                  isSidebarPinned 
                                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30' 
                                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                              }`}
                              title={isSidebarPinned ? 'منو پین شده است (کلیک برای خروج از پین و بسته‌شدن خودکار با خروج موس)' : 'پین کردن منو (ثابت ماندن منو)'}
                          >
                              <Pin size={16} className={`transition-transform duration-200 ${isSidebarPinned ? 'fill-current -rotate-45' : ''}`} />
                          </button>
                      )}

                      {/* Hamburger Button */}
                      <button 
                          type="button"
                          onClick={() => {
                              if (isSidebarPinned) {
                                  setIsSidebarPinned(false);
                                  localStorage.setItem('app_sidebar_pinned', 'false');
                              } else {
                                  setIsSidebarPinned(true);
                                  localStorage.setItem('app_sidebar_pinned', 'true');
                              }
                          }} 
                          className={`p-1.5 rounded-lg transition-all duration-200 ${
                              isSidebarPinned 
                                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100' 
                                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                          }`}
                          title={isSidebarPinned ? 'خروج از حالت پین منو' : 'پین کردن منو'}
                      >
                          <Menu size={18}/>
                      </button>
                  </div>
              </div>
              
              <div className={`p-3 bg-zinc-50 dark:bg-zinc-900/30 mx-4 mt-4 rounded-xl flex items-center gap-3 border border-zinc-200/50 dark:border-zinc-800/30 relative group cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-all ${!isSidebarOpen ? 'justify-center mx-2 px-0' : ''}`} onClick={() => setShowProfileModal(true)} title="تنظیمات کاربری">
                  <div className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-800 overflow-hidden shrink-0">
                      {currentUser.avatar ? <img src={resolveImageUrl(currentUser.avatar)} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-700 dark:text-zinc-300">{currentUser.fullName.charAt(0)}</div>}
                  </div>
                  {isSidebarOpen && (
                     <div className="overflow-hidden flex-1 animate-fade-in">
                         <p className="text-xs font-bold truncate text-zinc-800 dark:text-zinc-200">{currentUser.fullName}</p>
                         <p className="text-[10px] text-zinc-400 truncate font-bold inline-flex items-center gap-1 mt-0.5"><span>نقش:</span> <span className="text-blue-600 dark:text-blue-400">{currentUser.role}</span></p>
                     </div>
                  )}
              </div>
              
              <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar relative z-10">
                  {navItems.map((item) => { 
                      const Icon = item.icon; 
                      const isActive = activeTab === item.id;
                      return (
                        <button 
                            key={item.id} 
                            onClick={() => setActiveTab(item.id)} 
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${isActive ? 'text-blue-600 dark:text-blue-400 font-bold shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white/50 dark:hover:bg-zinc-900/30'} ${!isSidebarOpen ? 'justify-center' : ''}`} 
                            title={item.label}
                        >
                            {isActive && (
                                <motion.div 
                                    layoutId="activeSidebarTab"
                                    className="absolute inset-0 bg-blue-50/70 dark:bg-blue-950/20 rounded-xl border border-blue-100/50 dark:border-blue-900/30 -z-0"
                                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                />
                            )}
                            <div className="relative z-10 flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                    <Icon size={18} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors'} />
                                    {isSidebarOpen && <span className="text-xs whitespace-nowrap animate-fade-in">{item.label}</span>}
                                </div>
                                {item.id === 'chat' && unreadChatCount > 0 && isSidebarOpen && (
                                    <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[16px] text-center font-bold shadow-sm">{unreadChatCount}</span>
                                )}
                                {item.id === 'chat' && unreadChatCount > 0 && !isSidebarOpen && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-zinc-900"></span>
                                )}
                            </div>
                        </button>
                      ); 
                  })}
                  
                  {canSeeNotifications && (
                      <div className="pt-4 mt-2 border-t border-zinc-200 dark:border-zinc-800 relative" ref={notifRef}>
                          <button onClick={() => {
                              const nextState = !showNotifDropdown;
                              setShowNotifDropdown(nextState);
                              if (nextState && markAllNotificationsAsRead) {
                                  markAllNotificationsAsRead();
                              }
                          }} className={`notification-trigger w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-xs relative ${unreadCount > 0 ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 font-bold' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'} ${!isSidebarOpen ? 'justify-center' : ''}`} title="اعلان‌ها">
                              <div className="relative">
                                  <Bell size={18} className={unreadCount > 0 ? 'text-blue-600' : 'text-zinc-400'} />
                                  {unreadCount > 0 && (<span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white">{unreadCount}</span>)}
                              </div>
                              {isSidebarOpen && <span className="font-bold whitespace-nowrap animate-fade-in">مرکز اعلان‌ها</span>}
                          </button>
                          {showNotifDropdown && <NotificationDropdown />}
                          
                          {!notifEnabled && isSidebarOpen && (
                              <button onClick={handleToggleNotif} className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs bg-red-50 text-red-600 hover:bg-red-100 transition-all font-black border border-red-100 animate-fade-in">
                                  <BellRing size={16} />
                                  <span>فعال‌سازی نوتیفیکیشن</span>
                              </button>
                          )}
                      </div>
                  )}
              </nav>
              
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-1.5">
                  {onToggleDarkMode && (
                    <button onClick={onToggleDarkMode} className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 rounded-lg transition-colors font-bold text-xs ${!isSidebarOpen ? 'justify-center' : ''}`} title={isDarkMode ? 'حالت روشن' : 'حالت دارک'}>
                        {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-indigo-500" />}
                        {isSidebarOpen && (
                            <span className="whitespace-nowrap text-zinc-600 dark:text-zinc-300 animate-fade-in">
                                {isDarkMode ? 'حالت روشن' : 'دارک مود (شب)'}
                            </span>
                        )}
                    </button>
                  )}
                  <button onClick={toggleTheme} className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 rounded-lg transition-colors font-bold text-xs ${!isSidebarOpen ? 'justify-center' : ''}`} title="تغییر پوسته">
                      <Sparkles size={18} className="text-purple-500 animate-pulse" />
                      {isSidebarOpen && (
                          <span className="whitespace-nowrap text-zinc-600 dark:text-zinc-300 animate-fade-in">
                              {theme === 'light-aurora' ? 'پوسته شیشه‌ای' : theme === 'theme-bento' ? 'پوسته بنتو گرید' : theme === 'theme-claymorphism' ? 'پوسته سفالی ۳D' : theme === 'theme-skeuomorphism' ? 'پوسته واقع‌گرایانه' : theme === 'theme-minimalism' ? 'پوسته مینیمال' : theme === 'theme-maximalism' ? 'پوسته ماکسیمال' : 'تغییر پوسته'}
                          </span>
                      )}
                  </button>
                  <button onClick={handleLogout} className={`w-full flex items-center gap-3 px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors font-bold text-xs ${!isSidebarOpen ? 'justify-center' : ''}`} title="خروج از سیستم">
                      <LogOut size={18} />
                      {isSidebarOpen && <span className="whitespace-nowrap animate-fade-in">خروج از سیستم</span>}
                  </button>
              </div>
          </aside>
      </div>
      
      {/* Mobile Drawer - Option 2: Elegant shadcn/ui style Slide-Up Bottom Sheet */}
      <AnimatePresence>
        {showMobileMenu && (
          <div className="fixed inset-0 z-[100] md:hidden flex flex-col justify-end">
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`absolute inset-0 bg-black/60 transition-all ${theme === 'light-aurora' ? 'backdrop-blur-[16px]' : 'backdrop-blur-md'}`} 
                onClick={() => setShowMobileMenu(false)}
              />
              {/* Slide-Up Panel */}
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="relative w-full max-h-[85vh] bg-white dark:bg-zinc-950 rounded-t-3xl border-t border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden z-10"
              >
                  {/* Drag Handle */}
                  <div className="w-full py-3 flex justify-center cursor-pointer" onClick={() => setShowMobileMenu(false)}>
                      <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-800 rounded-full" />
                  </div>

                  {/* Header */}
                  <div className="px-6 pb-4 border-b border-zinc-100 dark:border-zinc-900 flex justify-between items-center bg-white dark:bg-zinc-950">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-sm text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800">
                              {currentUser.fullName.charAt(0)}
                          </div>
                          <div>
                              <div className="font-bold text-zinc-900 dark:text-white text-sm">{currentUser.fullName}</div>
                              <div className="text-[10px] text-zinc-500 font-medium">{currentUser.role}</div>
                          </div>
                      </div>
                      <button onClick={() => setShowMobileMenu(false)} className="p-1.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors">
                          <X size={16} />
                      </button>
                  </div>
                  
                  {/* Notification Alert in bottom-sheet if disabled */}
                  {canSeeNotifications && !notifEnabled && (
                      <div className="px-6 mt-4">
                          <div className="bg-red-50/80 border border-red-100 dark:bg-red-950/20 dark:border-red-950 p-3 rounded-xl flex items-center justify-between shadow-sm">
                              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold">
                                  <Bell size={16} />
                                  <span>اعلان‌ها غیرفعال است</span>
                              </div>
                              <button onClick={handleToggleNotif} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md hover:bg-red-700">
                                  فعال‌سازی
                              </button>
                          </div>
                      </div>
                  )}

                  {/* All other menu items in a clean, high-end visual grid (shadcn/ui style card elements) */}
                  <div className="px-6 py-4 flex-1 overflow-y-auto custom-scrollbar">
                      <h4 className="text-xs font-bold text-zinc-400 mb-3 block">بخش‌های تکمیلی سیستم</h4>
                      <div className="grid grid-cols-3 gap-3">
                          {menuItems.map((item) => {
                              const Icon = item.icon;
                              const isActive = activeTab === item.id;
                              return (
                                  <button 
                                    key={item.id} 
                                    onClick={() => { setActiveTab(item.id); setShowMobileMenu(false); }}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all border relative ${
                                        isActive 
                                        ? 'bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400' 
                                        : 'bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100'
                                    }`}
                                  >
                                      <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800'}`}>
                                          <Icon size={18} strokeWidth={2} />
                                      </div>
                                      <span className="text-[10px] font-bold text-center leading-tight truncate w-full">{item.label}</span>
                                      {item.id === 'chat' && unreadChatCount > 0 && (
                                          <span className="absolute top-2 left-2 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full min-w-[14px] text-center font-bold shadow-sm">{unreadChatCount}</span>
                                      )}
                                  </button>
                              );
                          })}
                      </div>
                  </div>
                  
                  {/* Bottom sheet footer with settings and quick controls */}
                  <div className="p-6 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-900 flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => { setShowMobileMenu(false); setShowProfileModal(true); }} className="flex items-center justify-center gap-2 p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50">
                              <Settings size={14} className="text-zinc-500" /> تنظیمات پروفایل
                          </button>
                          <button onClick={() => { setShowMobileMenu(false); toggleTheme(); }} className="flex items-center justify-center gap-2 p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50">
                              <Sparkles size={14} className="text-purple-500 animate-pulse" /> تغییر پوسته UI
                          </button>
                      </div>
                      {onToggleDarkMode && (
                          <button onClick={onToggleDarkMode} className="flex items-center justify-center gap-2 p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50">
                              {isDarkMode ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-indigo-500" />}
                              <span>{isDarkMode ? 'تغییر به حالت روشن (Light)' : 'تغییر به حالت تاریک (Dark)'}</span>
                          </button>
                      )}
                      <button onClick={handleLogout} className="flex items-center justify-center gap-2 p-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/30 border border-red-100 dark:border-red-950/50 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold transition-colors">
                          <LogOut size={14}/> خروج از سیستم
                      </button>
                  </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation - Modern Apple Liquid Floating Dock */}
      <AnimatePresence>
        {isBottomBarVisible && (
          <motion.div 
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 280 }}
            className="md:hidden fixed z-[90] bottom-4 left-4 right-4 bg-white/75 dark:bg-zinc-900/75 border border-white/40 dark:border-zinc-800/30 pb-2 pt-2 rounded-[20px] flex justify-around items-center backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.4)] px-2"
          >
              {bottomVisibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                      <button 
                          key={item.id}
                          onClick={() => setActiveTab(item.id)} 
                          className={`flex flex-col items-center gap-1 transition-all duration-200 flex-1 relative py-1 ${isActive ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                      >
                          {isActive && (
                              <motion.div 
                                  layoutId="activeBottomTab"
                                  className="absolute inset-x-2 inset-y-0.5 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl -z-10 border border-blue-100/50 dark:border-blue-900/20"
                                  transition={{ type: "spring", duration: 0.4 }}
                              />
                          )}
                          <div className="relative">
                              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                              {item.id === 'chat' && unreadChatCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-zinc-950 shadow-sm animate-pulse"></span>
                              )}
                          </div>
                          <span className={`text-[9px] font-bold tracking-tight transition-all duration-200 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500'}`}>{item.label}</span>
                      </button>
                  );
              })}
              
              <button 
                  onClick={() => setShowMobileMenu(true)} 
                  className={`flex flex-col items-center gap-1 transition-all duration-200 flex-1 relative py-1 ${menuItems.some(m => m.id === activeTab) ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
              >
                  {menuItems.some(m => m.id === activeTab) && (
                      <motion.div 
                          layoutId="activeBottomTab"
                          className="absolute inset-x-2 inset-y-0.5 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl -z-10 border border-blue-100/50 dark:border-blue-900/20"
                          transition={{ type: "spring", duration: 0.4 }}
                      />
                  )}
                  <div className="relative">
                      <Menu size={18} strokeWidth={menuItems.some(m => m.id === activeTab) ? 2.5 : 2} />
                      {menuItems.some(m => m.id === 'chat' && unreadChatCount > 0) && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-zinc-950 shadow-sm animate-pulse"></span>
                      )}
                  </div>
                  <span className={`text-[9px] font-bold tracking-tight transition-all duration-200 ${menuItems.some(m => m.id === activeTab) ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500'}`}>منو</span>
              </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex flex-1 flex-col overflow-hidden relative min-w-0 min-h-0 m-0 sm:m-2.5 md:my-4 md:ml-4 md:mr-2 bg-white/45 dark:bg-zinc-950/30 backdrop-blur-xl rounded-none sm:rounded-2xl md:rounded-[24px] border-0 sm:border border-white/45 dark:border-zinc-900/35 shadow-none sm:shadow-[0_8px_32px_rgba(0,0,0,0.05)] dark:sm:shadow-[0_16px_48px_rgba(0,0,0,0.3)] md:shadow-[0_16px_40px_rgba(0,0,0,0.02)] dark:md:shadow-[0_24px_64px_rgba(0,0,0,0.2)]">
          {/* Mobile Header - Sleek flat design matching shadcn/ui */}
          <header className="px-3 py-2.5 md:hidden no-print flex items-center justify-between shrink-0 relative z-[60] safe-pt sticky top-0 bg-white/60 dark:bg-zinc-950/40 border-b border-zinc-200/30 dark:border-zinc-800/30 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                  {activeTab === 'dashboard' ? (
                  <button 
                      onClick={() => setShowMobileMenu(true)} 
                      className="flex items-center gap-3 transition-all active:scale-95"
                  >
                      <div className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm flex items-center justify-center font-bold text-xs text-zinc-700 dark:text-zinc-300">
                          {currentUser.avatar ? <img src={resolveImageUrl(currentUser.avatar)} alt="" className="w-full h-full object-cover"/> : currentUser.fullName.charAt(0)}
                      </div>
                  </button>
                  ) : (
                  <button 
                      onClick={onBack} 
                      className="flex items-center justify-center w-8 h-8 bg-zinc-100 dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200/50 dark:border-zinc-800/50 text-zinc-700 dark:text-zinc-200 active:scale-95 transition-all"
                  >
                      <ChevronRight size={18} />
                  </button>
                  )}
                  <div>
                     <h1 className="font-bold text-zinc-900 dark:text-zinc-100 text-xs tracking-tight">{navItems.find(i => i.id === activeTab)?.label || 'داشبورد'}</h1>
                  </div>
              </div>
              <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setIsSearchOpen(true)}
                    className="p-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-lg text-zinc-700 dark:text-zinc-300 shadow-sm active:scale-95"
                    title="جستجو (Ctrl+K)"
                  >
                      <Search size={16} />
                  </button>
                  {financialYear && setFinancialYear && (
                      <select 
                          value={financialYear} 
                          onChange={(e) => setFinancialYear(e.target.value)}
                          className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 text-zinc-700 dark:text-zinc-200 font-bold rounded-lg text-[10px] px-2 py-1.5 mr-1 shadow-sm focus:outline-none"
                          dir="ltr"
                      >
                          {settings?.fiscalYears?.map(fy => (
                              <option key={fy.id} value={fy.label} className="bg-white dark:bg-zinc-950">{fy.label}</option>
                          )) || <>
                              <option value="1402">1402</option>
                              <option value="1403">1403</option>
                              <option value="1404">1404</option>
                              <option value="1405">1405</option>
                          </>
                          }
                      </select>
                  )}
                  <button 
                    onClick={toggleTheme}
                    className="p-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-lg text-zinc-700 dark:text-zinc-300 shadow-sm active:scale-95"
                  >
                      {theme === 'light-aurora' ? <Sparkles size={16} className="text-purple-500 animate-pulse" /> : theme === 'light' ? <Moon size={16} /> : <Sun size={16} className="text-yellow-400" />}
                  </button>
                  {canSeeNotifications && (
                      <div className="relative notification-trigger" ref={mobileNotifRef}>
                          <button onClick={() => {
                              const nextState = !showNotifDropdown;
                              setShowNotifDropdown(nextState);
                              if (nextState && markAllNotificationsAsRead) {
                                  markAllNotificationsAsRead();
                              }
                          }} className="relative p-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors shadow-sm active:scale-95">
                              <Bell size={16} className="text-zinc-700 dark:text-zinc-200" />
                              {unreadCount > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"></span>}
                          </button>
                          {showNotifDropdown && <NotificationDropdown />}
                      </div>
                  )}
              </div>
          </header>
          
          <div className={`flex-1 ${activeTab === 'chat' ? 'flex flex-col overflow-hidden pb-0 min-h-0' : 'overflow-y-auto pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0'} bg-transparent min-w-0 custom-scrollbar`} id="main-scroll-container">
              {/* Bale-Style Top Update Banner for Web, Mobile, and PWA */}
              {isUpdateAvailable && !isUpdateDismissed && updateInfo && (
                <div className="p-2 sm:p-3 sm:pb-1 no-print animate-slide-down">
                  <UpdateBanner
                    updateInfo={updateInfo}
                    onDismiss={() => setIsUpdateDismissed(true)}
                  />
                </div>
              )}

              <div className={`${activeTab === 'chat' ? 'hidden' : 'hidden md:flex'} justify-end p-4 bg-white/20 dark:bg-zinc-950/15 border-b border-zinc-200/40 dark:border-zinc-800/40 z-40 shadow-sm no-print items-center backdrop-blur-md`}>
                  <button 
                    onClick={() => setIsSearchOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-all mr-auto ml-4 group"
                    title="جستجو (Ctrl+K)"
                  >
                      <Search size={14} className="group-hover:text-blue-500 transition-colors" />
                      <span className="text-xs font-bold">جستجو در کل سیستم...</span>
                      <span className="bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[9px] font-black">Ctrl K</span>
                  </button>
                  <span className="font-bold text-zinc-500 dark:text-zinc-400 mr-3 text-xs">سال مالی:</span>
                  {settings?.fiscalYears && (
                      <select 
                          value={settings.activeFiscalYearId || ''} 
                          onChange={async (e) => {
                              const newYearId = e.target.value;
                              const newSettings = { ...settings, activeFiscalYearId: newYearId };
                              await saveSettings(newSettings);
                              window.location.reload(); 
                          }}
                          className="bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900 outline-none rounded-lg px-3 py-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer text-xs"
                          dir="ltr"
                      >
                          {settings.fiscalYears.map(fy => (
                              <option key={fy.id} value={fy.id}>{fy.label} سال مالی</option>
                          ))}
                      </select>
                  )}
              </div>
              <div className={`${activeTab === 'chat' ? 'p-0 w-full flex-1 flex flex-col min-h-0' : 'p-2 md:p-4 w-full min-h-full'} mx-auto min-w-0`}>
                  {children}
              </div>
          </div>
      </main>

      <AnimatePresence>
        {isSearchOpen && (
            <SearchModal 
                isOpen={isSearchOpen} 
                onClose={() => setIsSearchOpen(false)} 
                onNavigate={(tab) => {
                    setActiveTab(tab);
                    setIsSearchOpen(false);
                }} 
            />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Layout;
