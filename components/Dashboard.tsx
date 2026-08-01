
import React, { useState, useMemo, useEffect } from 'react';
import { PaymentOrder, OrderStatus, SystemSettings, User, ExitPermit, ExitPermitStatus, WarehouseTransaction, UserRole, SystemAnnouncement } from '../types';
import { formatCurrency, getShamsiDateFromIso } from '../constants';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, Clock, CheckCircle, Check, Activity, XCircle, Banknote, Calendar as CalendarIcon, ShieldCheck, ArrowUpRight, CheckSquare, Truck, Package, ListChecks, PieChart, BarChart, BookOpen, PenTool, Edit3, Plus, Trash2, Send, X, FileText, Users } from 'lucide-react';
import { getRolePermissions } from '../services/authService';
import { getExitPermits, getWarehouseTransactions, getNotes, getPurchaseRequests, getTaskGroups, getTasks, updateTask } from '../services/storageService';
import { isInFinancialYear } from '../utils/dateUtils';
import { getRandomQuote } from '../utils/quotes';
import { Note, PurchaseRequest, PurchaseRequestStatus, GroupTask, TaskGroup } from '../types';

interface DashboardProps {
  orders: PaymentOrder[];
  settings?: SystemSettings;
  currentUser: User;
  onViewArchive?: () => void;
  onFilterByStatus?: (status: OrderStatus | 'pending_all') => void;
  onGoToPaymentApprovals: () => void;
  onGoToExitApprovals: () => void;
  onGoToBijakApprovals: () => void;
  onGoToPurchaseApprovals: () => void;
  onGoToTaskGroup?: (groupId: string, taskId?: string) => void;
  onNavigate?: (tab: string) => void;
  financialYear?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const MONTHS = [ 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند' ];

const Dashboard: React.FC<DashboardProps> = ({ orders: rawOrders, settings, currentUser, onViewArchive, onFilterByStatus, onGoToPaymentApprovals, onGoToExitApprovals, onGoToBijakApprovals, onGoToPurchaseApprovals, onGoToTaskGroup, onNavigate, financialYear }) => {
  const orders = useMemo(() => {
        if (!financialYear || financialYear === 'all') return rawOrders;
        return rawOrders.filter(o => isInFinancialYear(o.date, financialYear) || isInFinancialYear(o.payDate, financialYear));
  }, [rawOrders, financialYear]);

  const [showBankReport, setShowBankReport] = useState(false);
  const [bankReportTab, setBankReportTab] = useState<'summary' | 'timeline'>('summary');
  
  // Data for additional counts
  const [exitPermits, setExitPermits] = useState<ExitPermit[]>(() => {
    try {
        const item = localStorage.getItem('app_data_exit_permits');
        return item ? JSON.parse(item) : [];
    } catch { return []; }
  });
  const [warehouseTxs, setWarehouseTxs] = useState<WarehouseTransaction[]>(() => {
    try {
        const item = localStorage.getItem('app_data_wh_tx');
        return item ? JSON.parse(item) : [];
    } catch { return []; }
  });
  const [purchaseReqs, setPurchaseReqs] = useState<PurchaseRequest[]>(() => {
    try {
        const item = localStorage.getItem('app_data_purchase_reqs');
        return item ? JSON.parse(item) : [];
    } catch { return []; }
  });
  const [secretariatLetters, setSecretariatLetters] = useState<any[]>(() => {
    try {
        const item = localStorage.getItem('app_data_secretariat');
        return item ? JSON.parse(item) : [];
    } catch { return []; }
  });

  // Personal Notes State
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
        const item = localStorage.getItem('app_data_notes');
        const allNotes = item ? JSON.parse(item) : [];
        return currentUser?.id ? allNotes.filter((n: Note) => n.userId === currentUser.id && !n.isPrivate) : [];
    } catch { return []; }
  });
  
  useEffect(() => {
    if (currentUser?.id) {
        getNotes().then(allNotes => {
            setNotes(allNotes.filter(n => n.userId === currentUser.id && !n.isPrivate));
        }).catch(e => console.error("Load dashboard notes error", e));
    }
  }, [currentUser]);

  const dailyQuote = useMemo(() => getRandomQuote(), []);
    const shamsiDate = useMemo(() => {
        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const parts = formatter.formatToParts(now);
            
            const findPart = (type: string) => parts.find(p => p.type === type)?.value || '';
            
            return {
                weekday: findPart('weekday'),
                day: findPart('day'),
                month: findPart('month'),
                year: findPart('year'),
                full: formatter.format(now)
            };
        } catch (e) {
            return { weekday: 'امروز', day: '-', month: '-', year: '-', full: '' };
        }
    }, [rawOrders]);

    const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>(() => {
        try {
            const item = localStorage.getItem('app_data_announcements');
            return item ? JSON.parse(item) : [];
        } catch { return []; }
    });
    const [showAnnounceModal, setShowAnnounceModal] = useState(false);
    const [announceText, setAnnounceText] = useState('');
    const [announceTarget, setAnnounceTarget] = useState('');
    const [announceType, setAnnounceType] = useState<'announcement' | 'task'>('announcement');
    
    // Add users fetching for target dropdown
    const [allUsers, setAllUsers] = useState<User[]>([]);
    useEffect(() => {
        import('../services/authService').then(mod => {
            mod.getUsers().then(u => setAllUsers(u || []));
        });
    }, []);

    // Chat Task groups & tasks data for dashboard
    const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
    const [tasks, setTasks] = useState<GroupTask[]>([]);
    const [showTasksInDashboard, setShowTasksInDashboard] = useState<boolean>(() => {
        return localStorage.getItem('dashboard_show_chat_tasks') !== 'false';
    });

    const loadTasksData = () => {
        getTaskGroups().then(groups => {
            const myGroups = groups.filter(g => (g.members || []).includes(currentUser.username));
            setTaskGroups(myGroups);
        }).catch(e => console.error("Load task groups error", e));

        getTasks().then(allTasks => {
            setTasks(allTasks);
        }).catch(e => console.error("Load tasks error", e));
    };

    useEffect(() => {
        loadTasksData();
    }, [currentUser]);

    const handleCreateAnnouncement = async () => {
        if (!announceText.trim()) return;
        const targetUsers = announceTarget ? [announceTarget] : [];
        const newAnn: SystemAnnouncement = {
            id: Date.now().toString(),
            message: announceText,
            createdBy: currentUser.username,
            createdAt: Date.now(),
            targetUsers,
            type: announceType,
            isCompleted: false
        } as any; // Allow for custom typings temporarily
        const mod = await import('../services/storageService');
        await mod.createSystemAnnouncement(newAnn);
        setAnnouncements(prev => [newAnn, ...prev]);
        setShowAnnounceModal(false);
        setAnnounceText('');
        setAnnounceTarget('');
        setAnnounceType('announcement');
    };

    useEffect(() => {
        import('../services/storageService').then(mod => {
            mod.getSystemAnnouncements().then(anns => {
                setAnnouncements(anns ? anns.sort((a,b)=>b.createdAt - a.createdAt) : []);
            }).catch(console.error);
        });
    }, []);

    const handleToggleAnnouncementCompletion = async (ann: SystemAnnouncement) => {
        const updatedAnn = { 
            ...ann, 
            isCompleted: !ann.isCompleted, 
            completedAt: !ann.isCompleted ? Date.now() : undefined,
            completedBy: !ann.isCompleted ? currentUser.username : undefined
        };
        const mod = await import('../services/storageService');
        await mod.updateSystemAnnouncement(updatedAnn);
        setAnnouncements(prev => prev.map(a => a.id === ann.id ? updatedAnn : a));
    };

    const visibleAnnouncements = useMemo(() => {
        return announcements.filter(a => {
            if (!a.targetUsers || a.targetUsers.length === 0) return true; // all
            return a.targetUsers.includes(currentUser.username);
        });
    }, [announcements, currentUser]);

    // ... (rest of logic) ...

  // Permission Check
  const permissions = settings ? getRolePermissions(currentUser.role, settings, currentUser) : { canViewPaymentOrders: false };
  const hasPaymentAccess = permissions.canViewPaymentOrders === true;
  const hasExitAccess = permissions.canViewExitPermits === true;
  const hasWarehouseAccess = permissions.canManageWarehouse === true || permissions.canApproveBijak === true;
  const hasPurchaseAccess = permissions.canManagePurchase === true || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO || currentUser.role === UserRole.FACTORY_MANAGER;

  useEffect(() => {
      const fetchData = async () => {
          try {
              if (hasExitAccess || hasWarehouseAccess || hasPurchaseAccess) {
                  let [exits, txs, purchases] = await Promise.all([getExitPermits(), getWarehouseTransactions(), getPurchaseRequests()]);
                  if (financialYear && financialYear !== 'all') {
                      exits = exits.filter(e => isInFinancialYear(e.date, financialYear));
                      txs = txs.filter(t => isInFinancialYear(t.date, financialYear));
                      purchases = purchases.filter(p => isInFinancialYear(p.date, financialYear));
                  }
                  setExitPermits(exits || []);
                  setWarehouseTxs(txs || []);
                  setPurchaseReqs(purchases || []);
              }
          } catch (error) {
              console.error("Dashboard data load error", error);
              setExitPermits([]);
              setWarehouseTxs([]);
              setPurchaseReqs([]);
          }
      };
      fetchData();
  }, [hasExitAccess, hasWarehouseAccess, hasPurchaseAccess, financialYear]);

  // --- CALC PENDING COUNTS FOR ACTION CARDS ---
  
  // 1. Payment Pending Count (Based on user role)
  let pendingPaymentCount = 0;
  if (hasPaymentAccess) {
      if (currentUser.role === UserRole.FINANCIAL || currentUser.role === UserRole.ADMIN || permissions.canApproveFinancial) {
          pendingPaymentCount += orders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.REVOCATION_PENDING_FINANCE).length;
      }
      if (currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.ADMIN || permissions.canApproveManager) {
          pendingPaymentCount += orders.filter(o => o.status === OrderStatus.APPROVED_FINANCE || o.status === OrderStatus.REVOCATION_PENDING_MANAGER).length;
      }
      if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN || permissions.canApproveCeo) {
          pendingPaymentCount += orders.filter(o => o.status === OrderStatus.APPROVED_MANAGER || o.status === OrderStatus.REVOCATION_PENDING_CEO).length;
      }
  }

  // 2. Exit Pending Count
  let pendingExitCount = 0;
  if (hasExitAccess) {
      if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN || permissions.canApproveExitCeo) {
          pendingExitCount += exitPermits.filter(p => p.status === ExitPermitStatus.PENDING_CEO).length;
      }
      if (currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN || permissions.canApproveExitFactory) {
          pendingExitCount += exitPermits.filter(p => p.status === ExitPermitStatus.PENDING_FACTORY || p.status === ExitPermitStatus.PENDING_FACTORY_FINAL).length;
      }
      if (currentUser.role === UserRole.WAREHOUSE_KEEPER || currentUser.role === UserRole.ADMIN || permissions.canApproveExitWarehouse) {
          pendingExitCount += exitPermits.filter(p => p.status === ExitPermitStatus.PENDING_WAREHOUSE).length;
      }
      if (currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.ADMIN || permissions.canApproveExitSecurity) {
          pendingExitCount += exitPermits.filter(p => p.status === ExitPermitStatus.PENDING_SECURITY).length;
      }
  }

  // 3. Bijak Pending Count
  let pendingBijakCount = 0;
  if (hasWarehouseAccess) {
      if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN || permissions.canApproveBijak) {
          pendingBijakCount += warehouseTxs.filter(t => t.type === 'OUT' && t.status === 'PENDING').length;
      }
  }

  // 4. Purchase Pending Count
  let pendingPurchaseCount = 0;
  if (hasPurchaseAccess) {
      if (currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN || permissions.canApprovePurchaseFactory) {
          pendingPurchaseCount += purchaseReqs.filter(p => p.status === PurchaseRequestStatus.PENDING_TECHNICAL || p.status === PurchaseRequestStatus.PENDING_FACTORY || p.status === PurchaseRequestStatus.PENDING_FACTORY_FINAL_APPROVE).length;
      }
      if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN || permissions.canApprovePurchaseCeo) {
          pendingPurchaseCount += purchaseReqs.filter(p => p.status === PurchaseRequestStatus.PENDING_CEO_INITIAL || p.status === PurchaseRequestStatus.PENDING_CEO_SELECTION).length;
      }
      if (currentUser.role === UserRole.COMMERCIAL || currentUser.role === UserRole.ADMIN || permissions.canManagePurchase) {
          pendingPurchaseCount += purchaseReqs.filter(p => p.status === PurchaseRequestStatus.PENDING_TEHRAN_PROFORMA || p.status === PurchaseRequestStatus.PENDING_FACTORY_PROFORMA).length;
      }
      if (currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SECURITY_GUARD) {
          pendingPurchaseCount += purchaseReqs.filter(p => p.status === PurchaseRequestStatus.PENDING_SECURITY_ENTRY).length;
      }
      if (currentUser.role === UserRole.QC || currentUser.role === UserRole.ADMIN) {
          pendingPurchaseCount += purchaseReqs.filter(p => p.status === PurchaseRequestStatus.PENDING_QC).length;
      }
      if (currentUser.role === UserRole.WAREHOUSE_KEEPER || currentUser.role === UserRole.ADMIN) {
          pendingPurchaseCount += purchaseReqs.filter(p => p.status === PurchaseRequestStatus.PENDING_WAREHOUSE_RECEIPT).length;
      }
  }

  // 5. Secretariat Pending Count
  const hasSecretariatAccess = currentUser.canAccessSecretariat === true || permissions.isSuperUser;
  let pendingSecretariatCount = 0;
  if (hasSecretariatAccess) {
      pendingSecretariatCount = secretariatLetters.filter(l => {
          if (l.status !== 'در انتظار اقدام') return false;
          if (currentUser.secretariatAllowedCompanies?.length > 0 && !currentUser.secretariatAllowedCompanies.includes(l.companyId)) return false;
          
          if (permissions.isSuperUser) return true;
          const isReferred = l.referredTo?.includes(currentUser.id);
          const needsSignature = l.signers?.some(s => s.userId === currentUser.id) && !l.approvedBy?.includes(currentUser.id);
          
          return isReferred || needsSignature;
      }).length;
  }

  const showActionSection = pendingPaymentCount > 0 || pendingExitCount > 0 || pendingBijakCount > 0 || pendingPurchaseCount > 0 || pendingSecretariatCount > 0;

  // ... (Existing Charts logic) ...
  const completedOrders = orders.filter(o => o.status === OrderStatus.APPROVED_CEO || o.status === OrderStatus.REVOKED);
  const totalAmount = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const countPending = orders.filter(o => o.status === OrderStatus.PENDING).length;
  const countFin = orders.filter(o => o.status === OrderStatus.APPROVED_FINANCE).length;
  const countMgr = orders.filter(o => o.status === OrderStatus.APPROVED_MANAGER).length;
  const countRejected = orders.filter(o => o.status === OrderStatus.REJECTED).length;

  const activeCartable = hasPaymentAccess ? orders
    .filter(o => o.status !== OrderStatus.APPROVED_CEO && o.status !== OrderStatus.REJECTED && o.status !== OrderStatus.REVOKED)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10) : [];

  const handleWidgetClick = (status: OrderStatus | 'pending_all') => {
      if (hasPaymentAccess && onFilterByStatus) {
          onFilterByStatus(status);
      }
  };

  const statusWidgets = [
    { key: OrderStatus.PENDING, label: 'کارتابل مالی', count: countPending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', barColor: 'bg-amber-500' },
    { key: OrderStatus.APPROVED_FINANCE, label: 'کارتابل مدیریت', count: countFin, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300', border: 'border-blue-100', barColor: 'bg-blue-500' },
    { key: OrderStatus.APPROVED_MANAGER, label: 'کارتابل مدیرعامل', count: countMgr, icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300', border: 'border-indigo-100', barColor: 'bg-indigo-500' },
    { key: OrderStatus.REJECTED, label: 'رد شده', count: countRejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', barColor: 'bg-red-500' },
    { key: OrderStatus.APPROVED_CEO, label: 'بایگانی', count: completedOrders.length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', barColor: 'bg-green-500' }
  ];

  const methodDataRaw: Record<string, number> = {};
  orders.forEach(order => { order.paymentDetails.forEach(detail => { methodDataRaw[detail.method] = (methodDataRaw[detail.method] || 0) + detail.amount; }); });
  const methodData = Object.keys(methodDataRaw).map(key => ({ name: key, amount: methodDataRaw[key] }));

  const bankStats = useMemo(() => {
    const stats: Record<string, number> = {};
    completedOrders.forEach(order => { order.paymentDetails.forEach(detail => { if (detail.bankName && detail.bankName.trim() !== '') { const normalizedName = detail.bankName.trim(); stats[normalizedName] = (stats[normalizedName] || 0) + detail.amount; } }); });
    return Object.entries(stats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [completedOrders]);

  const topBank = bankStats.length > 0 ? bankStats[0] : { name: '-', value: 0 };
  const mostActiveMonth = { label: '-', total: 0 }; // Simplified for now

  const quickTiles = [
      { id: 'create', title: 'ثبت پرداخت', badge: 'پرداخت', icon: Plus, gradient: 'from-blue-600 to-indigo-600', onClick: () => onNavigate ? onNavigate('create') : null },
      { id: 'manage', title: 'کارتابل مالی', badge: 'مالی', count: pendingPaymentCount, icon: CheckSquare, gradient: 'from-amber-500 to-orange-600', onClick: onGoToPaymentApprovals },
      { id: 'create-exit', title: 'ثبت خروج بار', badge: 'خروج', icon: Truck, gradient: 'from-emerald-500 to-teal-600', onClick: () => onNavigate ? onNavigate('create-exit') : null },
      { id: 'manage-exit', title: 'کارتابل خروج', badge: 'انتظامات', count: pendingExitCount, icon: ShieldCheck, gradient: 'from-indigo-600 to-purple-600', onClick: onGoToExitApprovals },
      { id: 'manage-invoices', title: 'فاکتور فروش', badge: 'فاکتور', icon: FileText, gradient: 'from-sky-500 to-blue-600', onClick: () => onNavigate ? onNavigate('manage-invoices') : null },
      { id: 'warehouse', title: 'مدیریت انبار', badge: 'انبار', count: pendingBijakCount, icon: Package, gradient: 'from-teal-600 to-emerald-700', onClick: onGoToBijakApprovals },
      { id: 'sayan', title: 'گزارشات سایان', badge: 'ERP سایان', icon: TrendingUp, gradient: 'from-purple-600 to-pink-600', onClick: () => onNavigate ? onNavigate('sayan') : null },
      { id: 'secretariat', title: 'دبیرخانه اداری', badge: 'اداری', icon: BookOpen, gradient: 'from-blue-700 to-cyan-600', onClick: () => onNavigate ? onNavigate('secretariat') : null },
      { id: 'cheque-receipts', title: 'رسید چک', badge: 'چک صیادی', icon: Banknote, gradient: 'from-emerald-600 to-green-700', onClick: () => onNavigate ? onNavigate('cheque-receipts') : null },
      { id: 'chat', title: 'گفتگو و تسک‌ها', badge: 'ارتباطات', icon: Send, gradient: 'from-violet-600 to-purple-700', onClick: () => onNavigate ? onNavigate('chat') : null },
      { id: 'knowledge', title: 'یادداشت‌ها', badge: 'یادداشت', icon: Edit3, gradient: 'from-amber-600 to-yellow-600', onClick: () => onNavigate ? onNavigate('knowledge') : null },
      { id: 'trade', title: 'بازرگانی ارزی', badge: 'تجارت', icon: Activity, gradient: 'from-blue-600 to-indigo-700', onClick: () => onNavigate ? onNavigate('trade') : null },
      { id: 'balances', title: 'مانده حساب', badge: 'استعلام', icon: Activity, gradient: 'from-rose-500 to-pink-600', onClick: () => onNavigate ? onNavigate('balances') : null },
      { id: 'products', title: 'کاتالوگ کالاها', badge: 'محصولات', icon: Package, gradient: 'from-cyan-600 to-blue-600', onClick: () => onNavigate ? onNavigate('products') : null },
      { id: 'sales', title: 'مدیریت مشتریان', badge: 'CRM', icon: Users, gradient: 'from-orange-500 to-amber-600', onClick: () => onNavigate ? onNavigate('sales') : null },
      { id: 'purchase', title: 'درخواست خرید', badge: 'خرید کالا', count: pendingPurchaseCount, icon: Plus, gradient: 'from-fuchsia-600 to-pink-600', onClick: onGoToPurchaseApprovals },
      { id: 'users', title: 'کاربران سیستم', badge: 'دسترسی', icon: Users, gradient: 'from-gray-700 to-zinc-900', onClick: () => onNavigate ? onNavigate('users') : null },
      { id: 'settings', title: 'تنظیمات', badge: 'سیستم', icon: PenTool, gradient: 'from-slate-600 to-gray-800', onClick: () => onNavigate ? onNavigate('settings') : null },
  ];

  return (
    <div className="space-y-6 pb-20 md:pb-0 animate-fade-in">
        
        {/* TOP SECTION: MINIMAL DATE, PRICES & SLICK POETRY */}
        <div className="flex flex-col lg:flex-row gap-4">
            {/* Minimal Date Card - Smaller & Sleek */}
            <div className="glass-panel rounded-2xl p-4 border border-indigo-100 shadow-sm flex items-center gap-4 min-w-[220px] shrink-0 relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity"><CalendarIcon size={40}/></div>
                <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600 flex items-center justify-center relative z-10">
                    <CalendarIcon size={24} />
                </div>
                <div className="flex flex-col relative z-10">
                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                        {shamsiDate.weekday}
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-auto" title="همگام‌سازی با گوگل کلندر"></span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-gray-800 dark:text-gray-200">{shamsiDate.day}</span>
                        <span className="text-sm font-bold text-gray-600">{shamsiDate.month}</span>
                    </div>
                    <div className="text-[9px] text-gray-400 dark:text-gray-500 font-bold mt-1 line-clamp-1">{shamsiDate.year} شمسی</div>
                </div>
            </div>

            {/* Slick Poetry - Smaller and More Elegant */}
            <div className="flex-1 glass-panel rounded-2xl px-6 py-4 border border-rose-50 shadow-sm flex items-center justify-center relative overflow-hidden group min-h-[80px]">
                <div className="absolute right-0 top-0 h-full w-1 bg-rose-200"></div>
                <div className="relative z-10 flex flex-col items-center">
                    <div className="text-[10px] font-bold text-rose-300 mb-1 flex items-center gap-1"><PenTool size={10}/> زمزمه روز</div>
                    <p className="text-gray-700 dark:text-gray-300 font-bold text-sm text-center italic leading-relaxed" style={{ whiteSpace: 'pre-line' }}>{dailyQuote.text}</p>
                </div>
            </div>
        </div>

        {/* ANNOUNCEMENTS SECTION */}
        {(visibleAnnouncements.length > 0 || permissions.canCreateAnnouncements || currentUser.role === UserRole.ADMIN) && (
            <div className={`rounded-2xl border border-blue-100 shadow-sm relative transition-all ${visibleAnnouncements.length === 0 ? 'bg-transparent p-2 border-dashed' : 'bg-blue-50/50 p-6'}`}>
                
                {visibleAnnouncements.length === 0 ? (
                    <div className="flex justify-center items-center">
                        <button onClick={() => setShowAnnounceModal(true)} className="text-xs text-blue-500 hover:text-blue-600 font-bold transition-colors flex items-center gap-1 py-2">
                            <Plus size={14}/> ارسال اولین پیام / اعلامیه برای پرسنل
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600 animate-pulse">
                                    <Activity size={20} />
                                </div>
                                <h3 className="font-black text-gray-800">اعلانات مدیران</h3>
                            </div>
                            {(permissions.canCreateAnnouncements || currentUser.role === UserRole.ADMIN) && (
                                <button onClick={() => setShowAnnounceModal(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1">
                                    <Plus size={14}/> اعلامیه جدید
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {visibleAnnouncements.map((ann, i) => (
                                <div key={ann.id || i} className="glass-panel p-4 rounded-xl shadow-sm border border-blue-50 flex items-start gap-3 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 h-full w-1 bg-gradient-to-b from-blue-400 to-blue-600"></div>
                                    <div className="bg-blue-100/50 p-2 rounded-full text-blue-600 mt-1 cursor-pointer hover:bg-blue-200 transition-colors shadow-sm" onClick={() => handleToggleAnnouncementCompletion(ann)}>
                                        {ann.type === 'task' ? (
                                            ann.isCompleted ? <CheckCircle size={16} className="text-green-600" /> : <div className="w-4 h-4 rounded-full border-2 border-orange-500 bg-orange-100/50"></div>
                                        ) : (
                                            <BookOpen size={16} className="text-blue-600" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-black text-blue-800">{ann.createdBy}</span>
                                            <div className="flex items-center gap-2">
                                                {ann.isCompleted && <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded font-bold">تکمیل شده</span>}
                                                {ann.targetUsers && ann.targetUsers.length > 0 && <span className="bg-blue-100 px-2 py-0.5 rounded text-[10px] text-blue-700 font-bold border border-blue-200">پیام اختصاصی</span>}
                                                {(permissions.canCreateAnnouncements || currentUser.role === UserRole.ADMIN) && (
                                                    <button onClick={async (e) => {
                                                        e.stopPropagation();
                                                        const mod = await import('../services/storageService');
                                                        await mod.deleteSystemAnnouncement(ann.id);
                                                        setAnnouncements(prev => prev.filter(a => a.id !== ann.id));
                                                    }} className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 p-1 rounded transition-all"><Trash2 size={12}/></button>
                                                )}
                                            </div>
                                        </div>
                                        <p className={`text-sm font-bold transition-all ${ann.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`} style={{ whiteSpace: 'pre-wrap' }}>{ann.message}</p>
                                        <div className="text-[10px] text-gray-400 mt-2 text-left">
                                            {(() => { 
                                                const d = getShamsiDateFromIso(new Date(ann.createdAt).toISOString()); 
                                                const greg = new Date(ann.createdAt).toLocaleDateString('en-CA'); // YYYY-MM-DD
                                                return `${d.year}/${d.month}/${d.day} | ${greg}`; 
                                            })()} - {new Date(ann.createdAt).toLocaleTimeString('fa-IR', {hour: '2-digit', minute: '2-digit'})}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        )}

        {/* TASK GROUPS WIDGET */}
        {!showTasksInDashboard ? (
            <div className="flex justify-end my-3">
                <button 
                    onClick={() => {
                        setShowTasksInDashboard(true);
                        localStorage.setItem('dashboard_show_chat_tasks', 'true');
                    }}
                    className="text-xs text-gray-400 hover:text-blue-600 font-bold transition flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-gray-100"
                >
                    <ListChecks size={14}/> نمایش مجدد تسک‌های گفتگو در داشبورد
                </button>
            </div>
        ) : (
            <div className="rounded-2xl border border-blue-100 bg-white/50 p-6 shadow-sm relative transition-all my-5">
                <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-2">
                        <div className="bg-orange-100 p-1.5 rounded-lg text-orange-600">
                            <ListChecks size={20} />
                        </div>
                        <h3 className="font-black text-gray-800">📌 دسترسی سریع به تسک‌های گفتگو</h3>
                    </div>
                    <button 
                        onClick={() => {
                            if (confirm('آیا مایل به لغو نمایش تسک‌های گفتگو در داشبورد هستید؟ (همواره می‌توانید از انتهای این بخش مجدداً آن را فعال کنید)')) {
                                setShowTasksInDashboard(false);
                                localStorage.setItem('dashboard_show_chat_tasks', 'false');
                            }
                        }}
                        className="text-xs text-gray-400 hover:text-red-500 font-bold transition flex items-center gap-1 hover:bg-red-50 px-2.5 py-1.5 rounded-lg"
                        title="لغو نمایش تسک‌ها در داشبورد"
                    >
                        <X size={14}/> عدم نمایش در داشبورد
                    </button>
                </div>

                {taskGroups.length === 0 ? (
                    <div className="text-center text-gray-400 py-10 bg-white/30 rounded-xl border border-dashed">
                        <ListChecks size={36} className="mx-auto mb-2 opacity-20"/>
                        <p className="text-xs font-bold">شما در هیچ گروه تسک فعالی عضو نیستید.</p>
                        <p className="text-[10px] text-gray-400 mt-1">تسک‌ها پس از عضویت شما در گروه‌های تسک گفتگو در این بخش نمایش داده می‌شوند.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {taskGroups.map(group => {
                            const groupTasks = tasks.filter(t => t.groupId === group.id);
                            const pendingTasks = groupTasks.filter(t => t.status !== 'completed');
                            const completedTasks = groupTasks.filter(t => t.status === 'completed');

                            return (
                                <div key={group.id} className="glass-panel p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between min-h-[220px]">
                                    <div>
                                        <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800 mb-3">
                                            <h4 className="font-black text-sm text-gray-800 dark:text-gray-200">{group.name}</h4>
                                            <span className="bg-orange-50 text-orange-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                                                {pendingTasks.length} تسک فعال
                                            </span>
                                        </div>

                                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pl-1">
                                            {pendingTasks.length === 0 ? (
                                                <div className="text-center py-6 text-gray-400">
                                                    <p className="text-xs">تسک فعال و معلقی در این گروه وجود ندارد ✨</p>
                                                </div>
                                            ) : (
                                                pendingTasks.map(task => (
                                                    <div 
                                                        key={task.id} 
                                                        onClick={() => onGoToTaskGroup && onGoToTaskGroup(group.id, task.id)}
                                                        className="flex items-start gap-2.5 p-2 bg-white/60 dark:bg-gray-900/40 rounded-lg hover:bg-blue-50/50 dark:hover:bg-blue-950/20 hover:border-blue-200 border border-transparent transition cursor-pointer select-none"
                                                        title="کلیک برای انتقال به گفتگو و تسک‌های این گروه"
                                                    >
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const updatedTask = { 
                                                                    ...task, 
                                                                    status: 'completed' as const,
                                                                    completedBy: currentUser.username,
                                                                    completedAt: Date.now()
                                                                };
                                                                updateTask(updatedTask).then(() => {
                                                                    setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
                                                                });
                                                            }}
                                                            className="mt-0.5 rounded-full border-2 border-gray-300 dark:border-gray-700 w-5 h-5 flex items-center justify-center hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 text-slate-400 hover:text-green-600 transition shrink-0 cursor-pointer"
                                                            title="علامت‌گذاری به عنوان انجام شده"
                                                        >
                                                            <Check size={11} className="stroke-[3]" />
                                                        </button>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate" title={task.title}>{task.title}</p>
                                                            {task.assignedTo && task.assignedTo.length > 0 && (
                                                                <span className="text-[9px] text-blue-600 bg-blue-50 dark:bg-blue-950/20 px-1 py-0.5 rounded mt-1 inline-block font-semibold">ارجاع: @{task.assignedTo.join(', @')}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                                        <span className="text-[10px] text-gray-400 font-medium">{completedTasks.length} تسک انجام‌شده</span>
                                        {onGoToTaskGroup && (
                                            <button 
                                                onClick={() => onGoToTaskGroup(group.id)}
                                                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline transition-all"
                                            >
                                                <span>ورود به گفتگو و تسک‌ها</span>
                                                <ArrowUpRight size={14}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )}

        {/* NOTES PREVIEW SECTION - Google Keep Style Preview */}
        <div className="bg-yellow-50/50 rounded-2xl p-6 border border-yellow-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <Edit3 size={20} className="text-yellow-600" />
                    <h3 className="font-black text-gray-800">برنامه یادداشت و تسک</h3>
                </div>
                <button 
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('CHANGE_TAB', { detail: 'knowledge' }));
                    }}
                    className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg font-black hover:bg-yellow-200 transition-colors shadow-sm border border-yellow-200"
                >
                    بازکردن برنامه اصلی
                </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {notes.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-gray-400 text-sm border-2 border-dashed border-yellow-200 rounded-xl">
                        یادداشتی برای نمایش در پیشخوان وجود ندارد.
                    </div>
                ) : (
                    notes.slice(0, 4).map(note => (
                        <div 
                            key={note.id} 
                            onClick={() => window.dispatchEvent(new CustomEvent('CHANGE_TAB', { detail: 'knowledge' }))}
                            className={`${note.color || 'glass-panel'} p-4 rounded-xl border border-yellow-200 shadow-sm hover:shadow-md transition-all cursor-pointer relative group`}
                        >
                            <h4 className="font-bold text-gray-800 text-sm mb-2 truncate">{note.title || 'بدون عنوان'}</h4>
                            <div className="space-y-2">
                                {note.content && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">{note.content}</p>}
                                {note.tasks && note.tasks.length > 0 && (
                                    <div className="space-y-1 my-1">
                                        {note.tasks.slice(0, 3).map(task => (
                                            <div key={task.id} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                                {task.isCompleted ? <ListChecks size={10} className="text-blue-500"/> : <Clock size={10} className="text-gray-300"/>}
                                                <span className={task.isCompleted ? 'line-through opacity-50' : ''}>{task.text}</span>
                                            </div>
                                        ))}
                                        {note.tasks.length > 3 && <div className="text-[9px] text-gray-400">...</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* ACTIONABLE CARTABLE SECTION */}
        {showActionSection && (
            <div className="mb-8">
                <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
                    <ListChecks className="text-[#4b90ff]" /> 
                    <span>کارتابل و وظایف من</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {pendingPaymentCount > 0 && hasPaymentAccess && (
                        <div onClick={onGoToPaymentApprovals} className="bg-gradient-to-br from-[#4b90ff] to-[#7154ff] rounded-2xl p-6 text-white shadow-lg shadow-blue-500/10 cursor-pointer transform hover:scale-[1.03] hover:-translate-y-1 transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Banknote size={100}/></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl"><CheckSquare size={24} className="text-white"/></div>
                                    <span className="bg-[#ff4e6e] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full animate-pulse">{pendingPaymentCount} مورد</span>
                                </div>
                                <h3 className="text-xl font-black mb-1">تایید دستور پرداخت</h3>
                                <p className="text-blue-50 text-xs opacity-85">درخواست‌های منتظر تایید شما</p>
                            </div>
                        </div>
                    )}

                    {pendingExitCount > 0 && hasExitAccess && (
                        <div onClick={onGoToExitApprovals} className="bg-gradient-to-br from-[#ff6097] to-[#e0306c] rounded-2xl p-6 text-white shadow-lg shadow-pink-500/10 cursor-pointer transform hover:scale-[1.03] hover:-translate-y-1 transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Truck size={100}/></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl"><CheckSquare size={24} className="text-white"/></div>
                                    <span className="bg-zinc-900/60 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full animate-pulse">{pendingExitCount} مورد</span>
                                </div>
                                <h3 className="text-xl font-black mb-1">تایید مجوز خروج</h3>
                                <p className="text-rose-50 text-xs opacity-85">مجوزهای منتظر اقدام شما</p>
                            </div>
                        </div>
                    )}

                    {pendingBijakCount > 0 && hasWarehouseAccess && (
                        <div onClick={onGoToBijakApprovals} className="bg-gradient-to-br from-[#aa72ff] to-[#7f39f0] rounded-2xl p-6 text-white shadow-lg shadow-purple-500/10 cursor-pointer transform hover:scale-[1.03] hover:-translate-y-1 transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Package size={100}/></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl"><CheckSquare size={24} className="text-white"/></div>
                                    <span className="bg-[#ff4e6e] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full animate-pulse">{pendingBijakCount} مورد</span>
                                </div>
                                <h3 className="text-xl font-black mb-1">تایید تحویل بیجک</h3>
                                <p className="text-purple-50 text-xs opacity-85">اعلام بارهای خروجی (انتظامات)</p>
                            </div>
                        </div>
                    )}

                    {pendingPurchaseCount > 0 && hasPurchaseAccess && (
                        <div onClick={onGoToPurchaseApprovals} className="bg-gradient-to-br from-[#10b981] to-[#047857] rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/10 cursor-pointer transform hover:scale-[1.03] hover:-translate-y-1 transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Package size={100}/></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl"><CheckSquare size={24} className="text-white"/></div>
                                    <span className="bg-yellow-400 text-yellow-900 text-[11px] font-black px-2.5 py-0.5 rounded-full animate-pulse">{pendingPurchaseCount} مورد</span>
                                </div>
                                <h3 className="text-xl font-black mb-1">تایید درخواست خرید</h3>
                                <p className="text-emerald-50 text-xs opacity-85">درخواست‌های خرید منتظر اقدام</p>
                            </div>
                        </div>
                    )}

                    {pendingSecretariatCount > 0 && hasSecretariatAccess && (
                        <div onClick={() => window.dispatchEvent(new CustomEvent('CHANGE_TAB', { detail: 'secretariat' }))} className="bg-gradient-to-br from-[#f59e0b] to-[#d97706] rounded-2xl p-6 text-white shadow-lg shadow-amber-500/10 cursor-pointer transform hover:scale-[1.03] hover:-translate-y-1 transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><FileText size={100}/></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl"><CheckSquare size={24} className="text-white"/></div>
                                    <span className="bg-[#ff4e6e] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full animate-pulse">{pendingSecretariatCount} مورد</span>
                                </div>
                                <h3 className="text-xl font-black mb-1">کارتابل نامه‌ها</h3>
                                <p className="text-amber-50 text-xs opacity-85">نامه‌های اداری منتظر امضا/اقدام</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* PAYMENT DASHBOARD - ONLY IF ACCESS IS GRANTED */}
        {hasPaymentAccess && (
            <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {statusWidgets.map((widget) => (
                        <div key={widget.key} onClick={() => handleWidgetClick(widget.key === OrderStatus.APPROVED_CEO ? 'pending_all' : widget.key as any)} className={`glass-panel p-4 rounded-2xl border ${widget.border} shadow-sm transition-all relative overflow-hidden group cursor-pointer hover:shadow-md`}>
                            <div className={`absolute top-0 right-0 w-1.5 h-full ${widget.barColor}`}></div>
                            <div className="flex justify-between items-start mb-2">
                                <div className={`p-2 rounded-xl ${widget.bg} ${widget.color}`}>
                                    <widget.icon size={20} />
                                </div>
                                <span className="text-2xl font-black text-gray-800 font-mono">{widget.count}</span>
                            </div>
                            <h3 className="text-xs font-bold text-gray-500">{widget.label}</h3>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="glass-panel p-6 rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-sm flex flex-col">
                        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><PieChart size={20} className="text-blue-500"/> توزیع روش‌های پرداخت</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                    <Pie data={methodData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="amount">
                                        {methodData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Legend />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="glass-panel p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><BarChart size={20} className="text-indigo-500"/> پرداخت‌ها بر اساس بانک</h3>
                            <button onClick={() => setShowBankReport(true)} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition-colors">گزارش کامل</button>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsBarChart data={bankStats.slice(0, 5)}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{fontSize: 10}} />
                                    <YAxis tick={{fontSize: 10}} tickFormatter={(value) => `${value/1000000}M`} />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{fill: '#f3f4f6'}} />
                                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                                </RechartsBarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="glass-panel rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200/50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Activity size={20} className="text-orange-500"/> آخرین فعالیت‌ها (پرداخت)</h3>
                        {onViewArchive && <button onClick={onViewArchive} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">مشاهده آرشیو <ArrowUpRight size={14}/></button>}
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                        {activeCartable.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
                                <CheckCircle size={32} className="opacity-20"/>
                                موردی وجود ندارد.
                            </div>
                        ) : (
                            activeCartable.map(order => (
                                <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${order.status === OrderStatus.REJECTED ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {order.trackingNumber % 100}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800 text-sm">{order.payee}</div>
                                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                                <span>{new Date(order.date).toLocaleDateString('fa-IR')}</span>
                                                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                <span>{order.requester}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-gray-900 font-mono text-sm">{formatCurrency(order.totalAmount)}</div>
                                        <div className={`text-[10px] mt-1 px-2 py-0.5 rounded inline-block ${order.status === OrderStatus.PENDING ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>
                                            {order.status}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </>
        )}

        {/* QUICK ACCESS SQUARE TILES GRID */}
        <div className="glass-panel p-4 md:p-5 rounded-3xl border border-blue-100/80 shadow-sm bg-gradient-to-br from-white via-blue-50/20 to-indigo-50/20 dark:from-gray-800 dark:to-gray-900">
            <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping"></div>
                    <h3 className="font-black text-sm md:text-base text-gray-800 dark:text-gray-100">
                        کاشی‌های دسترسی سریع (Quick Access Tiles)
                    </h3>
                </div>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                    پیشنهادی موبایل و دسکتاپ
                </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2.5 md:gap-3">
                {quickTiles.map((tile) => (
                    <button
                        key={tile.id}
                        onClick={tile.onClick}
                        className="group relative flex flex-col items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700/60 shadow-sm hover:shadow-lg hover:border-blue-300 active:scale-95 transition-all aspect-square cursor-pointer"
                    >
                        {/* Pending Count Badge */}
                        {tile.count !== undefined && tile.count > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-bounce z-20">
                                {tile.count}
                            </span>
                        )}

                        {/* Top Category Badge / Pill */}
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/40 truncate max-w-full">
                            {tile.badge}
                        </span>

                        {/* Vibrant Gradient Icon Box */}
                        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br ${tile.gradient} text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform my-1`}>
                            <tile.icon size={20} className="sm:w-5 sm:h-5" />
                        </div>

                        {/* Title */}
                        <span className="text-[10px] sm:text-[11px] font-black text-gray-800 dark:text-gray-200 text-center leading-tight line-clamp-1">
                            {tile.title}
                        </span>
                    </button>
                ))}
            </div>
        </div>

        {/* Bank Report Modal */}
        {showBankReport && hasPaymentAccess && (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center p-4 animate-fade-in backdrop-blur-sm pt-10 md:pt-20">
                <div className="glass-panel rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Banknote size={20}/> گزارش تفصیلی بانک‌ها</h3>
                        <button onClick={() => setShowBankReport(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><XCircle size={20} className="text-gray-500"/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                        {bankReportTab === 'summary' ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="glass-panel p-4 rounded-xl border border-indigo-100 shadow-sm flex items-center gap-4">
                                        <div className="bg-indigo-100 p-3 rounded-full text-indigo-600"><TrendingUp size={24}/></div>
                                        <div><div className="text-xs text-gray-500 font-bold">پر تراکنش‌ترین بانک</div><div className="text-lg font-black text-gray-800">{topBank.name}</div><div className="text-xs text-indigo-600 font-mono">{formatCurrency(topBank.value)}</div></div>
                                    </div>
                                </div>
                                <div className="glass-panel rounded-xl border overflow-hidden">
                                    <table className="w-full text-sm text-right">
                                        <thead className="bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 text-gray-600"><tr><th className="p-3">نام بانک</th><th className="p-3">مجموع پرداختی</th><th className="p-3">درصد از کل</th></tr></thead>
                                        <tbody className="divide-y">
                                            {bankStats.map((bank, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="p-3 font-bold text-gray-800">{bank.name}</td>
                                                    <td className="p-3 font-mono text-gray-600">{formatCurrency(bank.value)}</td>
                                                    <td className="p-3 font-mono text-gray-500 dir-ltr">{((bank.value / totalAmount) * 100).toFixed(1)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div>گزارش زمانی (همانند قبل)</div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Announce Modal */}
        {showAnnounceModal && (
            <div className="fixed inset-0 z-[9999999] flex items-start justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in overflow-y-auto pt-10 md:pt-14">
                <div role="dialog" aria-label="ثبت اعلان" className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200 border border-white/20 relative mb-10">
                    <div className="p-5 border-b flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50 shrink-0">
                        <div className="flex items-center gap-3 text-indigo-800">
                            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-indigo-100">
                                <Activity size={20} className="text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="font-black text-lg">ثبت {announceType === 'task' ? 'تسک' : 'اعلامیه'} جدید</h3>
                                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider font-mono">Internal Communication</p>
                            </div>
                        </div>
                        <button onClick={() => setShowAnnounceModal(false)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all" data-close-modal="true" aria-label="بستن"><X size={24} strokeWidth={3} /></button>
                    </div>
                    <div className="p-4 flex flex-col gap-4">
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button onClick={() => setAnnounceType('announcement')} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${announceType === 'announcement' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>اعلامیه</button>
                            <button onClick={() => setAnnounceType('task')} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${announceType === 'task' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>تسک فردی</button>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">مخاطب (اختیاری - خالی برای همه)</label>
                            <select 
                                className="w-full border rounded-xl p-2.5 text-sm dir-rtl outline-none focus:ring-2 focus:ring-blue-100"
                                value={announceTarget}
                                onChange={(e) => setAnnounceTarget(e.target.value)}
                            >
                                <option value="">همه پرسنل</option>
                                {allUsers.map(u => (
                                    <option key={u.id} value={u.username}>{u.fullName || u.username}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-gray-400 mt-1">اگر کاربری را انتخاب کنید، پیام فقط برای او نمایش داده می‌شود.</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">متن پیام</label>
                            <textarea 
                                className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                                rows={4}
                                value={announceText}
                                onChange={(e) => setAnnounceText(e.target.value)}
                                placeholder="موضوع مورد نظر خود را بنویسید..."
                            ></textarea>
                        </div>
                    </div>
                    <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                        <button onClick={() => setShowAnnounceModal(false)} className="px-4 py-2 text-gray-600 text-sm font-bold hover:bg-gray-200 rounded-xl transition-colors">انصراف</button>
                        <button onClick={handleCreateAnnouncement} disabled={!announceText.trim()} className="px-5 py-2 bg-blue-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 transition-colors flex items-center gap-2">
                            <Send size={16}/> انتشار پیام
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Dashboard;
