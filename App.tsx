
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CreateOrder from './components/CreateOrder';
import ManageOrders from './components/ManageOrders';
import Login from './components/Login';
import ManageUsers from './components/ManageUsers';
import Settings from './components/Settings';
import ChatRoom from './components/ChatRoom';
import TradeModule from './components/TradeModule';
import CreateExitPermit from './components/CreateExitPermit'; 
import ManageExitPermits from './components/ManageExitPermits'; 
import WarehouseModule from './components/WarehouseModule';
import SecurityModule from './components/SecurityModule'; 
import MeetingModule from './components/MeetingModule';
import PurchaseModule from './components/PurchaseModule';
import PrintVoucher from './components/PrintVoucher';
import NotificationController from './components/NotificationController'; 
import SalesCRMModule from './components/SalesCRMModule';
import ProductsModule from './components/ProductsModule';
import { Tickets } from './components/Tickets';
import KnowledgeBaseModule from './components/KnowledgeBaseModule';
import { CustomerBalanceModule } from './components/CustomerBalanceModule';
import CctiConverter from './components/CctiConverter';
import AccountingReports from './components/AccountingReports';
import SecretariatModule from './components/SecretariatModule';
import { ChequeReceiptModule } from './components/ChequeReceiptModule';
import { getOrders, getSettings, getMessages, saveSettings, getSystemAnnouncements } from './services/storageService'; 
import { getCurrentUser, getUsers, getRolePermissions, logout as authLogout } from './services/authService';
import { PaymentOrder, User, OrderStatus, UserRole, AppNotification, SystemSettings, PaymentMethod, ChatMessage, SystemAnnouncement } from './types';
import { Loader2, Bell, X, MessageSquare, AlertTriangle, FileWarning, CreditCard, BellRing } from 'lucide-react';
import { generateUUID, parsePersianDate, formatCurrency } from './constants';
import { apiCall, getLocalData, LS_KEYS, getServerHost } from './services/apiService'; 
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { App as CapacitorApp } from '@capacitor/app'; 
import { PushNotifications } from '@capacitor/push-notifications'; 
import { LocalNotifications } from '@capacitor/local-notifications'; 
import { sendNotification, hasNotificationBeenShown, markNotificationAsShown, syncNativeShownNotifications, syncServiceWorkerShownNotifications, clearAllActiveNotifications, setupNativePushNotifications } from './services/notificationService';
import { motion, AnimatePresence } from 'motion/react';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SystemSettings | undefined>(undefined);
  const [activeTab, setActiveTabState] = useState('dashboard');
  const [tabHistory, setTabHistory] = useState<string[]>(['dashboard']);
  const [directChatTarget, setDirectChatTarget] = useState<{ type: 'private' | 'group' | 'public' | 'task_group', id: string, taskId?: string } | null>(null);

  const activeTabRef = useRef(activeTab);
  const tabHistoryRef = useRef(tabHistory);
  const customBackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const registerBack = (e: any) => { customBackRef.current = e.detail; };
    const unregisterBack = () => { customBackRef.current = null; };
    window.addEventListener('REGISTER_BACK_ACTION', registerBack);
    window.addEventListener('UNREGISTER_BACK_ACTION', unregisterBack);
    return () => {
        window.removeEventListener('REGISTER_BACK_ACTION', registerBack);
        window.removeEventListener('UNREGISTER_BACK_ACTION', unregisterBack);
    }
  }, []);

  useEffect(() => {
      activeTabRef.current = activeTab;
      tabHistoryRef.current = tabHistory;
  }, [activeTab, tabHistory]);

  const setActiveTab = (tab: string, addToHistory = true) => {
      if (tab === activeTabRef.current) return;
      
      // Clear custom back ref when changing tab to avoid leaks
      customBackRef.current = null;
      
      setActiveTabState(tab);
      if (addToHistory) {
          setTabHistory(prev => {
              if (prev[prev.length - 1] === tab) return prev;
              return [...prev.slice(-14), tab]; // Keep last 15
          });
          
          // Browser history support
          const hash = `#${tab}`;
          if (window.location.hash !== hash) {
              try {
                  window.history.pushState({ tab }, '', hash);
              } catch (e) {
                  window.location.hash = hash;
              }
          }
      }
  };

  const goBack = (isPopState: boolean = false) => {
      // 1. Registered custom handler
      if (customBackRef.current) {
          customBackRef.current();
          return true;
      }
      
      // 2. Modals check
      const activeModals = Array.from(
          document.querySelectorAll('.fixed.inset-0:not(.pointer-events-none):not(.invisible):not(.opacity-0), [role="dialog"], .notification-dropdown-container, .glass-panel.fixed:not(.pointer-events-none):not(.bottom-nav-bar), .modal-active')
      ).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && !el.classList.contains('pointer-events-none');
      });

      if (activeModals.length > 0) {
          const lastModal = activeModals[activeModals.length - 1];
          const closeBtn = lastModal.querySelector('button[onClick], .modal-close-btn, [aria-label="بستن"], [data-close-modal="true"], [data-close-announcement="true"]') as HTMLElement;
          if (closeBtn) {
              closeBtn.click();
          } else {
              // Brute force click the first button that looks like a close/cancel
              const fallbackBtn = Array.from(lastModal.querySelectorAll('button')).find(btn => {
                  const txt = (btn.textContent || '').trim();
                  const hasCloseIcon = btn.querySelector('.lucide-x, .lucide-x-circle, .lucide-chevron-right, .lucide-arrow-right');
                  const hasRedText = btn.className.includes('red');
                  return txt.includes('بستن') || txt.includes('انصراف') || txt.includes('✕') || hasCloseIcon || hasRedText;
              }) as HTMLElement;
              
              if (fallbackBtn) {
                  fallbackBtn.click();
              } else {
                   window.dispatchEvent(new CustomEvent('CLOSE_ACTIVE_MODALS'));
              }
          }
          return true;
      }

      // 3. Tab history back
      if (tabHistoryRef.current.length > 1) {
          setTabHistory(prev => {
              const newHist = [...prev];
              newHist.pop();
              const prevTab = newHist[newHist.length - 1];
              setActiveTabState(prevTab);
              safeReplaceState({ tab: prevTab }, '', `#${prevTab}`);
              return newHist;
          });
          return true;
      }

      // 4. Force back to dashboard if not at dashboard
      if (activeTabRef.current !== 'dashboard') {
          setActiveTab('dashboard', false);
          // Force ref update for tab state in case rendering is slow
          activeTabRef.current = 'dashboard';
          return true;
      }

      return false; // Let native behavior handle exit
  };

  const safePushState = (state: any, title: string, url: string) => {
    try { window.history.pushState(state, title, url); } catch (e) { window.location.hash = url; }
  };
  
  const safeReplaceState = (state: any, title: string, url: string) => {
    try { window.history.replaceState(state, title, url); } catch (e) { window.location.hash = url; }
  };
  const [financialYear, setFinancialYearState] = useState<string>(new Date().toLocaleDateString('fa-IR-u-nu-latn').split('/')[0]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setTheme('dark');
        document.documentElement.classList.add('dark');
    } else {
        setTheme('light');
        document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
      const newTheme = theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
      localStorage.setItem('theme', newTheme);
      if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  };
  const [orders, setOrders] = useState<PaymentOrder[]>(() => {
    try { const item = localStorage.getItem('app_data_orders'); return item ? JSON.parse(item) : []; } catch { return []; }
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try { const item = localStorage.getItem('app_data_chat'); return item ? JSON.parse(item) : []; } catch { return []; }
  }); 
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const notificationsRef = useRef<AppNotification[]>([]);
  const sessionStartTimeRef = useRef(Date.now());
  const [manageOrdersInitialTab, setManageOrdersInitialTab] = useState<'current' | 'archive'>('current');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<any>(null); 
  const [exitPermitStatusFilter, setExitPermitStatusFilter] = useState<'pending' | null>(null);

  const [toast, setToast] = useState<{show: boolean, title: string, message: string} | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const [backgroundJobs, setBackgroundJobs] = useState<{order: PaymentOrder, type: 'create' | 'approve'}[]>([]);
  const [sharedData, setSharedData] = useState<{ fileUrl?: string; text?: string; title?: string } | null>(null);
  const processingJobRef = useRef(false);

  const isSyncingRef = useRef(false);
  const isFirstLoad = useRef(true);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const IDLE_LIMIT = 60 * 60 * 1000; 
  const NOTIFICATION_CHECK_KEY = 'last_notification_check';
  
  const lastChatMsgIdRef = useRef<string | null>(null);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative) {
        let backListener: any;
        try {
            CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                const handled = goBack();
                if (!handled && !canGoBack && activeTabRef.current === 'dashboard') {
                    CapacitorApp.exitApp();
                }
            }).then(l => { backListener = l; });
        } catch(e) { console.error("Back button listener error", e); }
        
        try {
            const mapNotificationUrlToTab = (url: string | undefined): string | null => {
                if (!url) return null;
                const path = url.replace('#', '').trim().toLowerCase();
                
                if (path.includes('chat')) return 'chat';
                if (path.includes('payment-approvals') || path.includes('payment-orders') || path.includes('manage')) return 'manage';
                if (path.includes('exit-permits') || path.includes('exit-approvals') || path.includes('exit') || path.includes('manage-exit')) return 'manage-exit';
                if (path.includes('security-panel') || path.includes('security')) return 'security';
                if (path.includes('warehouse')) return 'warehouse';
                if (path.includes('balances')) return 'balances';
                if (path.includes('purchase')) return 'purchase';
                if (path.includes('meetings')) return 'meetings';
                if (path.includes('invoices') || path.includes('manage-invoices')) return 'manage-invoices';
                
                const cleaned = path.replace(/^\//, ''); // remove leading slash
                const validTabs = ['dashboard', 'create', 'manage', 'chat', 'trade', 'users', 'settings', 'create-exit', 'manage-exit', 'manage-invoices', 'warehouse', 'security', 'purchase', 'balances', 'meetings', 'knowledge', 'ccti', 'sayan'];
                if (validTabs.includes(cleaned)) {
                    return cleaned;
                }
                return null;
            };

            const mapNotificationToChatTarget = (urlStr: string | undefined) => {
                if (!urlStr) return null;
                try {
                    const searchPart = urlStr.includes('?') ? urlStr.substring(urlStr.indexOf('?')) : '';
                    const params = new URLSearchParams(searchPart);
                    const pv = params.get('pv');
                    const group = params.get('group');
                    if (pv) return { type: 'private' as const, id: pv };
                    if (group) return { type: 'group' as const, id: group };
                } catch (e) {}
                return null;
            };

            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                const data = notification.notification.data;
                console.log("Push Action Data:", data);
                if (data && data.url) {
                    const mappedTab = mapNotificationUrlToTab(data.url);
                    if (mappedTab) setActiveTab(mappedTab);
                    
                    const chatTarget = mapNotificationToChatTarget(data.url);
                    if (chatTarget) setDirectChatTarget(chatTarget);
                    
                    if (data.url.includes('?')) {
                        const searchStr = data.url.substring(data.url.indexOf('?'));
                        if (searchStr.length > 1) window.history.pushState({}, '', window.location.pathname + searchStr);
                    }
                }
            });

            LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
                const data = action.notification.extra;
                console.log("Local action data:", data);
                if (data && data.url) {
                    const mappedTab = mapNotificationUrlToTab(data.url);
                    if (mappedTab) setActiveTab(mappedTab);
                    
                    const chatTarget = mapNotificationToChatTarget(data.url);
                    if (chatTarget) setDirectChatTarget(chatTarget);
                    
                    if (data.url.includes('?')) {
                        const searchStr = data.url.substring(data.url.indexOf('?'));
                        if (searchStr.length > 1) window.history.pushState({}, '', window.location.pathname + searchStr);
                    }
                }
            });
        } catch(e) { console.error("Notification Listener Error", e); }

        // --- ANDROID INTENT SUPPORT (Simplified) & SHARE TARGET plugin ---
        try {
            CapacitorApp.addListener('appRestoredResult', (data: any) => {
                if (data.pluginId === 'Share' || data.pluginId === 'App' || !data.pluginId) {
                    const result = data.data;
                    if (result && (result.url || result.text || result.uri)) {
                         setSharedData({ fileUrl: result.url || result.uri, text: result.text, title: result.title });
                         setTimeout(() => setActiveTab('chat'), 500);
                    }
                }
            });
            
            // Also try to catch it in appUrlOpen
            CapacitorApp.addListener('appUrlOpen', (data: any) => {
                if (data.url && (data.url.includes('sharedFileUrl') || data.url.includes('sharedText'))) {
                    // This case is already handled by the other useEffect but let's be sure
                    setTimeout(() => setActiveTab('chat'), 500);
                }
            });

            // Register @capgo/capacitor-share-target listener
            const initShareTarget = async () => {
                try {
                    const { CapacitorShareTarget } = await import('@capgo/capacitor-share-target');
                    CapacitorShareTarget.addListener('shareReceived', (event: any) => {
                        console.log("CapacitorShareTarget shareReceived event:", event);
                        if (event) {
                            const text = event.text || (event.texts && event.texts.length > 0 ? event.texts[0] : undefined);
                            const fileUrl = event.files && event.files.length > 0 ? (event.files[0].uri || event.files[0].url || event.files[0].path) : undefined;
                            const title = event.title || undefined;
                            
                            if (text || fileUrl) {
                                setSharedData({ fileUrl, text, title });
                                setTimeout(() => setActiveTab('chat'), 500);
                            }
                        }
                    });
                } catch (err) {
                    console.error("Failed to load optional CapacitorShareTarget", err);
                }
            };
            initShareTarget();
        } catch (e) { console.error("App Restored Error", e); }

        return () => {
            if (backListener) backListener.remove();
        };
    }
  }, []);

  useEffect(() => {
      const handleJob = (e: CustomEvent) => { setBackgroundJobs(prev => [...prev, e.detail]); };
      const handleGoBack = () => { goBack(); };
      window.addEventListener('QUEUE_WHATSAPP_JOB' as any, handleJob);
      window.addEventListener('GO_BACK', handleGoBack);
      return () => {
          window.removeEventListener('QUEUE_WHATSAPP_JOB' as any, handleJob);
          window.removeEventListener('GO_BACK', handleGoBack);
      };
  }, []);

  useEffect(() => { if (backgroundJobs.length > 0 && !processingJobRef.current) { processNextJob(); } }, [backgroundJobs]);

  const processNextJob = async () => {
      processingJobRef.current = true;
      const job = backgroundJobs[0];
      const { order, type } = job;
      await new Promise(resolve => setTimeout(resolve, 1500));
      const element = document.getElementById(`bg-print-voucher-${order.id}`);
      if (element) {
          try {
              // @ts-ignore
              const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
              const base64 = canvas.toDataURL('image/png').split(',')[1];
              const usersList = await getUsers();
              let targetUser: User | undefined;
              let caption = '';
              const mode = settings?.botPaymentNotificationMode || 'step_by_step';
              
              if (type === 'create') {
                  targetUser = usersList.find(u => u.role === UserRole.FINANCIAL && u.phoneNumber);
                  caption = `📢 *درخواست پرداخت جدید*\nشماره: ${order.trackingNumber}\nمبلغ: ${formatCurrency(order.totalAmount)}\nدرخواست کننده: ${order.requester}\n\nلطفا بررسی نمایید.`;
              } else if (type === 'approve') {
                  const isFinal = order.status === OrderStatus.APPROVED_CEO || order.status === OrderStatus.PAID;
                  
                  if (mode === 'after_submit') {
                      processingJobRef.current = false;
                      setBackgroundJobs(prev => prev.slice(1));
                      return;
                  }
                  if (mode === 'after_final' && !isFinal) {
                      processingJobRef.current = false;
                      setBackgroundJobs(prev => prev.slice(1));
                      return;
                  }

                  if (order.status === OrderStatus.APPROVED_FINANCE) { targetUser = usersList.find(u => u.role === UserRole.MANAGER && u.phoneNumber); caption = `✅ *تایید مالی انجام شد*\nشماره: ${order.trackingNumber}\nمنتظر تایید مدیریت.`; }
                  else if (order.status === OrderStatus.APPROVED_MANAGER) { targetUser = usersList.find(u => u.role === UserRole.CEO && u.phoneNumber); caption = `✅ *تایید مدیریت انجام شد*\nشماره: ${order.trackingNumber}\nمنتظر تایید نهایی مدیرعامل.`; }
                  else if (order.status === OrderStatus.APPROVED_CEO) { targetUser = usersList.find(u => u.role === UserRole.FINANCIAL && u.phoneNumber); caption = `💰 *دستور پرداخت تایید نهایی شد*\nشماره: ${order.trackingNumber}\nلطفا پرداخت نمایید.`; }
              }
              if (targetUser && targetUser.phoneNumber) {
                  await apiCall('/send-whatsapp', 'POST', { number: targetUser.phoneNumber, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Order_${order.trackingNumber}.png` } });
              }
          } catch (e) { console.error("Background Job Failed", e); }
      }
      setBackgroundJobs(prev => prev.slice(1));
      processingJobRef.current = false;
  };

  useEffect(() => {
    if (isNative) return; 
    
    // Ensure we have a base history entry
    if (window.history.length <= 1) {
        safeReplaceState({ tab: 'dashboard' }, '', '#dashboard');
        // Push once so we can "pop" to dashboard without leaving
        safePushState({ tab: 'dashboard', root: true }, '', '#dashboard');
    }

    const hash = window.location.hash.replace('#', '');
    const path = window.location.pathname.replace(/^\/+/, '');
    const defaultTab = hash || path || 'dashboard';

    if (['dashboard', 'create', 'manage', 'chat', 'trade', 'users', 'settings', 'create-exit', 'manage-exit', 'manage-invoices', 'warehouse', 'security', 'purchase', 'balances', 'ccti', 'sayan', 'cheque-receipts'].includes(defaultTab)) {
        setActiveTabState(defaultTab); 
        safeReplaceState({ tab: defaultTab }, '', `#${defaultTab}`);
    } else { 
        safeReplaceState({ tab: 'dashboard' }, '', '#dashboard'); 
    }

    const handlePopState = (event: PopStateEvent) => {
        const handled = goBack(true);
        if (!handled && event.state?.tab) {
            setActiveTab(event.state.tab, false);
        }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleUrlOpen = (data: any) => {
        try {
            const url = new URL(data.url);
            const params = new URLSearchParams(url.search);
            const sUrl = params.get('sharedFileUrl');
            const sText = params.get('sharedText');
            if (sUrl || sText) {
                setSharedData({ fileUrl: sUrl || undefined, text: sText || undefined });
                setActiveTab('chat');
            }
            
            // Extract chat direct targeting on deep link opening
            const pv = params.get('pv');
            const group = params.get('group');
            if (pv || group) {
                setDirectChatTarget({
                    type: pv ? 'private' : 'group',
                    id: pv || group || ''
                });
                setActiveTab('chat');
            }
        } catch (e) {}
    };

    if (isNative) {
        CapacitorApp.addListener('appUrlOpen', handleUrlOpen);
    }

    const handleServiceWorkerMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'NAVIGATE') {
            try {
                const url = new URL(event.data.url);
                let path = url.pathname.replace(/^\/+/, '');
                if (!path) path = url.hash.replace(/^#\/?/, '');
                
                // Extract search params
                const params = new URLSearchParams(url.search);
                const pv = params.get('pv');
                const group = params.get('group');
                
                if (pv || group) {
                    setDirectChatTarget({
                        type: pv ? 'private' : 'group',
                        id: pv || group || ''
                    });
                }

                const validTabs = ['dashboard', 'create', 'manage', 'chat', 'trade', 'users', 'settings', 'create-exit', 'manage-exit', 'manage-invoices', 'warehouse', 'security', 'purchase', 'balances', 'meetings', 'knowledge', 'ccti', 'sayan', 'cheque-receipts'];
                if (validTabs.includes(path) || path === '') {
                    setActiveTab(path || 'dashboard');
                    if (url.search) {
                       window.history.pushState({}, '', url.href);
                    }
                }
            } catch(e) {}
        }
    };
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    const params = new URLSearchParams(window.location.search);
    const sharedFileUrl = params.get('sharedFileUrl');
    const sharedText = params.get('sharedText');
    const sharedTitle = params.get('sharedTitle');
    
    const pv = params.get('pv');
    const group = params.get('group');

    if (pv || group) {
        setDirectChatTarget({
            type: pv ? 'private' : 'group',
            id: pv || group || ''
        });
        setActiveTab('chat');
        try {
            const urlWithoutParams = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
            window.history.replaceState({ path: urlWithoutParams }, '', urlWithoutParams);
        } catch (e) {}
    } else if (sharedFileUrl || sharedText || sharedTitle) {
      setSharedData({
        fileUrl: sharedFileUrl || undefined,
        text: sharedText || undefined,
        title: sharedTitle || undefined,
      });
      // Switch to the chat tab
      setActiveTab('chat');
      
      // Clean up URL query parameters so refresh doesn't trigger again
      try {
        const urlWithoutParams = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
        window.history.replaceState({ path: urlWithoutParams }, '', urlWithoutParams);
      } catch (e) {
        console.error("Failed to clean query parameters", e);
      }
    }
  }, []);

  useEffect(() => { 
    const user = getCurrentUser(); 
    if (user) {
        setCurrentUser(user); 
    }
    syncNativeShownNotifications().catch(console.error);
    syncServiceWorkerShownNotifications().catch(console.error);
  }, []);

  useEffect(() => {
    const handleTabChange = (e: any) => {
        if (e.detail) setActiveTab(e.detail);
    };
    const handleOpenNotes = () => setActiveTab('notes');
    window.addEventListener('CHANGE_TAB' as any, handleTabChange);
    window.addEventListener('OPEN_NOTES_TAB' as any, handleOpenNotes);
    return () => {
        window.removeEventListener('CHANGE_TAB' as any, handleTabChange);
        window.removeEventListener('OPEN_NOTES_TAB' as any, handleOpenNotes);
    };
  }, []);

  const handleLogout = async () => { 
      const endpoint = localStorage.getItem('push_endpoint');
      const user = currentUser;
      
      // SYNCHRONOUS FIRST: Clear local session records immediately to prevent any auto-login or state leaks
      authLogout(); // Securely delete actual localStorage session user record
      localStorage.removeItem('push_endpoint');
      setCurrentUser(null); 
      isFirstLoad.current = true; 
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current); 

      // FIRE AND FORGET: Execute unsubscription in the background
      if (endpoint || user?.username) {
          apiCall('/unsubscribe', 'POST', { 
              endpoint: endpoint || undefined,
              username: user?.username || undefined
          }).catch(e => {
              console.error("Unregister push token failed on logout", e);
          });
      }
  };

  useEffect(() => {
    if (settings) {
        // Meta Updates
        if (settings.appName) {
            document.title = settings.appName;
            const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
            if (appleTitle) appleTitle.setAttribute('content', settings.appName);
        }

        const iconUrl = settings.pwaIcon || "https://cdn-icons-png.flaticon.com/512/3135/3135706.png";

        // Favicon update
        let favicon = document.querySelector('link[rel="icon"]');
        if (!favicon) {
            favicon = document.createElement('link');
            // @ts-ignore
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }
        favicon.setAttribute('href', iconUrl);

        // Apple Touch Icon
        let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
        if (!appleIcon) {
            appleIcon = document.createElement('link');
            // @ts-ignore
            appleIcon.rel = 'apple-touch-icon';
            document.head.appendChild(appleIcon);
        }
        appleIcon.setAttribute('href', iconUrl);

        // Manifest - Use the server-side generated route
        let manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink) {
            manifestLink = document.createElement('link');
            // @ts-ignore
            manifestLink.rel = 'manifest';
            document.head.appendChild(manifestLink);
        }
        // Force refresh manifest if icon changes by adding dynamic version
        const iconHash = iconUrl.substring(iconUrl.length - 10);
        manifestLink.setAttribute('href', `/manifest.json?v=${iconHash}`);
    }
  }, [settings]);

  useEffect(() => {
    if (currentUser && !isNative) {
        const resetIdleTimer = () => {
            if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
            idleTimeoutRef.current = setTimeout(() => { handleLogout(); alert("به دلیل عدم فعالیت به مدت ۱ ساعت، از سیستم خارج شدید."); }, IDLE_LIMIT);
        };
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach(event => window.addEventListener(event, resetIdleTimer));
        resetIdleTimer();
        return () => { events.forEach(event => window.removeEventListener(event, resetIdleTimer)); if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current); };
    }
  }, [currentUser]);

  const playNotificationSound = () => { 
      try { 
          // Offline-safe beep sound (Base64)
          const beep = "data:audio/wav;base64,UklGRl9vT1dAVEfmt"; 
          const audio = new Audio(beep); 
          audio.volume = 1.0; 
          audio.play().catch(e => console.log("Audio blocked")); 
      } catch (e) { } 
  };

  const showToast = (title: string, message: string) => {
      playNotificationSound();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({ show: true, title, message });
      toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  };

  const addAppNotification = (title: string, message: string, url?: string) => { 
      // Only for local non-db alerts (like cheque alerts), though they will be 
      // overwritten if setNotifications is called. The toast is more important.
      showToast(title, message);
      sendNotification(title, message, url ? { url } : null);
  };

  const removeNotification = (id: string) => { 
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      notificationsRef.current = notificationsRef.current.map(n => n.id === id ? { ...n, read: true } : n);
      if (currentUser) apiCall('/notifications/read', 'POST', { username: currentUser.username, id }).catch(console.error);
  };

  const deleteNotification = (id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
      notificationsRef.current = notificationsRef.current.filter(n => n.id !== id);
      if (currentUser) apiCall('/notifications/delete', 'POST', { username: currentUser.username, id }).catch(console.error);
  };
  const closeToast = () => { setToast(null); if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); };

  const setFinancialYear = async (yearLabel: string) => {
      setFinancialYearState(yearLabel);
      if (settings && settings.fiscalYears) {
          const year = settings.fiscalYears.find(y => y.label === yearLabel);
          if (year && year.id !== settings.activeFiscalYearId) {
              const updated = { ...settings, activeFiscalYearId: year.id };
              await saveSettings(updated);
              setSettings(updated);
          }
      }
  };

  const loadData = async (silent = false) => {
    if (!currentUser || isSyncingRef.current) return;
    isSyncingRef.current = true;

    // Deduplicate background push shown alerts dynamically
    try {
        await Promise.all([
            syncNativeShownNotifications().catch(() => {}),
            syncServiceWorkerShownNotifications().catch(() => {})
        ]);
    } catch (e) {
        console.warn("Deduplication sync failed", e);
    }
    
    if (!silent && isFirstLoad.current) {
        const cachedOrders = getLocalData<PaymentOrder[]>(LS_KEYS.ORDERS, []);
        const cachedSettings = getLocalData<SystemSettings>(LS_KEYS.SETTINGS, { currentTrackingNumber: 1000 } as any);
        const cachedMessages = getLocalData<ChatMessage[]>(LS_KEYS.CHAT, []); 
        
        if (cachedOrders.length > 0) setOrders(cachedOrders);
        if (cachedSettings) {
            setSettings(cachedSettings);
            if (cachedSettings.activeFiscalYearId && cachedSettings.fiscalYears) {
                const activeYear = cachedSettings.fiscalYears.find(y => y.id === cachedSettings.activeFiscalYearId);
                if (activeYear) setFinancialYearState(activeYear.label);
            }
        }
        if (cachedMessages.length > 0) {
            setChatMessages(cachedMessages);
            if (cachedMessages.length > 0) lastChatMsgIdRef.current = cachedMessages[cachedMessages.length - 1].id;
        }
    }

    if (!silent && orders.length === 0) setLoading(true);

    try {
        // --- OPTIMIZATION: LOAD SETTINGS SEPARATELY FIRST ---
        // This ensures the UI renders correctly (permissions etc.) even if heavy data lags
        getSettings().then(settingsData => {
            if (settingsData) {
                // Sanitize settings arrays just in case
                if (!Array.isArray(settingsData.companies)) settingsData.companies = [];
                if (!Array.isArray(settingsData.companyNames)) settingsData.companyNames = [];
                if (!Array.isArray(settingsData.fiscalYears)) settingsData.fiscalYears = [];
                if (!Array.isArray(settingsData.savedContacts)) settingsData.savedContacts = [];

                // Sync companyNames with companies
                const companyMap = new Map<string, any>();
                settingsData.companies.forEach((c: any) => {
                    if (c && c.name && c.name.trim()) {
                        companyMap.set(c.name.trim(), {
                            ...c,
                            name: c.name.trim(),
                            banks: Array.isArray(c.banks) ? c.banks : []
                        });
                    }
                });
                settingsData.companyNames.forEach((name: string) => {
                    if (name && name.trim() && !companyMap.has(name.trim())) {
                        companyMap.set(name.trim(), {
                            id: Math.random().toString(36).substring(2, 11),
                            name: name.trim(),
                            showInWarehouse: true,
                            banks: []
                        });
                    }
                });

                let mergedCompanies = Array.from(companyMap.values());
                // Filter out default "شرکت اصلی" if other custom companies exist and default was not modified
                if (mergedCompanies.length > 1 && mergedCompanies.some(c => c.name !== 'شرکت اصلی')) {
                    mergedCompanies = mergedCompanies.filter(c => 
                        c.name !== 'شرکت اصلی' || 
                        c.logo || 
                        c.registrationNumber || 
                        c.nationalId || 
                        c.address || 
                        c.economicCode || 
                        (c.banks && c.banks.length > 0)
                    );
                }

                if (mergedCompanies.length === 0) {
                    mergedCompanies = [{ id: 'comp_default', name: 'شرکت اصلی', showInWarehouse: true, banks: [] }];
                }

                settingsData.companies = mergedCompanies;
                settingsData.companyNames = mergedCompanies.map((c: any) => c.name);

                setSettings(settingsData);
                
                // Sync financial year state from server settings
                if (settingsData.activeFiscalYearId && settingsData.fiscalYears) {
                    const activeYear = settingsData.fiscalYears.find(y => y.id === settingsData.activeFiscalYearId);
                    if (activeYear) setFinancialYearState(activeYear.label);
                }
            }
        }).catch(err => console.error("Settings load error", err));

        // Load Heavy Data & Notifications in Parallel
        const [ordersData, messagesData, announcementsData, notifsData] = await Promise.all([
            getOrders(),
            getMessages(),
            getSystemAnnouncements(),
            apiCall<any[]>(`/notifications?username=${currentUser.username}&role=${currentUser.role}`).catch(err => {
                console.error("Notifications fetch failed", err);
                // Return mapping of cached memory notifications to maintain continuity and prevent loop triggers
                return notificationsRef.current.map(n => ({
                    id: n.id,
                    title: n.title,
                    body: n.message,
                    createdAt: n.timestamp,
                    readBy: n.read ? [currentUser!.username] : [],
                    url: n.url
                }));
            })
        ]);
        
        // --- SAFE GUARD & DEEP SANITIZATION ---
        const safeOrders = Array.isArray(ordersData) ? ordersData.map(o => ({
            ...o,
            paymentDetails: Array.isArray(o.paymentDetails) ? o.paymentDetails : [],
            attachments: Array.isArray(o.attachments) ? o.attachments : []
        })) : [];

        const safeMessages = Array.isArray(messagesData) ? messagesData : [];
        const safeAnnouncements = Array.isArray(announcementsData) ? announcementsData : [];
        
        // --- OPTIMIZATION: ONLY SET IF CHANGED ---
        const areOrdersEqual = (arr1: PaymentOrder[], arr2: PaymentOrder[]) => {
            if (arr1.length !== arr2.length) return false;
            for (let i = 0; i < arr1.length; i++) {
                if (arr1[i].id !== arr2[i].id || arr1[i].status !== arr2[i].status || arr1[i].updatedAt !== arr2[i].updatedAt) {
                    return false;
                }
            }
            return true;
        };
        const areChatEqual = (arr1: ChatMessage[], arr2: ChatMessage[]) => {
            if (arr1.length !== arr2.length) return false;
            const checkCount = Math.min(arr1.length, 15);
            for (let i = 0; i < checkCount; i++) {
                const idx1 = arr1.length - 1 - i;
                const idx2 = arr2.length - 1 - i;
                if (arr1[idx1].id !== arr2[idx2].id || arr1[idx1].timestamp !== arr2[idx2].timestamp || arr1[idx1].isEdited !== arr2[idx2].isEdited || arr1[idx1].readBy?.length !== arr2[idx2].readBy?.length) {
                    return false;
                }
            }
            return true;
        };

        setOrders(prev => areOrdersEqual(prev, safeOrders) ? prev : safeOrders);
        setChatMessages(prev => areChatEqual(prev, safeMessages) ? prev : safeMessages); 
        
        const isNotFirstSync = !isFirstLoad.current;

        // Process server notifications under ultra smart, responsive, and deduplicated rules
        if (notifsData && Array.isArray(notifsData)) {
            const mappedNotifs = notifsData.map((n: any) => ({
                id: n.id,
                title: n.title,
                message: n.body,
                timestamp: n.createdAt,
                read: n.readBy && n.readBy.includes(currentUser.username),
                url: n.url
            }));
            
            // Clean up / Mark all older notifications as shown on first load to prevent spamming alarms
            if (isFirstLoad.current) {
                mappedNotifs.forEach(n => markNotificationAsShown(n.id));
            }

            const prevIds = notificationsRef.current.map(n => n.id);
            // Filter unread notifications that have not been shown on this device yet
            const unnotifiedUnread = mappedNotifs.filter(n => {
                const isUnread = !n.read;
                const isNotShown = !hasNotificationBeenShown(n.id);
                // Alert ONLY if it is a dynamically received completely new notification during active polling session
                const isDynamicNew = !isFirstLoad.current && prevIds.length > 0 && !prevIds.includes(n.id);
                
                return isUnread && isNotShown && isDynamicNew;
            });
            
            if (unnotifiedUnread.length > 0) {
                const chronNotifs = [...unnotifiedUnread].sort((a, b) => a.timestamp - b.timestamp);
                
                // Show maximum of 3 notifications elements to prevent UI alarms spam
                const alertsToShow = chronNotifs.slice(-3);
                
                alertsToShow.forEach((latest, index) => {
                    // Do not play sounds or toast if the user is actively inside the corresponding view AND app is focused
                    let isLookingAtSection = false;
                    if (latest.url) {
                        const path = latest.url.replace(/^\//, '').trim();
                        const cleanPath = path.split('?')[0];
                        if (cleanPath === 'chat' && activeTabRef.current === 'chat' && document.visibilityState === 'visible') {
                            isLookingAtSection = true;
                        }
                    }
                    
                    if (!isLookingAtSection) {
                        if (index === 0) {
                            playNotificationSound();
                        }
                        
                        setToast({ show: true, title: latest.title, message: latest.message });
                        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                        toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
                        
                        // Fire native/web push notification alert
                        sendNotification(latest.title, latest.message, { id: latest.id, url: latest.url });
                    }
                });
                
                // Ensure marked as shown locally so they stay completely silent going forward
                unnotifiedUnread.forEach(n => markNotificationAsShown(n.id));
            }
            
            notificationsRef.current = mappedNotifs;
            setNotifications(mappedNotifs);
        }

        if (safeMessages && safeMessages.length > 0) {
            const lastMsg = safeMessages[safeMessages.length - 1];
            lastChatMsgIdRef.current = lastMsg.id;
        }

        if (isFirstLoad.current) { checkChequeAlerts(safeOrders); }
        
        localStorage.setItem(NOTIFICATION_CHECK_KEY, Date.now().toString());
        isFirstLoad.current = false;
    } catch (error) { 
        console.error("Failed to load data", error); 
    } finally { 
        if (!silent) setLoading(false); 
        isSyncingRef.current = false;
        isFirstLoad.current = false;
    }
  };

  const checkChequeAlerts = (list: PaymentOrder[]) => {
      const now = new Date();
      let alertCount = 0;
      list.forEach(order => {
          if (order.paymentDetails && Array.isArray(order.paymentDetails)) {
              order.paymentDetails.forEach(detail => {
                  if (detail.method === PaymentMethod.CHEQUE && detail.chequeDate) {
                      const dueDate = parsePersianDate(detail.chequeDate);
                      if (dueDate) {
                          const diffTime = dueDate.getTime() - now.getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          if (diffDays <= 2 && diffDays >= 0) { alertCount++; }
                      }
                  }
              });
          }
      });
      if (alertCount > 0) { addAppNotification('هشدار سررسید چک', `${alertCount} چک در ۲ روز آینده سررسید می‌شوند.`); }
  };

  useEffect(() => {
      const triggerReload = () => {
          if (currentUser) {
              console.log("Forcing data synchronizer on focus/online/visibilitychange");
              loadData(true);
          }
      };

      const handleAppStateChange = async (state: any) => {
          if (state.isActive) {
              triggerReload();
          }
      };
      
      let listener: any;
      
      if (Capacitor.isNativePlatform()) {
          CapacitorApp.addListener('appStateChange', handleAppStateChange).then(l => { listener = l; });
      }
      
      window.addEventListener('focus', triggerReload);
      window.addEventListener('online', triggerReload);
      
      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
              triggerReload();
          }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => { 
        if (listener) listener.remove(); 
        window.removeEventListener('focus', triggerReload);
        window.removeEventListener('online', triggerReload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  }, [currentUser]);

  useEffect(() => {
    const syncSettings = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const host = getServerHost() || 'https://dlkam.ir';
          if (currentUser) {
            await Preferences.set({ key: 'user_username', value: currentUser.username });
            await Preferences.set({ key: 'user_role', value: currentUser.role });
            await Preferences.set({ key: 'user_logged_in', value: 'true' });
          } else {
            await Preferences.remove({ key: 'user_username' });
            await Preferences.remove({ key: 'user_role' });
            await Preferences.remove({ key: 'user_logged_in' });
          }
          await Preferences.set({ key: 'server_url', value: host });
          console.log('[NativeSync] Synchronized user metadata across Preferences');
        } catch (err) {
          console.error('[NativeSync] Preferences sync failed:', err);
        }
      }
    };
    syncSettings();
  }, [currentUser]);

  useEffect(() => { 
      if (currentUser) { 
          loadData(false); 
          // Android app has much higher responsiveness (4s) compared to web (8s)
          const intervalDuration = isNative ? 4000 : 8000;
          const intervalId = setInterval(() => loadData(true), intervalDuration); 
          
          // Heartbeat for Last Seen (Every 1 minute)
          const heartbeatId = setInterval(() => {
              apiCall('/heartbeat', 'POST', { username: currentUser.username }).catch(console.error);
          }, 60000);

          return () => { 
              clearInterval(intervalId); 
              clearInterval(heartbeatId);
          }; 
      } 
  }, [currentUser]);

  useEffect(() => {
      if (!currentUser) return;
      
      // If we are on the chat tab, poll messages more frequently (every 2 seconds) for a real-time experience!
      let fastChatInterval: any = null;
      if (activeTab === 'chat') {
          const fetchChatMessages = async () => {
              try {
                  const messagesData = await getMessages();
                  const safeMessages = Array.isArray(messagesData) ? messagesData : [];
                  setChatMessages(prev => {
                      // Compare to see if updated
                      if (prev.length !== safeMessages.length) return safeMessages;
                      if (prev.length > 0 && safeMessages.length > 0) {
                          const pLast = prev[prev.length - 1];
                          const sLast = safeMessages[safeMessages.length - 1];
                          if (pLast.id !== sLast.id || pLast.timestamp !== sLast.timestamp || pLast.readBy?.length !== sLast.readBy?.length) {
                              return safeMessages;
                          }
                      }
                      return prev;
                  });
              } catch (e) {
                  console.error("Fast chat poll failed", e);
              }
          };
          
          fastChatInterval = setInterval(fetchChatMessages, 2000);
      }
      
      return () => {
          if (fastChatInterval) clearInterval(fastChatInterval);
      };
  }, [currentUser, activeTab]);

  useEffect(() => {
      if (currentUser) {
          setupNativePushNotifications(currentUser.username, currentUser.role).catch(console.error);
      }
  }, [currentUser]);

  // Synchronize Active Screen Views with Client and Server Notification read statuses
  useEffect(() => {
      if (!currentUser || notifications.length === 0) return;
      
      let targetUrls: string[] = [];
      if (activeTab === 'chat') {
          targetUrls = ['chat', '/chat'];
      } else if (activeTab === 'manage' || activeTab === 'manage-orders') {
          targetUrls = ['/payment-approvals', '/payment-orders', 'payment-approvals', 'payment-orders'];
      } else if (activeTab === 'manage-exit' || activeTab === 'manage-invoices') {
          targetUrls = ['/exit-permits', '/exit-approvals', 'exit-permits', 'exit-approvals'];
      }
      
      if (targetUrls.length > 0) {
          const unreadMatched = notifications.filter(n => {
              if (n.read || !n.url) return false;
              // Ignore query parameters when matching base path
              const cleanUrl = n.url.split('?')[0];
              return targetUrls.includes(n.url) || targetUrls.includes(cleanUrl);
          });
          if (unreadMatched.length > 0) {
              unreadMatched.forEach(n => {
                  removeNotification(n.id);
              });
          }
      }
  }, [activeTab, notifications, currentUser]);

  const handleOrderCreated = () => { loadData(); setManageOrdersInitialTab('current'); setDashboardStatusFilter(null); setActiveTab('manage'); };
  const handleLogin = (user: User) => { setCurrentUser(user); setActiveTab('dashboard'); };
  const handleViewArchive = () => { setManageOrdersInitialTab('archive'); setDashboardStatusFilter(null); setActiveTab('manage'); };
  const handleDashboardFilter = (status: any) => { setDashboardStatusFilter(status); setManageOrdersInitialTab('current'); setActiveTab('manage'); };

  const handleGoToPaymentApprovals = () => {
      let filter: any = 'pending_all';
      if (currentUser) {
          const permissions = getRolePermissions(currentUser.role, settings || null);
          if (currentUser.role === UserRole.FINANCIAL || permissions.canApproveFinancial) filter = 'cartable_financial';
          else if (currentUser.role === UserRole.MANAGER || permissions.canApproveManager) filter = 'cartable_manager';
          else if (currentUser.role === UserRole.CEO || permissions.canApproveCeo) filter = 'cartable_ceo';
      }
      setDashboardStatusFilter(filter);
      setManageOrdersInitialTab('current');
      setActiveTab('manage');
  };

    const handleGoToExitApprovals = () => { 
      setExitPermitStatusFilter('pending'); 
      if (currentUser?.role === UserRole.CEO || currentUser?.role === UserRole.SALES_MANAGER) {
          setActiveTab('manage-invoices'); 
      } else {
          setActiveTab('manage-exit'); 
      }
    };
  const [warehouseInitialTab, setWarehouseInitialTab] = useState<'dashboard' | 'approvals'>('dashboard');
  const handleGoToWarehouseApprovals = () => { setWarehouseInitialTab('approvals'); setActiveTab('warehouse'); };
    const [purchaseInitialTab, setPurchaseInitialTab] = useState<'DASHBOARD' | 'REQUESTS' | 'PARTS' | 'KARDEX' | 'ARCHIVE'>('REQUESTS');
  const handleGoToPurchaseApprovals = () => { setPurchaseInitialTab('REQUESTS'); setActiveTab('purchase'); };

  const unreadChatCount = useMemo(() => {
      if (!currentUser) return 0;
      return chatMessages.filter(m => {
          if (m.senderUsername === currentUser.username) return false;
          if (m.readBy?.includes(currentUser.username)) return false;
          if (m.groupId) return true;
          if (m.recipient && m.recipient !== currentUser.username) return false;
          return true;
      }).length;
  }, [chatMessages, currentUser]);

  const toastStyle = useMemo(() => {
     if (!toast || !toast.title) return null;
     const titleText = toast.title.toLowerCase();
     const msgText = (toast.message || '').toLowerCase();
     const combined = `${titleText} ${msgText}`;
     
     if (combined.includes('گفتگو') || combined.includes('پیام') || combined.includes('چت') || combined.includes('گروه') || combined.includes('پیام جدید')) {
         return {
             gradient: 'from-emerald-500 to-teal-600',
             icon: <MessageSquare size={20} className="text-white" />,
             badge: 'پیام گفتگو',
             badgeBg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
             barColor: 'bg-emerald-500'
         };
     }
     
     if (combined.includes('ابطال') || combined.includes('کنسل') || combined.includes('رد شد') || combined.includes('خطا')) {
         return {
             gradient: 'from-rose-500 to-red-600',
             icon: <AlertTriangle size={20} className="text-white animate-bounce" />,
             badge: 'هشدار ابطال',
             badgeBg: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400',
             barColor: 'bg-rose-500'
         };
     }

     if (combined.includes('خروج') || combined.includes('سند خروج') || combined.includes('باربری') || combined.includes('مجوز')) {
         return {
             gradient: 'from-amber-600 to-orange-500',
             icon: <FileWarning size={20} className="text-white" />,
             badge: 'مجوز خروج',
             badgeBg: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
             barColor: 'bg-amber-500'
         };
     }

     if (combined.includes('پرداخت') || combined.includes('تایید مالی') || combined.includes('صندوق') || combined.includes('چک') || combined.includes('حواله')) {
         return {
             gradient: 'from-blue-500 to-indigo-600',
             icon: <CreditCard size={20} className="text-white" />,
             badge: 'مالی و پرداخت',
             badgeBg: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
             barColor: 'bg-blue-500'
         };
     }

     return {
         gradient: 'from-indigo-500 to-purple-600',
         icon: <BellRing size={20} className="text-white" />,
         badge: 'اعلان سیستم',
         badgeBg: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400',
         barColor: 'bg-indigo-500'
     };
  }, [toast]);

  return (
    <>
        <AnimatePresence>
            {toast && toast.show && toastStyle && (
                <div className="fixed inset-x-0 top-6 z-[9999999] flex justify-center pointer-events-none w-full px-4">
                    <motion.div
                        initial={{ opacity: 0, y: -45, scale: 0.93 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -35, scale: 0.93 }}
                        transition={{ type: "spring", stiffness: 380, damping: 24 }}
                        drag="y"
                        dragConstraints={{ top: -30, bottom: 30 }}
                        onDragEnd={(e, info) => {
                            if (info.offset.y < -12 || info.offset.y > 20) {
                                closeToast();
                            }
                        }}
                        className="glass-panel border-2 border-white/70 dark:border-white/10 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.18)] rounded-2xl p-3 flex items-center gap-3.5 min-w-[290px] max-w-sm pointer-events-auto cursor-pointer relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-3xl overflow-hidden text-right select-none"
                        onClick={closeToast}
                    >
                        {/* Elegant Left bar */}
                        <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${toastStyle.gradient.split(' ')[0].replace('from-', 'bg-')} shadow-[0_0_10px_rgba(59,130,246,0.3)]`}></div>
                        
                        {/* Rounded Dynamic Icon */}
                        <div className={`bg-gradient-to-tr ${toastStyle.gradient} p-2.5 rounded-2xl text-white shadow-lg flex-shrink-0 flex items-center justify-center`}>
                            {toastStyle.icon}
                        </div>
                        
                        {/* Body labels */}
                        <div className="flex-1 min-w-0 pr-1 select-none">
                            <div className="flex justify-between items-baseline mb-0.5">
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${toastStyle.badgeBg}`}>{toastStyle.badge}</span>
                                <h4 className="font-extrabold text-gray-900 dark:text-white text-xs tracking-tight select-none">{toast.title}</h4>
                            </div>
                            <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed font-semibold max-h-[36px] overflow-hidden text-ellipsis line-clamp-2 select-none">{toast.message}</p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
        {!currentUser ? (
            <Login onLogin={handleLogin} />
        ) : (
            <Layout 
            onBack={goBack}
            activeTab={activeTab} 
            setActiveTab={(t) => { setActiveTab(t); if(t!=='warehouse') setWarehouseInitialTab('dashboard'); if(t!=='manage-exit') setExitPermitStatusFilter(null); if(t!=='manage') setDashboardStatusFilter(null); if(t!=='purchase') setPurchaseInitialTab('REQUESTS'); }} 
            currentUser={currentUser} 
            onLogout={handleLogout} 
            notifications={notifications} 
            clearNotifications={() => {
                setNotifications([]);
                notificationsRef.current = [];
                if (currentUser) apiCall('/notifications/delete', 'POST', { username: currentUser.username, id: 'all' }).catch(console.error);
            }}
            markAllNotificationsAsRead={() => {
                setNotifications(prev => prev.map(n => ({...n, read: true})));
                notificationsRef.current = notificationsRef.current.map(n => ({...n, read: true}));
                if (currentUser) apiCall('/notifications/read', 'POST', { username: currentUser.username, id: 'all' }).catch(console.error);
            }}
            onDeleteNotification={deleteNotification}
            onAddNotification={addAppNotification}
            onRemoveNotification={removeNotification}
            financialYear={financialYear}
            setFinancialYear={setFinancialYear}
            settings={settings}
            theme={theme}
            toggleTheme={toggleTheme}
            unreadChatCount={unreadChatCount}
            >
            
            <NotificationController 
                currentUser={currentUser} 
                onNotificationClick={(data) => {
                    if (data && data.tab) {
                        setActiveTab(data.tab);
                    }
                }}
            />

            {backgroundJobs.length > 0 && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                    <div id={`bg-print-voucher-${backgroundJobs[0].order.id}`}>
                        <PrintVoucher order={backgroundJobs[0].order} embed settings={settings || undefined} />
                    </div>
                </div>
            )}

            <div className="flex-1 relative flex flex-col min-h-0">
                {loading && (
                    <div className="fixed top-20 right-4 z-[999] bg-white/80 dark:bg-gray-800/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800 shadow-lg flex items-center gap-2 animate-fade-in">
                        <Loader2 size={16} className="animate-spin text-blue-600" />
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">در حال بروزرسانی دیتابیس...</span>
                    </div>
                )}
                <div className={activeTab === 'dashboard' ? 'block h-full page-transition' : 'hidden'}>
                    <Dashboard 
                        orders={orders} 
                        settings={settings} 
                        currentUser={currentUser} 
                        onViewArchive={handleViewArchive} 
                        onFilterByStatus={handleDashboardFilter} 
                        onGoToPaymentApprovals={handleGoToPaymentApprovals} 
                        onGoToExitApprovals={handleGoToExitApprovals} 
                        onGoToBijakApprovals={handleGoToWarehouseApprovals} 
                        onGoToPurchaseApprovals={handleGoToPurchaseApprovals} 
                        onNavigate={(tab) => setActiveTab(tab)}
                        financialYear={financialYear} 
                        onGoToTaskGroup={(groupId, taskId) => {
                            setDirectChatTarget({ type: 'task_group', id: groupId, taskId });
                            setActiveTab('chat');
                        }}
                    />
                </div>
                {activeTab === 'create' && <div className="page-transition flex flex-col flex-1 min-h-0"><CreateOrder onSuccess={handleOrderCreated} currentUser={currentUser} /></div>}
                {activeTab === 'manage' && <div className="page-transition flex flex-col flex-1 min-h-0"><ManageOrders orders={orders} refreshData={() => loadData(true)} currentUser={currentUser} initialTab={manageOrdersInitialTab} settings={settings} statusFilter={dashboardStatusFilter} financialYear={financialYear} /></div>}
                {activeTab === 'create-exit' && <div className="page-transition flex flex-col flex-1 min-h-0"><CreateExitPermit onSuccess={() => setActiveTab('manage-exit')} currentUser={currentUser} /></div>}
                {activeTab === 'manage-invoices' && <div className="page-transition flex flex-col flex-1 min-h-0"><ManageExitPermits currentUser={currentUser} settings={settings} statusFilter={exitPermitStatusFilter} financialYear={financialYear} mode="INVOICE" /></div>}
                {activeTab === 'manage-exit' && <div className="page-transition flex flex-col flex-1 min-h-0"><ManageExitPermits currentUser={currentUser} settings={settings} statusFilter={exitPermitStatusFilter} financialYear={financialYear} mode="EXIT" /></div>}
                {activeTab === 'warehouse' && <div className="page-transition flex flex-col flex-1 min-h-0"><WarehouseModule currentUser={currentUser} settings={settings} initialTab={warehouseInitialTab} financialYear={financialYear} /></div>}
                {activeTab === 'trade' && <div className="page-transition flex flex-col flex-1 min-h-0"><TradeModule currentUser={currentUser} /></div>}
                {activeTab === 'balances' && <div className="page-transition flex flex-col flex-1 min-h-0"><CustomerBalanceModule currentUser={currentUser} /></div>}
                {activeTab === 'sales' && <div className="page-transition flex flex-col flex-1 min-h-0"><SalesCRMModule /></div>}
                {activeTab === 'products' && <div className="page-transition flex flex-col flex-1 min-h-0"><ProductsModule /></div>}
                {activeTab === 'tickets' && <div className="page-transition flex flex-col flex-1 min-h-0"><Tickets /></div>}
                {activeTab === 'ccti' && <div className="page-transition flex flex-col flex-1 min-h-0"><CctiConverter financialYear={financialYear} currentUser={currentUser} canManageArchive={currentUser.role === UserRole.ADMIN || (settings && getRolePermissions(currentUser.role, settings, currentUser).canManageCctiArchive === true)} /></div>}
                {activeTab === 'sayan' && <div className="page-transition flex flex-col flex-1 min-h-0 bg-gray-50"><AccountingReports currentUser={currentUser} settings={settings} /></div>}
                {activeTab === 'users' && <div className="page-transition flex flex-col flex-1 min-h-0"><ManageUsers /></div>}
                {activeTab === 'settings' && <div className="page-transition flex flex-col flex-1 min-h-0"><Settings financialYear={financialYear} settings={settings} onUpdateSettings={setSettings} /></div>}
                {(activeTab === 'knowledge' || activeTab === 'notes') && <div className="page-transition flex flex-col flex-1 min-h-0"><KnowledgeBaseModule currentUser={currentUser} settings={settings} onUpdateSettings={setSettings} /></div>}
                {activeTab === 'security' && <div className="page-transition flex flex-col flex-1 min-h-0"><SecurityModule currentUser={currentUser} financialYear={financialYear} /></div>}
                {activeTab === 'meetings' && <div className="page-transition flex flex-col flex-1 min-h-0"><MeetingModule currentUser={currentUser} /></div>}
                {activeTab === 'purchase' && <div className="page-transition flex flex-col flex-1 min-h-0"><PurchaseModule currentUser={currentUser} settings={settings || undefined} initialTab={purchaseInitialTab} /></div>}
                {activeTab === 'secretariat' && currentUser && <div className="page-transition flex flex-col flex-1 min-h-0"><SecretariatModule currentUser={currentUser} /></div>}
                {activeTab === 'cheque-receipts' && currentUser && <div className="page-transition flex flex-col flex-1 min-h-0"><ChequeReceiptModule currentUser={currentUser} /></div>}
                
                <div className={activeTab === 'chat' ? 'flex-1 flex flex-col w-full min-h-0 page-transition' : 'fixed inset-0 pointer-events-none opacity-0 invisible overflow-hidden h-0'}>
                    <ChatRoom 
                        currentUser={currentUser} 
                        preloadedMessages={chatMessages}
                        onRefresh={() => loadData(true)} 
                        sharedData={sharedData}
                        onClearSharedData={() => setSharedData(null)}
                        onMessagesRead={(msgIds) => {
                            if (!currentUser) return;
                            const idsSet = new Set(msgIds);
                            setChatMessages(prev => prev.map(m => idsSet.has(m.id) ? { ...m, readBy: [...(m.readBy || []), currentUser.username] } : m));
                        }}
                        directChatTarget={directChatTarget}
                        onClearDirectChatTarget={() => setDirectChatTarget(null)}
                    />
                </div> 
            </div>
            </Layout>
        )}
    </>
  );
}
export default App;
