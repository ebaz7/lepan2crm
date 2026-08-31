import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TradeRecord, TradeComment, SystemSettings } from '../../types';
import { formatCurrency, formatNumberString, getStatusLabel } from '../../constants';

const CURRENCIES = [
    { code: 'EUR', label: 'یورو (€)' },
    { code: 'USD', label: 'دلار ($)' },
    { code: 'AED', label: 'درهم (AED)' },
    { code: 'CNY', label: 'یوآن (¥)' },
    { code: 'TRY', label: 'لیر (₺)' },
    { code: 'CHF', label: 'فرانک (CHF)' },
    { code: 'RUB', label: 'روبل (₽)' },
    { code: 'INR', label: 'روپیه (₹)' },
];
import { 
    Search, Filter, ArrowUpDown, MessageSquare, Send, Eye, Printer, 
    FileDown, X, ChevronDown, ChevronUp, CheckCircle2, Clock, 
    AlertCircle, Building2, Package, ShieldCheck, Coins, FileText, 
    Truck, Award, Layers, Hash, Calendar, ArrowRightLeft, Sparkles,
    User, Bell, Check, RefreshCw
} from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator';
import { sendNotification } from '../../services/notificationService';
import { apiCall } from '../../services/apiService';

interface Props {
    records: TradeRecord[];
    currentUser?: any;
    settings?: SystemSettings;
    onUpdateRecord: (record: TradeRecord) => Promise<void>;
    onNavigateToDetails?: (record: TradeRecord, tab?: string) => void;
}

export const GeneralTradeListReport: React.FC<Props> = ({
    records,
    currentUser,
    settings,
    onUpdateRecord,
    onNavigateToDetails
}) => {
    // Search and Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCompany, setFilterCompany] = useState('');
    const [filterAllocationType, setFilterAllocationType] = useState('');
    const [filterQueueStatus, setFilterQueueStatus] = useState(''); // all, in_queue, allocated
    const [filterCurrencyPurchase, setFilterCurrencyPurchase] = useState(''); // all, purchased, purchasing, not_purchased
    const [filterStage, setFilterStage] = useState('');
    const [filterBank, setFilterBank] = useState('');
    const [filterTransitStatus, setFilterTransitStatus] = useState(''); // all, in_transit, in_customs, completed

    // Sorting
    const [sortBy, setSortBy] = useState<'amount_desc' | 'amount_asc' | 'weight_desc' | 'weight_asc' | 'date_desc' | 'date_asc' | 'order_no' | 'company'>('date_desc');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Journey / Details Modal State
    const [selectedRecordForJourney, setSelectedRecordForJourney] = useState<TradeRecord | null>(null);
    const [activeJourneySection, setActiveJourneySection] = useState<'timeline' | 'proforma' | 'insurance' | 'allocation' | 'currency' | 'shipping' | 'customs' | 'comments'>('timeline');

    // Comment State
    const [newCommentText, setNewCommentText] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [quickCommentRecord, setQuickCommentRecord] = useState<TradeRecord | null>(null);

    // Print & PDF
    const [isPrinting, setIsPrinting] = useState(false);
    const printContainerRef = useRef<HTMLDivElement>(null);

    // Helper: Calculate total weight (in kg)
    const calculateTotalWeight = (r: TradeRecord): number => {
        return r.items?.reduce((sum, item) => sum + (Number(item.weight) || 0), 0) || 0;
    };

    // Helper: Calculate total amount
    const calculateTotalAmount = (r: TradeRecord): number => {
        return r.items?.reduce((sum, item) => {
            const totalPrice = item.totalPrice !== undefined ? Number(item.totalPrice) : (Number(item.weight || 0) * Number(item.unitPrice || 0));
            return sum + (totalPrice || 0);
        }, 0) || 0;
    };

    // Helper: Formatted weight & goods description e.g. "۲۵۰ تن چیپس پلی استر نساجی"
    const formatGoodsWithWeight = (r: TradeRecord): string => {
        const weightKg = calculateTotalWeight(r);
        const goodsName = r.goodsName || 'کالا';
        if (weightKg <= 0) return goodsName;
        
        if (weightKg >= 1000) {
            const ton = weightKg / 1000;
            const tonStr = Number.isInteger(ton) ? ton.toLocaleString('fa-IR') : ton.toLocaleString('fa-IR', { maximumFractionDigits: 2 });
            return `${tonStr} تن ${goodsName}`;
        }
        return `${weightKg.toLocaleString('fa-IR')} کیلوگرم ${goodsName}`;
    };

    // Helper: Get Active Stage Name & Color
    const getRecordStageInfo = (r: TradeRecord): { label: string; color: string; stepNumber: number } => {
        if (r.status === 'Completed') return { label: 'ترخیص و تحویل نهایی', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800', stepNumber: 8 };
        if (r.isInCustoms) return { label: 'بار در گمرک / ترخیص', color: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800', stepNumber: 7 };
        if (r.isInTransit) return { label: 'بار در راه (ترانزیت)', color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800', stepNumber: 6 };
        
        // Currency Purchase Check
        const totalPurchased = (r.currencyPurchaseData?.tranches || []).reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalProforma = calculateTotalAmount(r);
        if (totalPurchased > 0) {
            if (totalProforma > 0 && totalPurchased >= totalProforma) {
                return { label: 'خرید ارز تکمیل شده', color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800', stepNumber: 5 };
            }
            return { label: 'در حال خرید ارز / پارت‌بندی', color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800', stepNumber: 5 };
        }

        // Allocation Check
        if (r.currencyPurchaseData?.allocationDate) {
            return { label: 'ارز تخصیص یافته', color: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800', stepNumber: 4 };
        }
        if (r.currencyPurchaseData?.queueEntryDate) {
            return { label: 'در صف تخصیص ارز', color: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800', stepNumber: 4 };
        }

        // Insurance Check
        if (r.insuranceData?.policyNumber) {
            return { label: 'بیمه ثبت شده', color: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800', stepNumber: 3 };
        }

        // Registration Check
        if (r.registrationNumber) {
            return { label: 'ثبت سفارش انجام شده', color: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800', stepNumber: 2 };
        }

        return { label: 'پروفرما اولیه', color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700', stepNumber: 1 };
    };

    // Filter & Sort Logic
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            // Text Search
            if (searchTerm.trim()) {
                const term = searchTerm.trim().toLowerCase();
                const goods = (r.goodsName || '').toLowerCase();
                const company = (r.company || '').toLowerCase();
                const seller = (r.sellerName || '').toLowerCase();
                const orderNo = (r.orderNumber || '').toLowerCase();
                const regNo = (r.registrationNumber || '').toLowerCase();
                const fileNo = (r.fileNumber || '').toLowerCase();
                const proformaNo = (r.proformaNumber || '').toLowerCase();
                const commentsText = (r.comments || []).map(c => c.text.toLowerCase()).join(' ');

                const match = goods.includes(term) ||
                    company.includes(term) ||
                    seller.includes(term) ||
                    orderNo.includes(term) ||
                    regNo.includes(term) ||
                    fileNo.includes(term) ||
                    proformaNo.includes(term) ||
                    commentsText.includes(term);

                if (!match) return false;
            }

            // Company Filter
            if (filterCompany && r.company !== filterCompany) return false;

            // Allocation Type Filter
            if (filterAllocationType && r.currencyAllocationType !== filterAllocationType) return false;

            // Queue Status Filter
            if (filterQueueStatus === 'in_queue' && !r.currencyPurchaseData?.queueEntryDate) return false;
            if (filterQueueStatus === 'allocated' && !r.currencyPurchaseData?.allocationDate) return false;

            // Currency Purchase Status Filter
            const purchasedAmt = (r.currencyPurchaseData?.tranches || []).reduce((sum, t) => sum + (t.amount || 0), 0);
            const totalAmt = calculateTotalAmount(r);
            if (filterCurrencyPurchase === 'purchased' && (purchasedAmt === 0 || (totalAmt > 0 && purchasedAmt < totalAmt))) return false;
            if (filterCurrencyPurchase === 'purchasing' && (purchasedAmt === 0 || (totalAmt > 0 && purchasedAmt >= totalAmt))) return false;
            if (filterCurrencyPurchase === 'not_purchased' && purchasedAmt > 0) return false;

            // Bank Filter
            if (filterBank && r.operatingBank !== filterBank) return false;

            // Transit Status Filter
            if (filterTransitStatus === 'in_transit' && !r.isInTransit) return false;
            if (filterTransitStatus === 'in_customs' && !r.isInCustoms) return false;
            if (filterTransitStatus === 'completed' && r.status !== 'Completed') return false;

            // Stage Filter
            if (filterStage) {
                const stageInfo = getRecordStageInfo(r);
                if (filterStage === 'proforma' && stageInfo.stepNumber !== 1) return false;
                if (filterStage === 'registration' && stageInfo.stepNumber !== 2) return false;
                if (filterStage === 'insurance' && stageInfo.stepNumber !== 3) return false;
                if (filterStage === 'allocation' && stageInfo.stepNumber !== 4) return false;
                if (filterStage === 'currency' && stageInfo.stepNumber !== 5) return false;
                if (filterStage === 'shipping' && stageInfo.stepNumber !== 6) return false;
                if (filterStage === 'customs' && stageInfo.stepNumber !== 7) return false;
                if (filterStage === 'completed' && stageInfo.stepNumber !== 8) return false;
            }

            return true;
        }).sort((a, b) => {
            const amountA = calculateTotalAmount(a);
            const amountB = calculateTotalAmount(b);
            const weightA = calculateTotalWeight(a);
            const weightB = calculateTotalWeight(b);
            const dateA = a.createdAt || (a.startDate ? new Date(a.startDate).getTime() : 0);
            const dateB = b.createdAt || (b.startDate ? new Date(b.startDate).getTime() : 0);

            switch (sortBy) {
                case 'amount_desc': return amountB - amountA;
                case 'amount_asc': return amountA - amountB;
                case 'weight_desc': return weightB - weightA;
                case 'weight_asc': return weightA - weightB;
                case 'date_desc': return dateB - dateA;
                case 'date_asc': return dateA - dateB;
                case 'order_no': return (a.orderNumber || a.fileNumber || '').localeCompare(b.orderNumber || b.fileNumber || '');
                case 'company': return (a.company || '').localeCompare(b.company || '');
                default: return dateB - dateA;
            }
        });
    }, [
        records, searchTerm, filterCompany, filterAllocationType, 
        filterQueueStatus, filterCurrencyPurchase, filterStage, 
        filterBank, filterTransitStatus, sortBy
    ]);

    // KPI Metrics
    const metrics = useMemo(() => {
        let totalWeightKg = 0;
        const currencyTotals: Record<string, number> = {};

        filteredRecords.forEach(r => {
            totalWeightKg += calculateTotalWeight(r);
            const curr = r.mainCurrency || 'USD';
            const amt = calculateTotalAmount(r);
            currencyTotals[curr] = (currencyTotals[curr] || 0) + amt;
        });

        const totalTons = totalWeightKg / 1000;

        return {
            totalCount: filteredRecords.length,
            totalTons: totalTons.toLocaleString('fa-IR', { maximumFractionDigits: 1 }),
            totalWeightKg: totalWeightKg.toLocaleString('fa-IR'),
            currencyTotals
        };
    }, [filteredRecords]);

    // Available Companies and Banks
    const companies = useMemo(() => {
        const set = new Set<string>();
        records.forEach(r => { if (r.company) set.add(r.company); });
        if (settings?.companyNames) settings.companyNames.forEach(c => set.add(c));
        return Array.from(set).sort();
    }, [records, settings]);

    const operatingBanks = useMemo(() => {
        const set = new Set<string>();
        records.forEach(r => { if (r.operatingBank) set.add(r.operatingBank); });
        if (settings?.operatingBankNames) settings.operatingBankNames.forEach(b => set.add(b));
        return Array.from(set).sort();
    }, [records, settings]);

    // Add Comment & Broadcast Notification
    const handleAddComment = async (record: TradeRecord, text: string) => {
        if (!text.trim()) return;
        setIsSubmittingComment(true);

        const newComment: TradeComment = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            text: text.trim(),
            createdAt: Date.now(),
            createdBy: currentUser?.username || 'user',
            creatorName: currentUser?.fullName || 'کاربر سیستم',
            role: currentUser?.role || 'کارشناس بازرگانی'
        };

        const existingComments = record.comments || [];
        const updatedComments = [...existingComments, newComment];
        const updatedRecord: TradeRecord = {
            ...record,
            comments: updatedComments
        };

        try {
            await onUpdateRecord(updatedRecord);
            
            // If in journey modal, update the active state
            if (selectedRecordForJourney?.id === record.id) {
                setSelectedRecordForJourney(updatedRecord);
            }
            if (quickCommentRecord?.id === record.id) {
                setQuickCommentRecord(updatedRecord);
            }
            setNewCommentText('');

            // 1. In-App Broadcast & Push Notification to Commerce, Management, and Finance Teams
            const proformaIdentifier = updatedRecord.proformaNumber || updatedRecord.orderNumber || updatedRecord.fileNumber;
            const notifTitle = `💬 یادداشت جدید روی پرونده بازرگانی (${proformaIdentifier})`;
            const notifBody = `${currentUser?.fullName || 'همکار'}: ${text.trim().substring(0, 85)}`;

            try {
                await apiCall('/api/notifications/add', 'POST', {
                    title: notifTitle,
                    body: notifBody,
                    url: '/trade',
                    targetRoles: ['COMMERCE', 'CEO', 'MANAGER', 'FINANCE', 'ADMIN'],
                    excludeUsernames: currentUser?.username ? [currentUser.username] : []
                });
            } catch (err) {
                console.warn('Could not post notification to /api/notifications/add:', err);
            }

            // Local browser notification if allowed
            await sendNotification(notifTitle, notifBody, {
                id: `trade_comment_${newComment.id}`,
                recordId: record.id
            });

        } catch (e) {
            console.error('Error adding trade comment:', e);
            alert('خطا در ثبت یادداشت. لطفاً دوباره تلاش کنید.');
        } finally {
            setIsSubmittingComment(false);
        }
    };

    // Print & PDF Handler
    const handleDownloadReportPDF = async () => {
        setIsPrinting(true);
        await generatePdf({
            elementId: 'general-trade-list-printable',
            filename: `گزارش_جامع_پرونده_های_بازرگانی_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.pdf`,
            format: 'A4',
            orientation: 'landscape',
            onComplete: () => setIsPrinting(false),
            onError: () => { alert('خطا در صدور فایل PDF'); setIsPrinting(false); }
        });
    };

    const handlePrintReport = () => {
        setIsPrinting(true);
        setTimeout(() => {
            window.print();
            setIsPrinting(false);
        }, 300);
    };

    return (
        <div className="space-y-4 text-right dir-rtl font-sans pb-12">
            
            {/* TOP KPI BAR */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="glass-panel p-3.5 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 shadow-xs flex flex-col justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">تعداد کل پرونده‌ها</span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-black text-gray-900 dark:text-gray-100 font-mono">{metrics.totalCount}</span>
                        <span className="text-xs text-gray-400">مورد</span>
                    </div>
                </div>

                <div className="glass-panel p-3.5 rounded-2xl border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs flex flex-col justify-between">
                    <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">مجموع وزن و تناژ کالاها</span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-black text-blue-900 dark:text-blue-100 font-mono">{metrics.totalTons}</span>
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">تن</span>
                    </div>
                </div>

                <div className="col-span-2 glass-panel p-3.5 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs flex flex-col justify-between">
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">مجموع مبالغ بر اساس ارزهای پایه</span>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                        {Object.keys(metrics.currencyTotals).length === 0 ? (
                            <span className="text-xs text-gray-400 font-mono">---</span>
                        ) : (
                            Object.entries(metrics.currencyTotals).map(([currency, total]) => (
                                <div key={currency} className="bg-white/80 dark:bg-gray-800/80 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1.5 shadow-2xs">
                                    <span className="font-mono font-black text-sm text-emerald-800 dark:text-emerald-200">{formatNumberString(total)}</span>
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{currency}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* FILTER & CONTROL TOOLBAR */}
            <div className="glass-panel p-4 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs space-y-3">
                <div className="flex flex-wrap gap-2.5 items-center justify-between">
                    
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[220px]">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="جستجوی کالا، شماره سفارش، ثبت سفارش، پروفرما، فروشنده، کامنت..."
                            className="w-full bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-xl pr-9 pl-4 py-2.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                        />
                        <Search size={16} className="absolute right-3 top-3 text-gray-400" />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute left-3 top-3 text-gray-400 hover:text-red-500">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Company Dropdown */}
                    <select
                        value={filterCompany}
                        onChange={e => setFilterCompany(e.target.value)}
                        className="bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-xs text-gray-800 dark:text-gray-200 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 min-w-[140px]"
                    >
                        <option value="">همه شرکت‌ها</option>
                        {companies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    {/* Sort Selector */}
                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1.5">
                        <ArrowUpDown size={14} className="text-gray-400 shrink-0" />
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as any)}
                            className="bg-transparent border-none text-xs text-gray-800 dark:text-gray-200 font-medium focus:outline-hidden cursor-pointer"
                        >
                            <option value="date_desc">جدیدترین پرونده‌ها</option>
                            <option value="date_asc">قدیمی‌ترین پرونده‌ها</option>
                            <option value="amount_desc">مبلغ کل (بیشترین به کمترین)</option>
                            <option value="amount_asc">مبلغ کل (کمترین به بیشترین)</option>
                            <option value="weight_desc">وزن کالا (سنگین‌ترین به سبک‌ترین)</option>
                            <option value="weight_asc">وزن کالا (سبک‌ترین به سنگین‌ترین)</option>
                            <option value="order_no">بر اساس شماره سفارش / پرونده</option>
                            <option value="company">بر اساس نام شرکت</option>
                        </select>
                    </div>

                    {/* Advanced Filter Toggle */}
                    <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                            showAdvancedFilters 
                                ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800' 
                                : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/70 dark:text-gray-300 dark:border-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        <Filter size={14} />
                        فیلترهای پیشرفته
                        {showAdvancedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {/* Print and PDF Buttons */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handlePrintReport}
                            className="flex items-center gap-1 px-3 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all shadow-2xs"
                            title="چاپ گزارش"
                        >
                            <Printer size={14} />
                            <span className="hidden sm:inline">چاپ</span>
                        </button>
                        <button
                            onClick={handleDownloadReportPDF}
                            disabled={isPrinting}
                            className="flex items-center gap-1 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                            title="خروجی PDF"
                        >
                            <FileDown size={14} />
                            <span>PDF</span>
                        </button>
                    </div>
                </div>

                {/* ADVANCED FILTER COLLAPSIBLE PANEL */}
                {showAdvancedFilters && (
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 animate-fade-in text-xs">
                        
                        {/* Allocation Type */}
                        <div>
                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">نوع تخصیص ارز</label>
                            <select
                                value={filterAllocationType}
                                onChange={e => setFilterAllocationType(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-gray-800 dark:text-gray-200"
                            >
                                <option value="">همه انواع</option>
                                <option value="Bank">بانکی</option>
                                <option value="Export">ارز حاصل از صادرات خود</option>
                                <option value="ExportOther">ارز حاصل از صادرات دیگران</option>
                                <option value="Free">متقاضی (آزاد)</option>
                            </select>
                        </div>

                        {/* Queue Status */}
                        <div>
                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">وضعیت صف تخصیص</label>
                            <select
                                value={filterQueueStatus}
                                onChange={e => setFilterQueueStatus(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-gray-800 dark:text-gray-200"
                            >
                                <option value="">همه وضعیت‌ها</option>
                                <option value="in_queue">در صف تخصیص ارز</option>
                                <option value="allocated">تخصیص یافته</option>
                            </select>
                        </div>

                        {/* Currency Purchase */}
                        <div>
                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">وضعیت خرید ارز</label>
                            <select
                                value={filterCurrencyPurchase}
                                onChange={e => setFilterCurrencyPurchase(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-gray-800 dark:text-gray-200"
                            >
                                <option value="">همه وضعیت‌ها</option>
                                <option value="purchased">خرید تکمیل شده</option>
                                <option value="purchasing">در حال خرید پارت‌ها</option>
                                <option value="not_purchased">خرید انجام‌نشده</option>
                            </select>
                        </div>

                        {/* Stage */}
                        <div>
                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">مرحله فرآیند</label>
                            <select
                                value={filterStage}
                                onChange={e => setFilterStage(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-gray-800 dark:text-gray-200"
                            >
                                <option value="">همه مراحل</option>
                                <option value="proforma">پروفرما اولیه</option>
                                <option value="registration">ثبت سفارش</option>
                                <option value="insurance">بیمه</option>
                                <option value="allocation">تخصیص ارز</option>
                                <option value="currency">خرید ارز</option>
                                <option value="shipping">بار در راه (ترانزیت)</option>
                                <option value="customs">گمرک و ترخیص</option>
                                <option value="completed">تکمیل شده</option>
                            </select>
                        </div>

                        {/* Bank */}
                        <div>
                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">بانک عامل</label>
                            <select
                                value={filterBank}
                                onChange={e => setFilterBank(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-gray-800 dark:text-gray-200"
                            >
                                <option value="">همه بانک‌ها</option>
                                {operatingBanks.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>

                        {/* Reset Filters */}
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterCompany('');
                                    setFilterAllocationType('');
                                    setFilterQueueStatus('');
                                    setFilterCurrencyPurchase('');
                                    setFilterStage('');
                                    setFilterBank('');
                                    setFilterTransitStatus('');
                                }}
                                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                            >
                                <RefreshCw size={12} />
                                بازنشانی فیلترها
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* MAIN REPORT TABLE */}
            <div className="glass-panel rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs border-collapse">
                        <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 font-bold select-none">
                            <tr>
                                <th className="p-3.5 text-center w-12">ردیف</th>
                                <th className="p-3.5 min-w-[200px]">کالا و مقدار (وزن + شرح)</th>
                                <th className="p-3.5 min-w-[110px] text-center">شماره سفارش</th>
                                <th className="p-3.5 min-w-[120px] text-center">شماره ثبت سفارش</th>
                                <th className="p-3.5 min-w-[110px] text-center">شماره پروفرم</th>
                                <th className="p-3.5 min-w-[130px]">نام شرکت</th>
                                <th className="p-3.5 min-w-[130px] text-center">مبلغ و نوع ارز</th>
                                <th className="p-3.5 min-w-[140px] text-center">وضعیت فرآیند</th>
                                <th className="p-3.5 min-w-[180px]">ملاحظات (آخرین کامنت)</th>
                                <th className="p-3.5 min-w-[100px] text-center">عملیات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-800 dark:text-gray-200">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-12 text-center text-gray-400 dark:text-gray-500">
                                        <Package size={36} className="mx-auto mb-2 opacity-40" />
                                        <span>پرونده‌ای با این مشخصات یافت نشد.</span>
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((record, index) => {
                                    const stageInfo = getRecordStageInfo(record);
                                    const totalAmount = calculateTotalAmount(record);
                                    const formattedGoodsWeight = formatGoodsWithWeight(record);
                                    const latestComment = record.comments && record.comments.length > 0
                                        ? record.comments[record.comments.length - 1]
                                        : null;

                                    return (
                                        <tr
                                            key={record.id}
                                            onClick={() => setSelectedRecordForJourney(record)}
                                            className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer transition-colors group"
                                        >
                                            {/* 1. Row Index */}
                                            <td className="p-3.5 text-center font-mono text-gray-400 group-hover:text-blue-600 font-bold">
                                                {(index + 1).toLocaleString('fa-IR')}
                                            </td>

                                            {/* 2. Weight + Description (e.g. 250 تن چیپس پلی استر نساجی) */}
                                            <td className="p-3.5">
                                                <div className="font-bold text-gray-900 dark:text-gray-100 text-[13px] line-clamp-2">
                                                    {formattedGoodsWeight}
                                                </div>
                                                {record.sellerName && (
                                                    <div className="text-[11px] text-gray-400 mt-0.5">
                                                        فروشنده: <span className="text-gray-600 dark:text-gray-300">{record.sellerName}</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* 3. Order Number */}
                                            <td className="p-3.5 text-center">
                                                {record.orderNumber ? (
                                                    <span className="font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-lg border border-blue-200/60 dark:border-blue-900/40 text-[11px]">
                                                        {record.orderNumber}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 font-mono">-</span>
                                                )}
                                            </td>

                                            {/* 4. Registration Number (شماره ثبت سفارش) */}
                                            <td className="p-3.5 text-center">
                                                {record.registrationNumber ? (
                                                    <span className="font-mono font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg text-[11px]">
                                                        {record.registrationNumber}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 font-mono">-</span>
                                                )}
                                            </td>

                                            {/* 5. Proforma / File Number */}
                                            <td className="p-3.5 text-center">
                                                <span className="font-mono text-gray-700 dark:text-gray-300 text-[11px]">
                                                    {record.proformaNumber || record.fileNumber || '-'}
                                                </span>
                                            </td>

                                            {/* 6. Company Name */}
                                            <td className="p-3.5">
                                                <span className="font-bold text-gray-800 dark:text-gray-200">
                                                    {record.company}
                                                </span>
                                            </td>

                                            {/* 7. Amount & Currency */}
                                            <td className="p-3.5 text-center">
                                                <div className="font-mono font-black text-gray-900 dark:text-gray-100 text-sm">
                                                    {formatNumberString(totalAmount)}
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase">
                                                    {record.mainCurrency || 'USD'}
                                                </div>
                                            </td>

                                            {/* 8. Process Stage & Status */}
                                            <td className="p-3.5 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${stageInfo.color}`}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                                    {stageInfo.label}
                                                </span>
                                            </td>

                                            {/* 9. Remarks & Latest Comment */}
                                            <td className="p-3.5" onClick={e => e.stopPropagation()}>
                                                {latestComment ? (
                                                    <div
                                                        onClick={() => {
                                                            setSelectedRecordForJourney(record);
                                                            setActiveJourneySection('comments');
                                                        }}
                                                        className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100/70 transition-all cursor-pointer group/comment"
                                                        title="برای مشاهده تمام یادداشت‌ها کلیک کنید"
                                                    >
                                                        <div className="flex items-center justify-between text-[10px] text-amber-700 dark:text-amber-400 mb-0.5 font-bold">
                                                            <span className="flex items-center gap-1">
                                                                <MessageSquare size={10} />
                                                                {latestComment.creatorName || latestComment.createdBy}
                                                            </span>
                                                            <span className="font-mono text-[9px]">
                                                                {new Date(latestComment.createdAt).toLocaleDateString('fa-IR')}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] font-medium line-clamp-1 text-gray-700 dark:text-gray-300">
                                                            {latestComment.text}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setQuickCommentRecord(record);
                                                            setNewCommentText('');
                                                        }}
                                                        className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded-lg border border-dashed border-gray-200 dark:border-gray-800 hover:border-blue-300 transition-colors"
                                                    >
                                                        <MessageSquare size={12} />
                                                        <span>+ ثبت ملاحظات</span>
                                                    </button>
                                                )}
                                            </td>

                                            {/* 10. Actions / Journey Button */}
                                            <td className="p-3.5 text-center" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => setSelectedRecordForJourney(record)}
                                                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-600 text-blue-700 dark:text-blue-300 hover:text-white rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800 transition-all shadow-2xs mx-auto"
                                                    title="مشاهده روند کامل پرونده از صفر تا صد"
                                                >
                                                    <Eye size={13} />
                                                    <span>روند کامل</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* QUICK COMMENT MODAL */}
            {quickCommentRecord && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-800 text-right animate-scale-in" dir="rtl">
                        <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-100 dark:border-gray-800">
                            <div>
                                <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <MessageSquare size={18} className="text-blue-600" />
                                    ثبت یادداشت و ملاحظات
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    پرونده: {quickCommentRecord.proformaNumber || quickCommentRecord.orderNumber || quickCommentRecord.fileNumber} - {quickCommentRecord.goodsName}
                                </p>
                            </div>
                            <button onClick={() => setQuickCommentRecord(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                                <X size={20} className="text-gray-400 hover:text-red-500" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <textarea
                                value={newCommentText}
                                onChange={e => setNewCommentText(e.target.value)}
                                placeholder="متن ملاحظات یا پیام خود را بنویسید (با ثبت، به تیم بازرگانی و مدیریت نوتیفیکیشن ارسال می‌شود)..."
                                className="w-full h-32 border border-gray-300 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 outline-hidden transition-all"
                            />

                            <div className="flex items-center justify-between pt-2">
                                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                    <Bell size={12} className="text-amber-500" />
                                    ارسال اعلان خودکار به تیم
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setQuickCommentRecord(null)}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-200"
                                    >
                                        انصراف
                                    </button>
                                    <button
                                        onClick={async () => {
                                            await handleAddComment(quickCommentRecord, newCommentText);
                                            setQuickCommentRecord(null);
                                        }}
                                        disabled={!newCommentText.trim() || isSubmittingComment}
                                        className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all shadow-xs"
                                    >
                                        <Send size={13} />
                                        <span>ثبت و ارسال</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* COMPREHENSIVE END-TO-END JOURNEY MODAL (از ابتدا تا انتهای روند پرونده) */}
            {selectedRecordForJourney && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex items-center justify-center p-3 md:p-6 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-gray-200 dark:border-gray-800 text-right overflow-hidden animate-scale-in my-auto" dir="rtl">
                        
                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-black text-gray-900 dark:text-gray-100">
                                        شناسنامه و روند جامع پرونده بازرگانی
                                    </h2>
                                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
                                        {selectedRecordForJourney.company}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    کالا: <strong className="text-gray-800 dark:text-gray-200">{formatGoodsWithWeight(selectedRecordForJourney)}</strong> | فروشنده: {selectedRecordForJourney.sellerName || '-'}
                                </p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                {onNavigateToDetails && (
                                    <button
                                        onClick={() => {
                                            const rec = selectedRecordForJourney;
                                            setSelectedRecordForJourney(null);
                                            onNavigateToDetails(rec, 'proforma');
                                        }}
                                        className="px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
                                    >
                                        ویرایش در ماژول بازرگانی
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedRecordForJourney(null)}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <X size={22} />
                                </button>
                            </div>
                        </div>

                        {/* Top Key Specs Summary Grid */}
                        <div className="p-4 bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs shrink-0">
                            <div>
                                <span className="text-gray-400 block text-[11px]">شماره سفارش:</span>
                                <span className="font-bold font-mono text-blue-700 dark:text-blue-300">{selectedRecordForJourney.orderNumber || '-'}</span>
                            </div>
                            <div>
                                <span className="text-gray-400 block text-[11px]">شماره ثبت سفارش:</span>
                                <span className="font-bold font-mono text-gray-800 dark:text-gray-200">{selectedRecordForJourney.registrationNumber || '-'}</span>
                            </div>
                            <div>
                                <span className="text-gray-400 block text-[11px]">شماره پروفرم:</span>
                                <span className="font-bold font-mono text-gray-800 dark:text-gray-200">{selectedRecordForJourney.proformaNumber || selectedRecordForJourney.fileNumber || '-'}</span>
                            </div>
                            <div>
                                <span className="text-gray-400 block text-[11px]">شماره پرونده:</span>
                                <span className="font-bold font-mono text-gray-800 dark:text-gray-200">{selectedRecordForJourney.fileNumber || '-'}</span>
                            </div>
                            <div>
                                <span className="text-gray-400 block text-[11px]">مبلغ کل:</span>
                                <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300">
                                    {formatNumberString(calculateTotalAmount(selectedRecordForJourney))} {selectedRecordForJourney.mainCurrency}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-400 block text-[11px]">بانک عامل:</span>
                                <span className="font-bold text-gray-800 dark:text-gray-200">{selectedRecordForJourney.operatingBank || '-'}</span>
                            </div>
                        </div>

                        {/* Navigation Tabs for Journey Sections */}
                        <div className="flex gap-2 p-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto text-xs font-bold shrink-0">
                            <button
                                onClick={() => setActiveJourneySection('timeline')}
                                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${activeJourneySection === 'timeline' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            >
                                🗺️ تایم‌لاین کامل فرآیند (۸ گام)
                            </button>
                            <button
                                onClick={() => setActiveJourneySection('proforma')}
                                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${activeJourneySection === 'proforma' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            >
                                📄 اقلام و پروفرما
                            </button>
                            <button
                                onClick={() => setActiveJourneySection('insurance')}
                                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${activeJourneySection === 'insurance' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            >
                                📑 بیمه باربری و نمایندگی
                            </button>
                            <button
                                onClick={() => setActiveJourneySection('allocation')}
                                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${activeJourneySection === 'allocation' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            >
                                ⏳ صف و تخصیص ارز
                            </button>
                            <button
                                onClick={() => setActiveJourneySection('currency')}
                                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${activeJourneySection === 'currency' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            >
                                💰 خرید ارز و پارت‌ها
                            </button>
                            <button
                                onClick={() => setActiveJourneySection('comments')}
                                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap relative ${activeJourneySection === 'comments' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            >
                                💬 گفتگو و ملاحظات
                                {selectedRecordForJourney.comments && selectedRecordForJourney.comments.length > 0 && (
                                    <span className="mr-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                                        {selectedRecordForJourney.comments.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Modal Body (Scrollable) */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            
                            {/* SECTION 1: FULL 8-STAGE TIMELINE */}
                            {activeJourneySection === 'timeline' && (
                                <div className="space-y-6">
                                    <div className="relative border-r-2 border-blue-500/30 pr-6 mr-3 space-y-8">
                                        
                                        {/* Step 1: Proforma */}
                                        <div className="relative">
                                            <div className="absolute -right-[31px] top-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-md">
                                                ۱
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                                                        <FileText size={16} className="text-blue-600" />
                                                        گام اول: پروفرما و مشخصات کالا
                                                    </h4>
                                                    <span className="text-xs text-gray-400 font-mono">
                                                        تاریخ شروع: {selectedRecordForJourney.startDate ? new Date(selectedRecordForJourney.startDate).toLocaleDateString('fa-IR') : '-'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-600 dark:text-gray-300">
                                                    کالا: <strong>{formatGoodsWithWeight(selectedRecordForJourney)}</strong> | اقلام: {selectedRecordForJourney.items?.length || 0} قلم کالا | ارزش کل: {formatNumberString(calculateTotalAmount(selectedRecordForJourney))} {selectedRecordForJourney.mainCurrency}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Step 2: Registration */}
                                        <div className="relative">
                                            <div className={`absolute -right-[31px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md ${selectedRecordForJourney.registrationNumber ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                                ۲
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                                                        <Award size={16} className="text-emerald-600" />
                                                        گام دوم: ثبت سفارش و اخذ مجوزها
                                                    </h4>
                                                    {selectedRecordForJourney.registrationNumber ? (
                                                        <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold">ثبت شده</span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">در انتظار ثبت</span>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-300">
                                                    <div>شماره ثبت سفارش: <strong className="font-mono">{selectedRecordForJourney.registrationNumber || '-'}</strong></div>
                                                    <div>تاریخ ثبت: <span className="font-mono">{selectedRecordForJourney.registrationDate || '-'}</span></div>
                                                    <div>تاریخ انقضا: <span className="font-mono">{selectedRecordForJourney.registrationExpiry || '-'}</span></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Step 3: Insurance */}
                                        <div className="relative">
                                            <div className={`absolute -right-[31px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md ${selectedRecordForJourney.insuranceData?.policyNumber ? 'bg-sky-600 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                                ۳
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                                                        <ShieldCheck size={16} className="text-sky-600" />
                                                        گام سوم: بیمه‌نامه باربری و نمایندگی
                                                    </h4>
                                                    {selectedRecordForJourney.insuranceData?.isPaid ? (
                                                        <span className="text-xs bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 px-2 py-0.5 rounded-md font-bold">تسویه شده</span>
                                                    ) : (
                                                        <span className="text-xs text-amber-600 font-bold">در جریان</span>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600 dark:text-gray-300">
                                                    <div>شرکت بیمه: <strong>{selectedRecordForJourney.insuranceData?.company || '-'}</strong></div>
                                                    <div>شماره بیمه‌نامه: <strong className="font-mono">{selectedRecordForJourney.insuranceData?.policyNumber || '-'}</strong></div>
                                                    <div>نمایندگی: <span>{selectedRecordForJourney.insuranceData?.agencyName || '-'}</span></div>
                                                    <div>کد نمایندگی: <span className="font-mono">{selectedRecordForJourney.insuranceData?.agencyCode || '-'}</span></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Step 4: Currency Allocation */}
                                        <div className="relative">
                                            <div className={`absolute -right-[31px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md ${selectedRecordForJourney.currencyPurchaseData?.allocationDate ? 'bg-cyan-600 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                                ۴
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                                                        <Clock size={16} className="text-cyan-600" />
                                                        گام چهارم: صف و تخصیص ارز بانک مرکزی
                                                    </h4>
                                                    <span className="text-xs font-bold text-gray-600">
                                                        منشا: {selectedRecordForJourney.currencyAllocationType || '-'}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-300">
                                                    <div>ورود به صف: <span className="font-mono">{selectedRecordForJourney.currencyPurchaseData?.queueEntryDate || '-'}</span></div>
                                                    <div>تاریخ تخصیص: <strong className="font-mono text-cyan-700">{selectedRecordForJourney.currencyPurchaseData?.allocationDate || '-'}</strong></div>
                                                    <div>بانک عامل: <span>{selectedRecordForJourney.operatingBank || '-'}</span></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Step 5: Currency Purchase */}
                                        <div className="relative">
                                            <div className={`absolute -right-[31px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md ${((selectedRecordForJourney.currencyPurchaseData?.tranches || []).length > 0) ? 'bg-teal-600 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                                ۵
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                                                        <Coins size={16} className="text-teal-600" />
                                                        گام پنجم: خرید و حواله ارز
                                                    </h4>
                                                    <span className="text-xs font-mono font-bold text-teal-700">
                                                        پارت‌ها: {(selectedRecordForJourney.currencyPurchaseData?.tranches || []).length}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                                    مجموع ارز خریداری شده: <strong className="font-mono text-teal-800 dark:text-teal-300">{formatNumberString((selectedRecordForJourney.currencyPurchaseData?.tranches || []).reduce((sum, t) => sum + (t.amount || 0), 0))} {selectedRecordForJourney.mainCurrency}</strong>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Step 6: Shipping & Transit */}
                                        <div className="relative">
                                            <div className={`absolute -right-[31px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md ${selectedRecordForJourney.isInTransit ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                                ۶
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                                                        <Truck size={16} className="text-blue-600" />
                                                        گام ششم: اسناد حمل و بار در راه
                                                    </h4>
                                                    <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${selectedRecordForJourney.isInTransit ? 'bg-blue-100 text-blue-800' : 'text-gray-400'}`}>
                                                        {selectedRecordForJourney.isInTransit ? 'بار در راه (ترانزیت)' : 'اسناد در حال تکمیل'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Step 7: Customs & Clearance */}
                                        <div className="relative">
                                            <div className={`absolute -right-[31px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md ${selectedRecordForJourney.isInCustoms ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                                ۷
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                                                        <Building2 size={16} className="text-indigo-600" />
                                                        گام هفتم: گمرک، ترخیصیه و برگ سبز
                                                    </h4>
                                                    <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${selectedRecordForJourney.isInCustoms ? 'bg-indigo-100 text-indigo-800' : 'text-gray-400'}`}>
                                                        {selectedRecordForJourney.isInCustoms ? 'در حال ترخیص از گمرک' : 'آماده ورود به گمرک'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Step 8: Completion */}
                                        <div className="relative">
                                            <div className={`absolute -right-[31px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md ${selectedRecordForJourney.status === 'Completed' ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                                ۸
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                                                        <CheckCircle2 size={16} className="text-emerald-600" />
                                                        گام هشتم: حمل داخلی، تحویل انبار کارخانه و تسویه
                                                    </h4>
                                                    <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${selectedRecordForJourney.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'text-gray-400'}`}>
                                                        {selectedRecordForJourney.status === 'Completed' ? 'پرونده مختومه' : 'در جریان عملیات'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            )}

                            {/* SECTION 2: PROFORMA ITEMS */}
                            {activeJourneySection === 'proforma' && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">اقلام ثبت‌شده در پروفرما</h4>
                                    <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                                        <table className="w-full text-xs text-right">
                                            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold">
                                                <tr>
                                                    <th className="p-3 text-center w-10">ردیف</th>
                                                    <th className="p-3">نام کالا</th>
                                                    <th className="p-3 text-center">کد تعرفه (HS)</th>
                                                    <th className="p-3 text-center">وزن (کیلوگرم)</th>
                                                    <th className="p-3 text-center">قیمت واحد ({selectedRecordForJourney.mainCurrency})</th>
                                                    <th className="p-3 text-center">قیمت کل ({selectedRecordForJourney.mainCurrency})</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {(selectedRecordForJourney.items || []).map((item, idx) => (
                                                    <tr key={item.id || idx}>
                                                        <td className="p-3 text-center font-mono text-gray-400">{idx + 1}</td>
                                                        <td className="p-3 font-bold">{item.name}</td>
                                                        <td className="p-3 text-center font-mono">{item.hsCode || '-'}</td>
                                                        <td className="p-3 text-center font-mono">{formatNumberString(item.weight)}</td>
                                                        <td className="p-3 text-center font-mono">{formatNumberString(item.unitPrice)}</td>
                                                        <td className="p-3 text-center font-mono font-bold text-blue-700 dark:text-blue-300">
                                                            {formatNumberString(item.totalPrice || (item.weight * item.unitPrice))}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50 dark:bg-gray-800/80 font-bold border-t border-gray-200 dark:border-gray-700">
                                                <tr>
                                                    <td colSpan={3} className="p-3 text-left">مجموع:</td>
                                                    <td className="p-3 text-center font-mono">{formatNumberString(calculateTotalWeight(selectedRecordForJourney))} KG</td>
                                                    <td></td>
                                                    <td className="p-3 text-center font-mono font-black text-blue-800 dark:text-blue-200">
                                                        {formatNumberString(calculateTotalAmount(selectedRecordForJourney))} {selectedRecordForJourney.mainCurrency}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* SECTION 3: INSURANCE DETAILS */}
                            {activeJourneySection === 'insurance' && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">مشخصات کامل بیمه‌نامه باربری</h4>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                                        <div>
                                            <span className="text-gray-400 block mb-1">شرکت بیمه‌گر:</span>
                                            <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{selectedRecordForJourney.insuranceData?.company || 'مشخص نشده'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block mb-1">شماره بیمه‌نامه:</span>
                                            <span className="font-mono font-bold text-sm text-gray-900 dark:text-gray-100">{selectedRecordForJourney.insuranceData?.policyNumber || 'مشخص نشده'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block mb-1">نام نمایندگی بیمه:</span>
                                            <span className="font-bold text-sm text-blue-700 dark:text-blue-300">{selectedRecordForJourney.insuranceData?.agencyName || 'ثبت نشده'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block mb-1">کد نمایندگی بیمه:</span>
                                            <span className="font-mono font-bold text-sm text-gray-900 dark:text-gray-100">{selectedRecordForJourney.insuranceData?.agencyCode || 'ثبت نشده'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block mb-1">هزینه اولیه بیمه:</span>
                                            <span className="font-mono font-bold text-sm text-emerald-700">{formatNumberString(selectedRecordForJourney.insuranceData?.cost || 0)} ریال</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block mb-1">بانک پرداخت‌کننده:</span>
                                            <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{selectedRecordForJourney.insuranceData?.bank || '-'}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Endorsements Table */}
                                    {selectedRecordForJourney.insuranceData?.endorsements && selectedRecordForJourney.insuranceData.endorsements.length > 0 && (
                                        <div className="mt-4">
                                            <h5 className="font-bold text-xs text-gray-700 dark:text-gray-300 mb-2">الحاقیه‌های ثبت شده</h5>
                                            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden text-xs">
                                                <table className="w-full text-right">
                                                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                                        <tr>
                                                            <th className="p-2.5">تاریخ</th>
                                                            <th className="p-2.5">مبلغ (ریال)</th>
                                                            <th className="p-2.5">شرح الحاقیه</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {selectedRecordForJourney.insuranceData.endorsements.map((end, idx) => (
                                                            <tr key={end.id || idx} className="border-t border-gray-100 dark:border-gray-800">
                                                                <td className="p-2.5 font-mono">{end.date || '-'}</td>
                                                                <td className={`p-2.5 font-mono font-bold ${end.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                                    {end.amount > 0 ? '+' : ''}{formatNumberString(end.amount)}
                                                                </td>
                                                                <td className="p-2.5">{end.description}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SECTION 4: ALLOCATION & QUEUE */}
                            {activeJourneySection === 'allocation' && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">وضعیت صف و تخصیص ارز</h4>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                                        <div>
                                            <span className="text-gray-400 block mb-1">نوع تخصیص ارز:</span>
                                            <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{selectedRecordForJourney.currencyAllocationType || 'مشخص نشده'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block mb-1">رتبه ارزی:</span>
                                            <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{selectedRecordForJourney.allocationCurrencyRank || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block mb-1">تاریخ ورود به صف:</span>
                                            <span className="font-mono font-bold text-sm text-gray-900 dark:text-gray-100">{selectedRecordForJourney.currencyPurchaseData?.queueEntryDate || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block mb-1">تاریخ تخصیص ارز:</span>
                                            <span className="font-mono font-bold text-sm text-cyan-700">{selectedRecordForJourney.currencyPurchaseData?.allocationDate || 'هنوز تخصیص نیافته'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block mb-1">مهلت انقضای تخصیص:</span>
                                            <span className="font-mono font-bold text-sm text-gray-900 dark:text-gray-100">{selectedRecordForJourney.currencyPurchaseData?.allocationExpiryDate || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block mb-1">کد تخصیص:</span>
                                            <span className="font-mono font-bold text-sm text-gray-900 dark:text-gray-100">{selectedRecordForJourney.currencyPurchaseData?.allocationCode || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SECTION 5: CURRENCY PURCHASE TRANCHES */}
                            {activeJourneySection === 'currency' && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">پارت‌های خرید و تحویل ارز</h4>
                                    {(!selectedRecordForJourney.currencyPurchaseData?.tranches || selectedRecordForJourney.currencyPurchaseData.tranches.length === 0) ? (
                                        <div className="p-8 text-center text-gray-400 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-xs">
                                            هنوز پارت خریدی برای این پرونده ثبت نشده است.
                                        </div>
                                    ) : (
                                        <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden text-xs">
                                            <table className="w-full text-right">
                                                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold">
                                                    <tr>
                                                        <th className="p-3 text-center w-10">پارت</th>
                                                        <th className="p-3">تاریخ خرید</th>
                                                        <th className="p-3 text-center">مبلغ ارزی</th>
                                                        <th className="p-3 text-center">مبلغ ریالی</th>
                                                        <th className="p-3">صرافی / کارگزار</th>
                                                        <th className="p-3 text-center">وضعیت تحویل</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                    {selectedRecordForJourney.currencyPurchaseData.tranches.map((tranche, idx) => {
                                                        const deliveredSum = (tranche.deliveries || []).reduce((sum, d) => sum + (d.amount || 0), 0);
                                                        const isFullyDelivered = deliveredSum >= tranche.amount;

                                                        return (
                                                            <tr key={tranche.id || idx}>
                                                                <td className="p-3 text-center font-mono font-bold text-gray-500">{idx + 1}</td>
                                                                <td className="p-3 font-mono">{tranche.date || '-'}</td>
                                                                <td className="p-3 text-center font-mono font-bold text-teal-700 dark:text-teal-300">
                                                                    {formatNumberString(tranche.amount)} {tranche.currencyType || selectedRecordForJourney.mainCurrency}
                                                                </td>
                                                                <td className="p-3 text-center font-mono">
                                                                    {formatNumberString(tranche.rialAmount || 0)} ریال
                                                                </td>
                                                                <td className="p-3 font-medium">{tranche.exchangeName || '-'}</td>
                                                                <td className="p-3 text-center">
                                                                    {isFullyDelivered ? (
                                                                        <span className="text-[11px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">تحویل کامل</span>
                                                                    ) : (
                                                                        <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                                                                            تحویل: {formatNumberString(deliveredSum)} / {formatNumberString(tranche.amount)}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SECTION 6: COMMENTS & DISCUSSION FEED */}
                            {activeJourneySection === 'comments' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
                                        <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                            <MessageSquare size={18} className="text-blue-600" />
                                            یادداشت‌ها و تاریخچه پیام‌های این پرونده
                                        </h4>
                                        <span className="text-xs text-gray-400 font-mono">
                                            {(selectedRecordForJourney.comments || []).length} یادداشت ثبت‌شده
                                        </span>
                                    </div>

                                    {/* New Comment Input Box */}
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                                            افزودن یادداشت / ملاحظات جدید:
                                        </label>
                                        <textarea
                                            value={newCommentText}
                                            onChange={e => setNewCommentText(e.target.value)}
                                            placeholder="نکته، پیگیری وضعیت، هماهنگی یا توضیح خود را وارد کنید..."
                                            className="w-full h-24 border border-gray-300 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden transition-all"
                                        />
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                                <Bell size={12} className="text-amber-500" />
                                                ارسال اعلان فوری به تیم‌های بازرگانی و مدیریت
                                            </span>
                                            <button
                                                onClick={() => handleAddComment(selectedRecordForJourney, newCommentText)}
                                                disabled={!newCommentText.trim() || isSubmittingComment}
                                                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all shadow-xs"
                                            >
                                                <Send size={13} />
                                                <span>ثبت و ارسال نوتیفیکیشن</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Comments Feed */}
                                    <div className="space-y-3">
                                        {(!selectedRecordForJourney.comments || selectedRecordForJourney.comments.length === 0) ? (
                                            <div className="p-8 text-center text-gray-400 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-xs">
                                                هنوز یادداشتی برای این پرونده ثبت نشده است. اولین یادداشت را شما ثبت کنید.
                                            </div>
                                        ) : (
                                            selectedRecordForJourney.comments.map((comment) => (
                                                <div
                                                    key={comment.id}
                                                    className="bg-white dark:bg-gray-800/80 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-2xs space-y-2"
                                                >
                                                    <div className="flex justify-between items-center text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                                                                {(comment.creatorName || comment.createdBy || 'ک').charAt(0)}
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-gray-900 dark:text-gray-100">{comment.creatorName || comment.createdBy}</span>
                                                                {comment.role && <span className="text-[10px] text-gray-400 mr-2">({comment.role})</span>}
                                                            </div>
                                                        </div>
                                                        <span className="text-gray-400 font-mono text-[11px]">
                                                            {new Date(comment.createdAt).toLocaleDateString('fa-IR')} - {new Date(comment.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed pr-9 whitespace-pre-wrap">
                                                        {comment.text}
                                                    </p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/50 flex justify-between items-center shrink-0">
                            <button
                                onClick={() => setSelectedRecordForJourney(null)}
                                className="px-5 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-300 transition-colors"
                            >
                                بستن
                            </button>
                            <span className="text-[11px] text-gray-400 font-mono">
                                سیستم جامع بازرگانی و لجستیک
                            </span>
                        </div>

                    </div>
                </div>
            )}

            {/* HIDDEN PRINT CONTAINER FOR FULL TABLE EXPORT */}
            <div className="hidden">
                <div id="general-trade-list-printable" className="p-8 bg-white text-black dir-rtl text-xs font-sans">
                    {/* Header */}
                    <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
                        <div>
                            <h1 className="text-xl font-black">{settings?.defaultCompany || 'گروه تولیدی و بازرگانی'}</h1>
                            <h2 className="text-base font-bold text-gray-700">گزارش جامع پرونده‌های بازرگانی و واردات</h2>
                        </div>
                        <div className="text-left text-xs font-mono">
                            <div>تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</div>
                            <div>تعداد پرونده‌ها: {filteredRecords.length}</div>
                        </div>
                    </div>

                    {/* Table */}
                    <table className="w-full border-collapse border border-black text-center text-[10px]">
                        <thead>
                            <tr className="bg-gray-200 border-b border-black font-bold">
                                <th className="border border-black p-2 w-8">ردیف</th>
                                <th className="border border-black p-2 text-right">کالا و مقدار (وزن + شرح)</th>
                                <th className="border border-black p-2 w-20">شماره سفارش</th>
                                <th className="border border-black p-2 w-24">ثبت سفارش</th>
                                <th className="border border-black p-2 w-20">شماره پروفرم</th>
                                <th className="border border-black p-2 w-24">شرکت</th>
                                <th className="border border-black p-2 w-24">مبلغ و ارز</th>
                                <th className="border border-black p-2 w-24">وضعیت</th>
                                <th className="border border-black p-2 text-right">آخرین ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecords.map((r, i) => {
                                const stage = getRecordStageInfo(r);
                                const lastComment = r.comments && r.comments.length > 0 ? r.comments[r.comments.length - 1] : null;
                                return (
                                    <tr key={r.id} className="border-b border-gray-300">
                                        <td className="border border-black p-1.5 font-mono">{i + 1}</td>
                                        <td className="border border-black p-1.5 text-right font-bold">{formatGoodsWithWeight(r)}</td>
                                        <td className="border border-black p-1.5 font-mono">{r.orderNumber || '-'}</td>
                                        <td className="border border-black p-1.5 font-mono">{r.registrationNumber || '-'}</td>
                                        <td className="border border-black p-1.5 font-mono">{r.proformaNumber || r.fileNumber || '-'}</td>
                                        <td className="border border-black p-1.5">{r.company}</td>
                                        <td className="border border-black p-1.5 font-mono font-bold">
                                            {formatNumberString(calculateTotalAmount(r))} {r.mainCurrency}
                                        </td>
                                        <td className="border border-black p-1.5 font-bold">{stage.label}</td>
                                        <td className="border border-black p-1.5 text-right">{lastComment?.text || '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Print Summary Totals */}
                    <div className="mt-4 p-3 border border-black bg-gray-50 flex justify-between items-center text-xs font-bold">
                        <div>مجموع وزن کل: <span className="font-mono">{metrics.totalTons} تن</span> ({metrics.totalWeightKg} کیلوگرم)</div>
                        <div className="flex gap-4">
                            <span>مبالغ ارزی:</span>
                            {Object.entries(metrics.currencyTotals).map(([cur, tot]) => (
                                <span key={cur} className="font-mono">{formatNumberString(tot)} {cur}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};
