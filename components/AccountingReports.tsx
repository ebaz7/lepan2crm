import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { 
    Search, 
    Loader2, 
    Printer, 
    Calendar, 
    TrendingUp, 
    Coins, 
    TrendingDown, 
    CheckSquare, 
    Layers, 
    Activity, 
    FileText, 
    ArrowUpDown, 
    Download,
    Percent,
    X,
    RefreshCw,
    Save,
    Send,
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Archive,
    Trash2,
    Filter,
    Share2,
    Check,
    AlertCircle,
    Building2,
    User,
    Sparkles,
    CheckCircle2,
    ArrowUp,
    ArrowDown,
    Truck
} from 'lucide-react';
import * as jalaali from 'jalaali-js';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts';
import { getRolePermissions } from '../services/authService';
import SayanSalesDashboard from './sales/SayanSalesDashboard';
import SayanRemittancesTab from './SayanRemittancesTab';
import WarehouseOverviewTab from './WarehouseOverviewTab';
import { UserRole } from '../types';
import { getServerHost } from '../services/apiService';

const getEffectiveApiUrl = (path: string) => {
    const host = getServerHost();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (!host) {
        return cleanPath;
    }
    return `${host}${cleanPath}`;
};

export default function AccountingReports({ currentUser, settings }: { currentUser?: any, settings?: any }) {
    // Determine Sayan permissions
    const perms = currentUser ? getRolePermissions(currentUser.role, settings || null, currentUser) : {
        canViewSayan: true, canViewSayanTraz: true, canViewSayanSales: true, canViewSayanProduction: true, canViewSayanCheques: true
    };

    const isTrazAllowed = currentUser?.role === UserRole.ADMIN || perms.canViewSayan === true || perms.canViewSayanTraz === true;
    const isSalesAllowed = currentUser?.role === UserRole.ADMIN || perms.canViewSayan === true || perms.canViewSayanSales === true;
    const isProductionAllowed = currentUser?.role === UserRole.ADMIN || perms.canViewSayan === true || perms.canViewSayanProduction === true;
    const isChequesAllowed = currentUser?.role === UserRole.ADMIN || perms.canViewSayan === true || perms.canViewSayanCheques === true;
    const isRemittancesAllowed = currentUser?.role === UserRole.ADMIN || perms.canViewSayan === true || perms.canViewSayanSales === true || (perms as any).canManageExitPermits === true || (perms as any).canCreateExitPermit === true;
    const isWarehouseOverviewAllowed = currentUser?.role === UserRole.ADMIN || perms.canViewSayan === true;

    // Default to the first allowed tab
    const [activeTab, setActiveTab] = useState(() => {
        if (currentUser?.role === UserRole.ADMIN || perms.canViewSayan === true || perms.canViewSayanTraz === true) return 'traz';
        if (perms.canViewSayanSales === true) return 'sales';
        if (perms.canViewSayanProduction === true) return 'production';
        if (perms.canViewSayanCheques === true) return 'cheques';
        return 'traz';
    });
    const [isLoading, setIsLoading] = useState(false);
    
    // Default Date Range (Direct Shamsi format "YYYY/MM/DD")
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // --- TAB 1: TRAZ STATE ---
    const [trazData, setTrazData] = useState<any[]>([]);
    const [trazSearch, setTrazSearch] = useState('');
    const [trazCategory, setTrazCategory] = useState('all'); // all, customers, suppliers, personnel, shareholders
    const [trazSortOrder, setTrazSortOrder] = useState<'desc' | 'asc'>('desc');

    // --- TAB 2: STATEMENT STATE ---
    const [tafsilis, setTafsilis] = useState<any[]>([]);
    const [selectedTafsili, setSelectedTafsili] = useState('');
    const [tafsiliSearch, setTafsiliSearch] = useState('');
    const [statementSearch, setStatementSearch] = useState('');
    const [statementData, setStatementData] = useState<any[]>([]);
    const [guaranteeCheques, setGuaranteeCheques] = useState<any[]>([]);

    // --- STATEMENT MODAL STATE ---
    const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
    const [modalTafsiliCode, setModalTafsiliCode] = useState('');
    const [modalTafsiliName, setModalTafsiliName] = useState('');

    // --- TAB 3: SALES STATE ---
    const [salesData, setSalesData] = useState<any[]>([]);
    const [salesViewMode, setSalesViewMode] = useState<'today' | 'range'>('today');
    const [compareMode, setCompareMode] = useState(false);
    const [compareGroupBy, setCompareGroupBy] = useState<'group' | 'item'>('group');
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
    // Period B for sales comparison
    const [salesDateFromB, setSalesDateFromB] = useState('');
    const [salesDateToB, setSalesDateToB] = useState('');
    const [compareSalesDataA, setCompareSalesDataA] = useState<any[]>([]);
    const [compareSalesDataB, setCompareSalesDataB] = useState<any[]>([]);
    const [isSendingSalesBot, setIsSendingSalesBot] = useState(false);

    // --- TAB 4: PRODUCTION STATE ---
    const [prodLiveItems, setProdLiveItems] = useState<any[]>([]);
    const [prodLiveTotals, setProdLiveTotals] = useState<any>({ qty_61: 0, qty_67: 0, qty_79: 0, qty_73: 0, grandTotal: 0 });
    const [prodWaste, setProdWaste] = useState<any>({ waste_61: 0, waste_67: 0, waste_79: 0, waste_73: 0, waste_schweiter: 0, totalWaste: 0, pct_61: 0, pct_67: 0, pct_79: 0, pct_73: 0, pct_schweiter: 0, totalPct: 0, details: '' });
    const [isSavingWaste, setIsSavingWaste] = useState(false);
    const [prodArchive, setProdArchive] = useState<any[]>([]);
    const [isFetchingArchive, setIsFetchingArchive] = useState(false);
    const [archiveSearch, setArchiveSearch] = useState('');
    const [isSendingBot, setIsSendingBot] = useState(false);
    const [productionData, setProductionData] = useState<any[]>([]);
    const [prodGrouping, setProdGrouping] = useState<'group' | 'item' | 'date'>('group');
    const [prodSearch, setProdSearch] = useState('');

    // --- PRODUCTION COMPARISON STATE ---
    const [prodCompareMode, setProdCompareMode] = useState(false);
    const [prodCompareDateFromB, setProdCompareDateFromB] = useState('');
    const [prodCompareDateToB, setProdCompareDateToB] = useState('');
    const [prodCompareDataA, setProdCompareDataA] = useState<any[]>([]);
    const [prodCompareDataB, setProdCompareDataB] = useState<any[]>([]);
    const [prodCompareTotalsA, setProdCompareTotalsA] = useState<any>({ qty_61: 0, qty_67: 0, qty_79: 0, qty_73: 0, qty_schweiter: 0, grandTotal: 0 });
    const [prodCompareTotalsB, setProdCompareTotalsB] = useState<any>({ qty_61: 0, qty_67: 0, qty_79: 0, qty_73: 0, qty_schweiter: 0, grandTotal: 0 });
    const [isSendingProdCompareBot, setIsSendingProdCompareBot] = useState(false);
    const [prodCompareGroupBy, setProdCompareGroupBy] = useState<'group' | 'item'>('group');

    // --- TAB 5: CHEQUES STATE ---
    const [chequesData, setChequesData] = useState<any[]>([]);
    const [chequeStatusFilter, setChequeStatusFilter] = useState('in_hand'); // Default to in_hand (vault cheques)
    const [chequeSearch, setChequeSearch] = useState('');
    const [hideOldSpentCheques, setHideOldSpentCheques] = useState(true); // Hide cashed/spent cheques older than 2 years
    const [chequeBankFilter, setChequeBankFilter] = useState('all');
    const [chequeDrawerFilter, setChequeDrawerFilter] = useState('all');
    const [chequeDateFrom, setChequeDateFrom] = useState('');
    const [chequeDateTo, setChequeDateTo] = useState('');
    const [chequeMinAmount, setChequeMinAmount] = useState('');
    const [chequeMaxAmount, setChequeMaxAmount] = useState('');
    const [chequeSortBy, setChequeSortBy] = useState<'dueDate' | 'amount' | 'bankName' | 'drawerName' | 'chequeNo'>('dueDate');
    const [chequeSortOrder, setChequeSortOrder] = useState<'asc' | 'desc'>('asc');
    const [isChequeAdvancedFilterOpen, setIsChequeAdvancedFilterOpen] = useState(false);

    // Cheques Bot Manual Dispatch Modal
    const [isChequeBotModalOpen, setIsChequeBotModalOpen] = useState(false);
    const [isSendingChequesBot, setIsSendingChequesBot] = useState(false);
    const [chequeBotTargetType, setChequeBotTargetType] = useState<'vault' | 'returned' | 'matured' | 'filtered'>('vault');
    const [chequeBotSelectedPlatforms, setChequeBotSelectedPlatforms] = useState<('telegram' | 'bale' | 'whatsapp')[]>(['telegram', 'bale']);
    const [chequeBotAttachPdf, setChequeBotAttachPdf] = useState(true);
    const [chequeBotAttachExcel, setChequeBotAttachExcel] = useState(true);
    const [chequeBotCustomTitle, setChequeBotCustomTitle] = useState('');
    const [chequeBotCustomGroupTele, setChequeBotCustomGroupTele] = useState('');
    const [chequeBotCustomGroupBale, setChequeBotCustomGroupBale] = useState('');
    const [chequeBotCustomGroupWa, setChequeBotCustomGroupWa] = useState('');

    // ==========================================
    // DATE INITIALIZATION & CONVERSIONS
    // ==========================================
    // Helper to parse any Jalali date format (1.1.1404, 24.1.1404, 1.1.04, 1404/01/01, etc.)
    const parseShamsiParts = (str: string) => {
        if (!str) return null;
        const clean = str.trim()
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧۸۹'.indexOf(d).toString());
        const parts = clean.split(/[\/\.\-]/).map(p => parseInt(p, 10)).filter(n => !isNaN(n));
        if (parts.length !== 3) return null;

        let jy = 0, jm = 0, jd = 0;

        if (parts[0] >= 1300 || parts[0] === 404 || parts[0] === 405 || (parts[0] >= 100 && parts[0] < 1000)) {
            jy = parts[0]; jm = parts[1]; jd = parts[2];
        } else if (parts[2] >= 1300 || parts[2] === 404 || parts[2] === 405 || parts[2] >= 100) {
            jy = parts[2]; jm = parts[1]; jd = parts[0];
        } else {
            if (parts[0] > 12) {
                jd = parts[0]; jm = parts[1]; jy = parts[2];
            } else {
                jy = parts[2]; jm = parts[1]; jd = parts[0];
            }
        }

        if (jy < 100) jy += 1400;
        else if (jy >= 100 && jy < 1000) jy += 1000;

        if (jm > 12 && jd <= 12) {
            const tmp = jm; jm = jd; jd = tmp;
        }

        return { jy, jm, jd };
    };

    const jalaliToGregorianStr = (jalaliStr: string) => {
        if (!jalaliStr) return '';
        try {
            const res = parseShamsiParts(jalaliStr);
            if (!res) return jalaliStr;
            const g = jalaali.toGregorian(res.jy, res.jm, res.jd);
            return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
        } catch {
            return jalaliStr;
        }
    };

    const parseTafsiliRaw = (raw: string) => {
        if (!raw) return { moein: '', code: '' };
        const parts = raw.split('-');
        for (const part of parts) {
            const match = part.match(/^(11\d*|31\d*):(\d+)/);
            if (match) {
                return {
                    moein: match[1],
                    code: match[2]
                };
            }
        }
        const match = raw.match(/(11\d*|31\d*):(\d+)/);
        if (match) {
            return {
                moein: match[1],
                code: match[2]
            };
        }
        return { moein: '', code: '' };
    };

    const getActiveFiscalYearLabel = () => {
        if (settings?.fiscalYears && Array.isArray(settings.fiscalYears)) {
            const found = settings.fiscalYears.find((y: any) => y.id === settings.activeFiscalYearId);
            if (found && found.label) {
                const match = found.label.match(/\d+/);
                if (match) return parseInt(match[0], 10);
            }
        }
        const today = new Date();
        const jToday = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
        return jToday.jy;
    };

    const getDefaultEndDate = (activeYear: number, jToday: any) => {
        if (jToday.jy > activeYear) {
            return `${activeYear}/12/29`;
        } else if (jToday.jy < activeYear) {
            return `${activeYear}/01/01`;
        } else {
            return `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
        }
    };

    useEffect(() => {
        // Initialize Date range directly in Shamsi
        const today = new Date();
        const jToday = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
        
        const currentYear = jToday.jy; // 1405
        
        const savedFrom = localStorage.getItem('sayan_default_date_from');
        const savedTo = localStorage.getItem('sayan_default_date_to');
        
        // Default to current year 1405 start if savedFrom is missing or from an old year
        const initialFrom = (savedFrom && !savedFrom.startsWith('1403') && !savedFrom.startsWith('1404')) ? savedFrom : `${currentYear}/01/01`;
        const initialTo = savedTo || `${currentYear}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
        
        setDateFrom(initialFrom);
        setDateTo(initialTo);

        // Previous year default for comparisons (shifted by -1 year relative to Period A)
        const shiftShamsiYear = (shamsiStr: string, delta: number) => {
            if (!shamsiStr) return '';
            const p = shamsiStr.split('/');
            if (p.length !== 3) return shamsiStr;
            const y = parseInt(p[0], 10);
            return `${y + delta}/${p[1]}/${p[2]}`;
        };
        const startPrev = shiftShamsiYear(initialFrom, -1);
        const endPrev = shiftShamsiYear(initialTo, -1);
        setSalesDateFromB(startPrev);
        setSalesDateToB(endPrev);

        fetchTafsilis();
    }, [settings?.activeFiscalYearId]);

    const applyQuickDate = (mode: 'today' | 'yesterday' | 'month' | 'quarter' | 'default') => {
        const today = new Date();
        const jToday = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
        
        if (mode === 'today') {
            const dateStr = `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
            setDateFrom(dateStr);
            setDateTo(dateStr);
            toast.success(`بازه زمانی به امروز (${dateStr}) تغییر یافت.`);
        } else if (mode === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const jYest = jalaali.toJalaali(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate());
            const dateStr = `${jYest.jy}/${String(jYest.jm).padStart(2, '0')}/${String(jYest.jd).padStart(2, '0')}`;
            setDateFrom(dateStr);
            setDateTo(dateStr);
            toast.success(`بازه زمانی به دیروز (${dateStr}) تغییر یافت.`);
        } else if (mode === 'month') {
            const startStr = `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/01`;
            let endDay = '30';
            if (jToday.jm >= 1 && jToday.jm <= 6) {
                endDay = '31';
            } else if (jToday.jm === 12) {
                endDay = jalaali.isLeapJalaaliYear(jToday.jy) ? '30' : '29';
            }
            const endStr = `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${endDay}`;
            setDateFrom(startStr);
            setDateTo(endStr);
            toast.success(`بازه زمانی به ماه جاری (${startStr} تا ${endStr}) تغییر یافت.`);
        } else if (mode === 'quarter') {
            let startMonth = 1;
            let endMonth = 3;
            let endDay = '31';
            let quarterName = 'بهار';
            
            if (jToday.jm >= 1 && jToday.jm <= 3) {
                startMonth = 1; endMonth = 3; endDay = '31'; quarterName = 'بهار';
            } else if (jToday.jm >= 4 && jToday.jm <= 6) {
                startMonth = 4; endMonth = 6; endDay = '31'; quarterName = 'تابستان';
            } else if (jToday.jm >= 7 && jToday.jm <= 9) {
                startMonth = 7; endMonth = 9; endDay = '30'; quarterName = 'پاییز';
            } else if (jToday.jm >= 10 && jToday.jm <= 12) {
                startMonth = 10; endMonth = 12; endDay = jalaali.isLeapJalaaliYear(jToday.jy) ? '30' : '29'; quarterName = 'زمستان';
            }
            
            const startStr = `${jToday.jy}/${String(startMonth).padStart(2, '0')}/01`;
            const endStr = `${jToday.jy}/${String(endMonth).padStart(2, '0')}/${endDay}`;
            setDateFrom(startStr);
            setDateTo(endStr);
            toast.success(`بازه زمانی به فصل جاری (${quarterName}: ${startStr} تا ${endStr}) تغییر یافت.`);
        } else if (mode === 'default') {
            const activeYear = getActiveFiscalYearLabel();
            const savedFrom = localStorage.getItem('sayan_default_date_from');
            const savedTo = localStorage.getItem('sayan_default_date_to');
            const initialFrom = savedFrom || `${activeYear}/01/01`;
            const initialTo = savedTo || getDefaultEndDate(activeYear, jToday);
            setDateFrom(initialFrom);
            setDateTo(initialTo);
            toast.success(`بازه زمانی به حالت پیش‌فرض بازنشانی شد.`);
        }
    };

    const saveCurrentAsDefaultDate = () => {
        if (!dateFrom || !dateTo) {
            toast.error('بازه معتبری برای ذخیره پیش‌فرض وجود ندارد.');
            return;
        }
        localStorage.setItem('sayan_default_date_from', dateFrom);
        localStorage.setItem('sayan_default_date_to', dateTo);
        toast.success(`بازه ${dateFrom} تا ${dateTo} با موفقیت به عنوان پیش‌فرض ثبت گردید.`);
    };

    const formatMoney = (val: number) => new Intl.NumberFormat('fa-IR').format(Math.round(Math.abs(val)));
    
    const formatDateToJalali = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('/')) return dateStr; // Already Shamsi!
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            // Shift to Iran Standard Time (UTC+3:30)
            const iranTime = new Date(d.getTime() + (3.5 * 60 * 60 * 1000));
            const y = iranTime.getUTCFullYear();
            const m = iranTime.getUTCMonth() + 1;
            const day = iranTime.getUTCDate();
            const j = jalaali.toJalaali(y, m, day);
            return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
        } catch {
            return dateStr;
        }
    };

    // Helper to identify actual products (yarns/goods) and filter out non-product lines (services/freight)
    const isActualProduct = (row: any): boolean => {
        if (!row) return false;
        const code = String(row.ItemCode || '').trim();
        const name = String(row.ItemName || '').trim();
        const group = String(row.GroupName || '').trim();

        const lowerName = name.toLowerCase();
        const lowerGroup = group.toLowerCase();

        const keywordsToExclude = [
            'کارتن',
            'پالت',
            'جعبه',
            'حمل',
            'کرایه',
            'خدمات',
            'هزینه',
            'دوک خالی',
            'کیسه خالی',
            'بسته بندی',
            'پلاستیک'
        ];

        for (const keyword of keywordsToExclude) {
            if (lowerName.includes(keyword) || lowerGroup.includes(keyword)) {
                return false;
            }
        }

        // Standard prefixes for actual products (yarns/raw materials)
        const isProductPrefix = /^(01|02|04|05)/.test(code);
        if (isProductPrefix) {
            return true;
        }

        if (!group && (!name || name === code || /^\d+$/.test(name))) {
            return false;
        }

        return true;
    };

    // Helper to extract net weight from row details
    const parseNetWeight = (row: any) => {
        if (!isActualProduct(row)) return 0;
        const notes = row.ItemNotes || '';
        const match = notes.match(/وزن خالص\s*[:：\-]?\s*([\d.]+)/);
        if (match) return parseFloat(match[1]);
        
        const seriesMatch = notes.match(/سری ساخت\s*[:：\-]?\s*[A-Za-z0-9-]+\-([\d.]+)/);
        if (seriesMatch) return parseFloat(seriesMatch[1]);

        return parseFloat(row.Quantity || 0);
    };

    // Helper to extract gross weight from row details
    const parseGrossWeight = (row: any) => {
        const notes = row.ItemNotes || '';
        const match = notes.match(/وزن ناخالص\s*[:：\-]?\s*([\d.]+)/);
        return match ? parseFloat(match[1]) : 0;
    };

    // Helper to parse or calculate fee / unit price from row details
    const parseFee = (row: any, netWeight: number) => {
        const notes = (row.ItemNotes || '') + ' ' + (row.Notes || '');
        const match = notes.match(/(?:فی|قیمت واحد|نرخ|قیمت)\s*[:：\-]?\s*([\d,.]+)/);
        if (match) {
            return parseFloat(match[1].replace(/,/g, ''));
        }
        const amt = parseFloat(row.Amount || 0);
        return netWeight > 0 ? (amt / netWeight) : 0;
    };

    // ==========================================
    // BACKEND DATABASE COMMUNICATORS (Sayan Proxy)
    // ==========================================
    const runSayanQuery = async (queryStr: string) => {
        const res = await fetch(getEffectiveApiUrl('/api/sayan-proxy'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: '/query',
                method: 'POST',
                body: { query: queryStr }
            })
        });
        if (!res.ok) {
            const errDetails = await res.json().catch(() => ({}));
            throw new Error(errDetails.error || 'خطای سرور سایان');
        }
        const data = await res.json();
        return data.data || [];
    };

    const fetchTafsilis = async () => {
        try {
            const sql = `
                SELECT DISTINCT 
                    Field_003 as Code, 
                    Field_006 as Name, 
                    Field_005 as TafsiliCode,
                    Field_004 as MoeinGroup
                FROM ACT_TBL_007 
                WHERE Field_004 LIKE '11%' OR Field_004 LIKE '31%' OR Field_003 LIKE '11%' OR Field_003 LIKE '31%'
                ORDER BY Field_006 ASC
            `;
            const data = await runSayanQuery(sql);
            setTafsilis(data);
        } catch (err) {
            console.error('Error fetching Sayan Tafsilis', err);
        }
    };

    // ==========================================
    // TAB 1: TRAZ (DEBTORS / CREDITORS)
    // ==========================================
    const fetchTraz = async () => {
        setIsLoading(true);
        try {
            let sql = '';
            // If date filter is defined, query transactional tables with Sanad headers
            if (dateFrom && dateTo) {
                const gregFrom = jalaliToGregorianStr(dateFrom);
                const gregTo = jalaliToGregorianStr(dateTo);
                sql = `
                    SELECT 
                        t9.Field_015 as TafsiliRaw,
                        SUM(CAST(t9.Field_009 AS FLOAT)) as TotalBed,
                        SUM(CAST(t9.Field_010 AS FLOAT)) as TotalBes
                                        FROM ACT_TBL_009 t9
                    LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
                    WHERE (t9.Field_015 LIKE '11%' OR t9.Field_015 LIKE '%-11%' OR t9.Field_015 LIKE '31%' OR t9.Field_015 LIKE '%-31%') 
                      AND t9.Field_015 NOT LIKE '%-12%'
                      AND t9.Field_015 NOT LIKE '%-13%'
                      AND t9.Field_007 NOT IN ('102', '103', '107', '109', '114', '116', '117') 
                      AND t9.Field_005 <> '9'
                      AND t8.Field_008 >= '${gregFrom}T00:00:00.000Z' 
                      AND t8.Field_008 <= '${gregTo}T23:59:59.000Z'
                    GROUP BY t9.Field_015
                `;
            } else {
                // aggregate speeds
                sql = `
                    SELECT 
                        t24.Field_010 as TafsiliRaw,
                        SUM(CAST(t24.Field_006 AS FLOAT)) as TotalBed,
                        SUM(CAST(t24.Field_007 AS FLOAT)) as TotalBes
                    FROM ACT_TBL_024 t24
                    WHERE (t24.Field_010 LIKE '11%' OR t24.Field_010 LIKE '%-11%' OR t24.Field_010 LIKE '31%' OR t24.Field_010 LIKE '%-31%') 
                      AND t24.Field_010 NOT LIKE '%-12%'
                      AND t24.Field_010 NOT LIKE '%-13%'
                      AND t24.Field_005 NOT IN ('102', '103', '107', '109', '114', '116', '117')
                      AND t24.Field_003 <> '9'
                    GROUP BY t24.Field_010
                `;
            }
            
            const rawData = await runSayanQuery(sql);
            
            // Map Sayan codes to names and group them by unique customer code to prevent any duplicates
            const groupedMap = new Map<string, any>();
            rawData.forEach((row: any) => {
                const parsed = parseTafsiliRaw(row.TafsiliRaw);
                const code = parsed.code;
                if (!code) return;
                
                const tafsili = tafsilis.find(t => t.Code === code || t.TafsiliCode === code);
                const name = tafsili ? tafsili.Name : `کد اشخاص ${code}`;
                const bed = parseFloat(row.TotalBed || 0);
                const bes = parseFloat(row.TotalBes || 0);
                
                if (groupedMap.has(code)) {
                    const existing = groupedMap.get(code);
                    existing.bed += bed;
                    existing.bes += bes;
                    existing.balance = existing.bed - existing.bes;
                } else {
                    groupedMap.set(code, {
                        code,
                        name,
                        bed,
                        bes,
                        balance: bed - bes
                    });
                }
            });
            
            const mapped = Array.from(groupedMap.values()).filter((r: any) => r.balance !== 0);

            setTrazData(mapped);
        } catch (err: any) {
            toast.error(`خطا در دریافت تراز سایان: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter and categorise Traz data
    const getFilteredTraz = () => {
        let items = trazData.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(trazSearch.toLowerCase()) || 
                                  item.code.includes(trazSearch);
            
            if (!matchesSearch) return false;

            // Categories split logic
            if (trazCategory === 'customers') {
                return item.name.includes('مشتری') || item.name.includes('خریدار');
            } else if (trazCategory === 'suppliers') {
                return item.name.includes('تامین') || item.name.includes('فروشنده') || item.name.includes('شرکت');
            } else if (trazCategory === 'personnel') {
                return item.name.includes('پرسنل') || item.name.includes('همکار') || item.name.includes('آقای') || item.name.includes('خانم');
            } else if (trazCategory === 'shareholders') {
                return item.name.includes('سهام') || item.name.includes('هیئت');
            } else if (trazCategory === 'debtors') {
                return item.balance > 0;
            } else if (trazCategory === 'creditors') {
                return item.balance < 0;
            }
            return true;
        });

        // Sorting by absolute balance
        items.sort((a, b) => {
            const valA = Math.abs(a.balance);
            const valB = Math.abs(b.balance);
            return trazSortOrder === 'desc' ? valB - valA : valA - valB;
        });

        return items;
    };

    // Print/PDF debtors & creditors separately
    const handlePrintTrazReport = (type: 'bed' | 'bes') => {
        const fullList = getFilteredTraz();
        const sortedList = fullList
            .filter(t => type === 'bed' ? t.balance > 0 : t.balance < 0)
            .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

        const title = type === 'bed' ? 'گزارش مانده بدهکاران (صعودی به نزولی)' : 'گزارش مانده بستانکاران (صعودی به نزولی)';
        const docHtml = `
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>
                    body { font-family: 'Tahoma', 'Segoe UI', sans-serif; padding: 25px; background: #fff; color: #333; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; }
                    .header h1 { margin: 0; font-size: 20px; color: #0f172a; }
                    .header p { margin: 4px 0 0; font-size: 13px; color: #475569; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: right; font-size: 12px; }
                    th { background-color: #f8fafc; font-weight: bold; color: #0f172a; }
                    tr:nth-child(even) { background-color: #f1f5f9; }
                    .total { font-weight: bold; background: #e2e8f0 !important; }
                    .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 15px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>${title}</h1>
                        <p>دوره مالی: از ${formatDateToJalali(dateFrom)} تا ${formatDateToJalali(dateTo)}</p>
                    </div>
                    <div style="text-align: left;">
                        <p>تاریخ چاپ: ${formatDateToJalali(new Date().toISOString())}</p>
                        <p>تعداد ردیف: ${sortedList.length}</p>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px; text-align: center;">ردیف</th>
                            <th style="width: 120px;">کد حسابداری</th>
                            <th>نام شخص</th>
                            <th style="text-align: left; width: 200px;">مبلغ مانده (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedList.map((row, idx) => `
                            <tr>
                                <td style="text-align: center;">${idx + 1}</td>
                                <td>${row.code}</td>
                                <td>${row.name}</td>
                                <td style="text-align: left; font-weight: 500;">${formatMoney(row.balance)}</td>
                            </tr>
                        `).join('')}
                        <tr class="total">
                            <td colspan="3" style="text-align: left;">جمع کل مانده‌ها:</td>
                            <td style="text-align: left;">${formatMoney(sortedList.reduce((sum, r) => sum + r.balance, 0))}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="footer">
                    <p>سیستم گزارشات حسابداری یکپارچه سایان ERP</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    // ==========================================
    // TAB 2: DETAILED STATEMENT (صورتحساب ریز تراکنش‌ها)
    // ==========================================
    const fetchStatement = async (tafsiliCodeOverride?: string) => {
        const codeToUse = tafsiliCodeOverride || selectedTafsili;
        if (!codeToUse) {
            toast.error('لطفاً ابتدا شخص مورد نظر را انتخاب کنید');
            return;
        }
        setIsLoading(true);
        try {
            const gregFrom = jalaliToGregorianStr(dateFrom);
            const gregTo = jalaliToGregorianStr(dateTo);
            
            const selectedInfo = tafsilis.find(t => t.Code === codeToUse);
            const shortTafsiliCode = selectedInfo ? selectedInfo.TafsiliCode : '';
            
            let tafsiliFilter = `(
                t9.Field_015 LIKE '%:${codeToUse}%' OR 
                t9.Field_014 LIKE '%:${codeToUse}%' OR
                t9.Field_015 LIKE '%:${codeToUse}' OR 
                t9.Field_014 LIKE '%:${codeToUse}'
            )`;
            
            if (shortTafsiliCode) {
                const code31 = '31' + shortTafsiliCode;
                tafsiliFilter = `(
                    t9.Field_015 LIKE '%:${codeToUse}%' OR 
                    t9.Field_014 LIKE '%:${codeToUse}%' OR
                    t9.Field_015 LIKE '%:${codeToUse}' OR 
                    t9.Field_014 LIKE '%:${codeToUse}' OR
                    t9.Field_015 LIKE '%:${shortTafsiliCode}%' OR 
                    t9.Field_014 LIKE '%:${shortTafsiliCode}%' OR
                    t9.Field_015 LIKE '%:${shortTafsiliCode}' OR 
                    t9.Field_014 LIKE '%:${shortTafsiliCode}' OR
                    t9.Field_015 LIKE '%:${code31}%' OR 
                    t9.Field_014 LIKE '%:${code31}%' OR
                    t9.Field_015 LIKE '%:${code31}' OR 
                    t9.Field_014 LIKE '%:${code31}'
                )`;
            }

            const sql = `
                SELECT 
                    t9.Field_004 as SanadNo,
                    t9.Field_009 as Bed,
                    t9.Field_010 as Bes,
                    t9.Field_011 as Description,
                    t8.Field_008 as Date,
                    t9.Field_005 as MoeinGroup,
                    t9.Field_006 as MoeinParent,
                    t9.Field_007 as MoeinCode,
                    m3.Field_006 as MoeinName
                FROM ACT_TBL_009 t9
                LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
                LEFT JOIN ACT_TBL_003 m3 ON t9.Field_005 = m3.Field_003 AND t9.Field_006 = m3.Field_004 AND t9.Field_007 = m3.Field_005
                WHERE ${tafsiliFilter} 
                  AND (t9.Field_015 LIKE '11%' OR t9.Field_015 LIKE '%-11%' OR t9.Field_015 LIKE '31%' OR t9.Field_015 LIKE '%-31%')
                  AND t9.Field_015 NOT LIKE '%-12%'
                  AND t9.Field_015 NOT LIKE '%-13%'
                  AND t9.Field_007 NOT IN ('102', '103', '107', '109', '114', '116', '117')
                  AND t9.Field_005 <> '9'
                  AND t8.Field_008 >= '${gregFrom}T00:00:00.000Z'
                  AND t8.Field_008 <= '${gregTo}T23:59:59.000Z'
                ORDER BY t8.Field_008 ASC, CAST(t9.Field_001 AS INT) ASC
            `;
            const data = await runSayanQuery(sql);
            
            let balanceAccumulator = 0;
            const processed = data.map((row: any) => {
                const bed = parseFloat(row.Bed || 0);
                const bes = parseFloat(row.Bes || 0);
                balanceAccumulator += (bed - bes);
                return {
                    ...row,
                    bed,
                    bes,
                    balance: balanceAccumulator
                };
            });
            setStatementData(processed);

            // Fetch guarantee and post-dated cheques associated with this person
            let chequeFilter = `(
                t9.Field_015 LIKE '%:${codeToUse}%' OR 
                t9.Field_014 LIKE '%:${codeToUse}%' OR
                t9.Field_015 LIKE '%:${codeToUse}' OR 
                t9.Field_014 LIKE '%:${codeToUse}'
            ) AND (t9.Field_015 LIKE '%-12%' OR t9.Field_015 LIKE '%-13%' OR t9.Field_005 = '9' OR t9.Field_007 IN ('102', '103'))`;

            if (shortTafsiliCode) {
                const code31 = '31' + shortTafsiliCode;
                chequeFilter = `(
                    t9.Field_015 LIKE '%:${codeToUse}%' OR 
                    t9.Field_014 LIKE '%:${codeToUse}%' OR
                    t9.Field_015 LIKE '%:${codeToUse}' OR 
                    t9.Field_014 LIKE '%:${codeToUse}' OR
                    t9.Field_015 LIKE '%:${shortTafsiliCode}%' OR 
                    t9.Field_014 LIKE '%:${shortTafsiliCode}%' OR
                    t9.Field_015 LIKE '%:${shortTafsiliCode}' OR 
                    t9.Field_014 LIKE '%:${shortTafsiliCode}' OR
                    t9.Field_015 LIKE '%:${code31}%' OR 
                    t9.Field_014 LIKE '%:${code31}%' OR
                    t9.Field_015 LIKE '%:${code31}' OR 
                    t9.Field_014 LIKE '%:${code31}'
                ) AND (t9.Field_015 LIKE '%-12%' OR t9.Field_015 LIKE '%-13%' OR t9.Field_005 = '9' OR t9.Field_007 IN ('102', '103'))`;
            }

            const chequeSql = `
                SELECT 
                    t9.Field_004 as SanadNo,
                    t9.Field_009 as Bed,
                    t9.Field_010 as Bes,
                    t9.Field_011 as Description,
                    t8.Field_008 as Date,
                    t9.Field_005 as MoeinGroup,
                    t9.Field_006 as MoeinParent,
                    t9.Field_007 as MoeinCode,
                    m3.Field_006 as MoeinName
                FROM ACT_TBL_009 t9
                LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
                LEFT JOIN ACT_TBL_003 m3 ON t9.Field_005 = m3.Field_003 AND t9.Field_006 = m3.Field_004 AND t9.Field_007 = m3.Field_005
                WHERE ${chequeFilter}
                  AND t8.Field_008 >= '${gregFrom}T00:00:00.000Z'
                  AND t8.Field_008 <= '${gregTo}T23:59:59.000Z'
                ORDER BY t8.Field_008 ASC, CAST(t9.Field_001 AS INT) ASC
            `;
            const rawChequeData = await runSayanQuery(chequeSql);
            const processedCheques = rawChequeData.map((row: any) => ({
                ...row,
                bed: parseFloat(row.Bed || 0),
                bes: parseFloat(row.Bes || 0)
            }));
            setGuaranteeCheques(processedCheques);
        } catch (err: any) {
            toast.error(`خطا در واکشی صورتحساب: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredStatementData = statementData.filter(row => !statementSearch || (row.Description || '').includes(statementSearch) || String(row.SanadNo).includes(statementSearch));

    const handlePrintStatement = () => {
        if (filteredStatementData.length === 0) return;

        const tafsiliInfo = tafsilis.find(t => t.Code === selectedTafsili);
        const name = tafsiliInfo ? tafsiliInfo.Name : selectedTafsili;
        
        const hasCheques = guaranteeCheques.length > 0;
        const chequesSectionHtml = hasCheques ? `
            <div style="margin-top: 40px; border-top: 2px dashed #cbd5e1; padding-top: 20px;">
                <h2 style="font-size: 13px; margin-bottom: 12px; color: #1e293b; font-family: 'Tahoma', sans-serif;">لیست چک‌های تضمینی و تعهدات مرتبط</h2>
                <table>
                    <thead>
                        <tr>
                            <th style="background-color: #fef3c7; color: #92400e;">ردیف</th>
                            <th style="background-color: #fef3c7; color: #92400e;">تاریخ</th>
                            <th style="background-color: #fef3c7; color: #92400e;">شماره سند</th>
                            <th style="background-color: #fef3c7; color: #92400e;">سرفصل معین</th>
                            <th style="background-color: #fef3c7; color: #92400e;">شرح آرتیکل</th>
                            <th style="background-color: #fef3c7; color: #92400e;">مبلغ تضمین (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${guaranteeCheques.map((row, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${formatDateToJalali(row.Date)}</td>
                                <td>${row.SanadNo}</td>
                                <td>${row.MoeinGroup && row.MoeinParent && row.MoeinCode ? `${row.MoeinGroup}${row.MoeinParent}${row.MoeinCode} - ${row.MoeinName || 'سایر'}` : '-'}</td>
                                <td>${row.Description || ''}</td>
                                <td>${formatMoney(row.bed > 0 ? row.bed : row.bes)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '';

        const docHtml = `
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8">
                <title>ریز صورتحساب - ${name}</title>
                <style>
                    body { font-family: 'Tahoma', sans-serif; padding: 25px; background: #fff; }
                    .header { border-bottom: 2px solid #334155; padding-bottom: 10px; margin-bottom: 20px; }
                    .header h1 { font-size: 18px; margin: 0; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right; font-size: 11px; }
                    th { background-color: #f1f5f9; }
                    .total { font-weight: bold; background: #f8fafc; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ریز صورتحساب تراکنش‌ها</h1>
                    <p>شخص: <strong>${name} (کد: ${selectedTafsili})</strong></p>
                    <p>بازه گزارش: از ${formatDateToJalali(dateFrom)} تا ${formatDateToJalali(dateTo)}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ردیف</th>
                            <th>تاریخ</th>
                            <th>شماره سند</th>
                            <th>سرفصل معین</th>
                            <th>شرح تراکنش</th>
                            <th>بدهکار (ریال)</th>
                            <th>بستانکار (ریال)</th>
                            <th>مانده (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredStatementData.map((row, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${formatDateToJalali(row.Date)}</td>
                                <td>${row.SanadNo}</td>
                                <td>${row.MoeinGroup && row.MoeinParent && row.MoeinCode ? `${row.MoeinGroup}${row.MoeinParent}${row.MoeinCode} - ${row.MoeinName || 'سایر'}` : '-'}</td>
                                <td>${row.Description || ''}</td>
                                <td>${row.bed > 0 ? formatMoney(row.bed) : '۰'}</td>
                                <td>${row.bes > 0 ? formatMoney(row.bes) : '۰'}</td>
                                <td>${formatMoney(row.balance)} (${row.balance > 0 ? 'بدهکار' : row.balance < 0 ? 'بستانکار' : 'بی‌حساب'})</td>
                            </tr>
                        `).join('')}
                        <tr class="total">
                            <td colspan="5" style="text-align: left;">جمع کل:</td>
                            <td>${formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bed, 0))}</td>
                            <td>${formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bes, 0))}</td>
                            <td>${formatMoney(filteredStatementData[filteredStatementData.length - 1]?.balance || 0)}</td>
                        </tr>
                    </tbody>
                </table>
                ${chequesSectionHtml}
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    // ==========================================
    // TAB 3: SALES & COMPARISONS (گزارش فروش و مقایسه فصلی)
    // ==========================================
    const fetchSalesData = async () => {
        setIsLoading(true);
        try {
            const gregFrom = jalaliToGregorianStr(dateFrom);
            const gregTo = jalaliToGregorianStr(dateTo);
            
            const dateFilter = gregFrom && gregTo 
                ? `AND t10.Field_008 >= '${gregFrom}T00:00:00.000Z' AND t10.Field_008 <= '${gregTo}T23:59:59.000Z'` 
                : '';

            // Fetch Period A
            const sqlA = `
                SELECT 
                    t10.Field_001 as DocId,
                    t10.Field_006 as InvoiceNum,
                    t10.Field_008 as Date,
                    t10.Field_029 as Notes,
                    t10.Field_037 as HeaderPayable,
                    t10.Field_009 as OpCode,
                    t11.Field_005 as ItemCode,
                    COALESCE(t22.Field_004, t_name.ItemName, t11.Field_005, 'کالای بدون نام') as ItemName,
                    t11.Field_006 as Quantity,
                    t11.Field_031 as ItemNotes,
                    t11.Field_007 as Amount,
                    t11.Field_008 as Discount,
                    t11.Field_009 as NetAmount,
                    t11.Field_010 as VAT,
                    t11.Field_011 as Tax,
                    t11.Field_012 as FinalAmount,
                    t_group.GroupName,
                    t07.Field_006 as CustomerName
                FROM STR_TBL_010 t10
                INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                          AND t11.Field_003 = t10.Field_004
                                          AND t11.Field_012 = t10.Field_018
                                          AND (
                                              (t10.Field_009 IN ('3', '12', '23') AND t11.Field_036 = t10.Field_009)
                                              OR
                                              (t10.Field_009 = '13' AND t11.Field_036 IN ('3', '12', '23', '13'))
                                          )
                LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
                LEFT JOIN (
                    SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
                    FROM IND_TBL_021 t21_sub
                    LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
                    GROUP BY t21_sub.Field_004
                ) t_name ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_name.ItemCode))
                LEFT JOIN (
                    SELECT t21_sub.Field_004 as ItemCode, MIN(COALESCE(t02_grandparent.Field_003, t02_parent.Field_003, t02_sub.Field_003)) as GroupName
                    FROM IND_TBL_021 t21_sub
                    LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
                    LEFT JOIN IND_TBL_002 t02_parent ON RTRIM(LTRIM(t02_sub.Field_009)) = RTRIM(LTRIM(t02_parent.Field_008))
                    LEFT JOIN IND_TBL_002 t02_grandparent ON RTRIM(LTRIM(t02_parent.Field_009)) = RTRIM(LTRIM(t02_grandparent.Field_008))
                    GROUP BY t21_sub.Field_004
                ) t_group ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_group.ItemCode))
                LEFT JOIN ACT_TBL_007 t07 ON RTRIM(LTRIM(t10.Field_010)) = RTRIM(LTRIM(t07.Field_005)) AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
                WHERE (
                    (t10.Field_009 = '12' AND t11.Field_007 > 0)
                    OR
                    t10.Field_009 = '13'
                  )
                  ${dateFilter}
                ORDER BY t10.Field_008 DESC
            `;
            const dataA = await runSayanQuery(sqlA);

            const allocateSalesRows = (rawRows: any[]) => {
                const invMap = new Map<string, any[]>();
                rawRows.forEach(row => {
                    const docId = row.DocId || 'unknown';
                    if (!invMap.has(docId)) invMap.set(docId, []);
                    invMap.get(docId)!.push(row);
                });

                const processed: any[] = [];
                invMap.forEach((rows) => {
                    const headerPayable = parseFloat(rows[0].HeaderPayable || rows[0].Amount || 0);
                    const sumItemAmt = rows.reduce((s, r) => s + parseFloat(r.Amount || 0), 0);
                    const sumItemQty = rows.reduce((s, r) => s + parseFloat(r.Quantity || 0), 0);

                    rows.forEach(r => {
                        const itemAmt = parseFloat(r.Amount || 0);
                        const itemQty = parseFloat(r.Quantity || 0);
                        let allocatedAmt = 0;
                        if (headerPayable > 0) {
                            if (sumItemAmt > 0) {
                                allocatedAmt = headerPayable * (itemAmt / sumItemAmt);
                            } else if (sumItemQty > 0) {
                                allocatedAmt = headerPayable * (itemQty / sumItemQty);
                            } else {
                                allocatedAmt = headerPayable / rows.length;
                            }
                        } else {
                            allocatedAmt = itemAmt;
                        }
                        processed.push({
                            ...r,
                            Amount: allocatedAmt.toString(),
                            isOfficial: (() => {
                                const h = String(r.Notes || '').trim();
                                const i = String(r.ItemNotes || '').trim();
                                const hLower = h.toLowerCase();
                                const iLower = i.toLowerCase();
                                if (hLower.includes('غیر رسمی') || hLower.includes('غير رسمي') || iLower.includes('غیر رسمی') || iLower.includes('غير رسمي')) {
                                    return false;
                                }
                                return hLower.includes('رسمی') || hLower.includes('رسمي') || iLower.includes('رسمی') || iLower.includes('رسمي') || hLower.includes('ارزش افزوده') || iLower.includes('ارزش افزوده');
                            })()
                        });
                    });
                });
                return processed;
            };

            const processedA = allocateSalesRows(dataA);
            setSalesData(processedA);
            setCompareSalesDataA(processedA);

            // Fetch Period B for comparison if active
            if (compareMode && salesDateFromB && salesDateToB) {
                const gregFromB = jalaliToGregorianStr(salesDateFromB);
                const gregToB = jalaliToGregorianStr(salesDateToB);
                
                const dateFilterB = gregFromB && gregToB 
                    ? `AND t10.Field_008 >= '${gregFromB}T00:00:00.000Z' AND t10.Field_008 <= '${gregToB}T23:59:59.000Z'` 
                    : '';

                const sqlB = `
                    SELECT 
                        t10.Field_001 as DocId,
                        t10.Field_006 as InvoiceNum,
                        t10.Field_008 as Date,
                        t10.Field_029 as Notes,
                        t10.Field_037 as HeaderPayable,
                        t10.Field_009 as OpCode,
                        t11.Field_005 as ItemCode,
                        COALESCE(t22.Field_004, t_name.ItemName, t11.Field_005, 'کالای بدون نام') as ItemName,
                        t11.Field_006 as Quantity,
                        t11.Field_031 as ItemNotes,
                        t11.Field_007 as Amount,
                        t11.Field_008 as Discount,
                        t11.Field_009 as NetAmount,
                        t11.Field_010 as VAT,
                        t11.Field_011 as Tax,
                        t11.Field_012 as FinalAmount,
                        t_group.GroupName,
                        t07.Field_006 as CustomerName
                    FROM STR_TBL_010 t10
                    INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                              AND t11.Field_003 = t10.Field_004
                                              AND t11.Field_012 = t10.Field_018
                                              AND (
                                                  (t10.Field_009 IN ('3', '12', '23') AND t11.Field_036 = t10.Field_009)
                                                  OR
                                                  (t10.Field_009 = '13' AND t11.Field_036 IN ('3', '12', '23', '13'))
                                              )
                    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
                    LEFT JOIN (
                        SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
                        FROM IND_TBL_021 t21_sub
                        LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
                        GROUP BY t21_sub.Field_004
                    ) t_name ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_name.ItemCode))
                    LEFT JOIN (
                        SELECT t21_sub.Field_004 as ItemCode, MIN(COALESCE(t02_grandparent.Field_003, t02_parent.Field_003, t02_sub.Field_003)) as GroupName
                        FROM IND_TBL_021 t21_sub
                        LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
                        LEFT JOIN IND_TBL_002 t02_parent ON RTRIM(LTRIM(t02_sub.Field_009)) = RTRIM(LTRIM(t02_parent.Field_008))
                        LEFT JOIN IND_TBL_002 t02_grandparent ON RTRIM(LTRIM(t02_parent.Field_009)) = RTRIM(LTRIM(t02_grandparent.Field_008))
                        GROUP BY t21_sub.Field_004
                    ) t_group ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_group.ItemCode))
                    LEFT JOIN ACT_TBL_007 t07 ON RTRIM(LTRIM(t10.Field_010)) = RTRIM(LTRIM(t07.Field_005)) AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
                    WHERE (
                        (t10.Field_009 = '12' AND t11.Field_007 > 0)
                        OR
                        t10.Field_009 = '13'
                      )
                      ${dateFilterB}
                    ORDER BY t10.Field_008 DESC
                `;
                const dataB = await runSayanQuery(sqlB);
                const processedB = allocateSalesRows(dataB);
                setCompareSalesDataB(processedB);
            }
        } catch (err: any) {
            toast.error(`خطا در واکشی اطلاعات فروش: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate sales overviews for Period A (Daily, Monthly, Quarterly, Yearly, and Selected Range)
    const getSalesOverviewStats = () => {
        const stats = {
            todaySalesAmt: 0, todaySalesQty: 0, todayRetAmt: 0, todayRetQty: 0, todayNetAmt: 0, todayNetQty: 0, todayFinalPrice: 0,
            monthSalesAmt: 0, monthSalesQty: 0, monthRetAmt: 0, monthRetQty: 0, monthNetAmt: 0, monthNetQty: 0, monthFinalPrice: 0,
            quarterSalesAmt: 0, quarterSalesQty: 0, quarterRetAmt: 0, quarterRetQty: 0, quarterNetAmt: 0, quarterNetQty: 0, quarterFinalPrice: 0,
            yearSalesAmt: 0, yearSalesQty: 0, yearRetAmt: 0, yearRetQty: 0, yearNetAmt: 0, yearNetQty: 0, yearFinalPrice: 0,
            rangeSalesAmt: 0, rangeSalesQty: 0, rangeRetAmt: 0, rangeRetQty: 0, rangeNetAmt: 0, rangeNetQty: 0, rangeFinalPrice: 0,
            // legacy getters compatibility
            todayAmt: 0, todayQty: 0, rangeAmt: 0, rangeQty: 0, monthAmt: 0, monthQty: 0, quarterAmt: 0, quarterQty: 0, yearAmt: 0, yearQty: 0
        };

        const now = new Date();
        const jNow = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
        const activeYear = getActiveFiscalYearLabel();
        const activeYearNum = activeYear ? parseInt(activeYear.toString(), 10) : jNow.jy;

        salesData.forEach(row => {
            const qty = isActualProduct(row) ? (parseFloat(row.Quantity || 0) || 0) : 0;
            const amt = parseFloat(row.Amount || 0);
            const isReturn = row.OpCode === '13';

            if (isReturn) {
                stats.rangeRetAmt += amt;
                stats.rangeRetQty += qty;
            } else {
                stats.rangeSalesAmt += amt;
                stats.rangeSalesQty += qty;
            }
            
            const jRow = (() => {
                if (!row.Date) return { jy: 0, jm: 0, jd: 0 };
                try {
                    const match = row.Date.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
                    if (match) {
                        const gy = parseInt(match[1], 10);
                        const gm = parseInt(match[2], 10);
                        const gd = parseInt(match[3], 10);
                        return jalaali.toJalaali(gy, gm, gd);
                    }
                    const d = new Date(row.Date);
                    if (isNaN(d.getTime())) return { jy: 0, jm: 0, jd: 0 };
                    const iranTime = new Date(d.getTime() + (3.5 * 60 * 60 * 1000));
                    return jalaali.toJalaali(iranTime.getUTCFullYear(), iranTime.getUTCMonth() + 1, iranTime.getUTCDate());
                } catch {
                    return { jy: 0, jm: 0, jd: 0 };
                }
            })();

            // Yearly (Active/Selected Fiscal Year)
            if (jRow.jy === activeYearNum) {
                if (isReturn) {
                    stats.yearRetAmt += amt;
                    stats.yearRetQty += qty;
                } else {
                    stats.yearSalesAmt += amt;
                    stats.yearSalesQty += qty;
                }

                // Monthly (Current Persian Month or loaded month matches)
                if (jRow.jm === jNow.jm) {
                    if (isReturn) {
                        stats.monthRetAmt += amt;
                        stats.monthRetQty += qty;
                    } else {
                        stats.monthSalesAmt += amt;
                        stats.monthSalesQty += qty;
                    }

                    // Daily (Current Persian Day)
                    if (jRow.jd === jNow.jd) {
                        if (isReturn) {
                            stats.todayRetAmt += amt;
                            stats.todayRetQty += qty;
                        } else {
                            stats.todaySalesAmt += amt;
                            stats.todaySalesQty += qty;
                        }
                    }
                }

                // Quarterly
                const rowQuarter = Math.ceil(jRow.jm / 3);
                const nowQuarter = Math.ceil(jNow.jm / 3);
                if (rowQuarter === nowQuarter) {
                    if (isReturn) {
                        stats.quarterRetAmt += amt;
                        stats.quarterRetQty += qty;
                    } else {
                        stats.quarterSalesAmt += amt;
                        stats.quarterSalesQty += qty;
                    }
                }
            }
        });

        stats.rangeNetAmt = stats.rangeSalesAmt - stats.rangeRetAmt;
        stats.rangeNetQty = stats.rangeSalesQty - stats.rangeRetQty;
        stats.rangeFinalPrice = stats.rangeNetQty > 0 ? (stats.rangeNetAmt / stats.rangeNetQty) : 0;

        stats.todayNetAmt = stats.todaySalesAmt - stats.todayRetAmt;
        stats.todayNetQty = stats.todaySalesQty - stats.todayRetQty;
        stats.todayFinalPrice = stats.todayNetQty > 0 ? (stats.todayNetAmt / stats.todayNetQty) : 0;

        stats.monthNetAmt = stats.monthSalesAmt - stats.monthRetAmt;
        stats.monthNetQty = stats.monthSalesQty - stats.monthRetQty;
        stats.monthFinalPrice = stats.monthNetQty > 0 ? (stats.monthNetAmt / stats.monthNetQty) : 0;

        stats.quarterNetAmt = stats.quarterSalesAmt - stats.quarterRetAmt;
        stats.quarterNetQty = stats.quarterSalesQty - stats.quarterRetQty;
        stats.quarterFinalPrice = stats.quarterNetQty > 0 ? (stats.quarterNetAmt / stats.quarterNetQty) : 0;

        stats.yearNetAmt = stats.yearSalesAmt - stats.yearRetAmt;
        stats.yearNetQty = stats.yearSalesQty - stats.yearRetQty;
        stats.yearFinalPrice = stats.yearNetQty > 0 ? (stats.yearNetAmt / stats.yearNetQty) : 0;

        // Legacy compatibility shortcuts
        stats.todayAmt = stats.todayNetAmt;
        stats.todayQty = stats.todayNetQty;
        stats.rangeAmt = stats.rangeNetAmt;
        stats.rangeQty = stats.rangeNetQty;
        stats.monthAmt = stats.monthNetAmt;
        stats.monthQty = stats.monthNetQty;
        stats.quarterAmt = stats.quarterNetAmt;
        stats.quarterQty = stats.quarterNetQty;
        stats.yearAmt = stats.yearNetAmt;
        stats.yearQty = stats.yearNetQty;

        return stats;
    };

    const getTodayInvoices = (specificDate?: string) => {
        const todayJalali = (() => {
            const today = new Date();
            const iranToday = new Date(today.getTime() + (3.5 * 60 * 60 * 1000));
            const jToday = jalaali.toJalaali(iranToday.getUTCFullYear(), iranToday.getUTCMonth() + 1, iranToday.getUTCDate());
            return `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
        })();
        const targetDate = specificDate || todayJalali;

        const normalizeJalali = (str: string) => {
            if (!str) return '';
            // Convert Persian/Arabic digits
            let clean = str.trim()
                .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
            
            // If it's a Gregorian timestamp, formatDateToJalali can handle it
            if (clean.includes('T') || clean.includes('Z') || (/^\d{4}-\d{2}-\d{2}/.test(clean))) {
                const formatted = formatDateToJalali(clean);
                const parts = formatted.split('/');
                return parts.length === 3 ? `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}` : formatted;
            }

            // Otherwise, it's a Shamsi string (possibly in different formats: YYYY/MM/DD, DD/MM/YYYY, with dots/slashes/dashes)
            const parts = clean.split(/[\/\.\-]/);
            if (parts.length === 3) {
                let part0 = parseInt(parts[0], 10);
                let part1 = parseInt(parts[1], 10);
                let part2 = parseInt(parts[2], 10);
                
                if (!isNaN(part0) && !isNaN(part1) && !isNaN(part2)) {
                    let jy = 0, jm = 0, jd = 0;
                    if (part2 >= 100) {
                        jy = part2;
                        jm = part1;
                        jd = part0;
                    } else if (part0 >= 100) {
                        jy = part0;
                        jm = part1;
                        jd = part2;
                    } else {
                        if (part0 > 12) {
                            jy = part2;
                            jm = part1;
                            jd = part0;
                        } else {
                            jy = part0;
                            jm = part1;
                            jd = part2;
                        }
                    }
                    
                    if (jy < 100) {
                        jy += 1400;
                    } else if (jy >= 100 && jy < 1000) {
                        jy += 1000;
                    }
                    
                    if (jm > 12 && jd <= 12) {
                        const temp = jm;
                        jm = jd;
                        jd = temp;
                    }
                    
                    return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
                }
            }
            
            // Fallback to formatDateToJalali
            const formatted = formatDateToJalali(clean);
            const p = formatted.split('/');
            return p.length === 3 ? `${p[0]}/${p[1].padStart(2, '0')}/${p[2].padStart(2, '0')}` : formatted;
        };

        const targetNorm = normalizeJalali(targetDate);
        return salesData.filter(row => normalizeJalali(row.Date) === targetNorm);
    };

    const handleSendSalesBotReport = async (targetDate: 'today' | 'yesterday') => {
        const label = targetDate === 'today' ? 'امروز' : 'دیروز';
        if (!confirm(`آیا از ارسال گزارش فروش ${label} به گروه‌های تلگرام / بله اطمینان دارید؟`)) return;
        setIsSendingSalesBot(true);
        try {
            const res = await fetch(getEffectiveApiUrl('/api/sayan/sales-report/send-manual'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    targetDate,
                    activeYear: getActiveFiscalYearLabel()
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || `گزارش فروش ${label} با موفقیت ارسال شد.`);
            } else {
                toast.error(data.error || 'خطا در ارسال گزارش فروش.');
            }
        } catch (e: any) {
            toast.error("خطا در ارسال گزارش: " + e.message);
        } finally {
            setIsSendingSalesBot(false);
        }
    };

    const handlePrintTodaySales = () => {
        const todayInvs = getTodayInvoices();
        const activeDate = dateTo || formatDateToJalali(new Date().toISOString());
        const title = `گزارش مدیریتی و رسمی فروش روزانه (${activeDate})`;

        // Group todayInvs by GroupName and ItemName with returns & net calculations
        const groupedMap = new Map<string, { 
            itemName: string; 
            groupName: string; 
            grossQty: number; 
            grossAmt: number; 
            retQty: number; 
            retAmt: number;
        }>();

        let totalGrossAmt = 0;
        let totalGrossQty = 0;
        let totalRetAmt = 0;
        let totalRetQty = 0;

        todayInvs.forEach(inv => {
            const key = `${inv.GroupName || ''}_${inv.ItemName || ''}`;
            const qty = parseFloat(inv.Quantity || 0);
            const amt = parseFloat(inv.Amount || 0);
            const isReturn = inv.OpCode === '13';

            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    itemName: inv.ItemName || 'کالای بدون نام',
                    groupName: inv.GroupName || 'سایر گروه‌ها',
                    grossQty: 0,
                    grossAmt: 0,
                    retQty: 0,
                    retAmt: 0
                });
            }
            const item = groupedMap.get(key)!;
            if (isReturn) {
                item.retQty += qty;
                item.retAmt += amt;
                totalRetQty += qty;
                totalRetAmt += amt;
            } else {
                item.grossQty += qty;
                item.grossAmt += amt;
                totalGrossQty += qty;
                totalGrossAmt += amt;
            }
        });
        
        const groupedRows = Array.from(groupedMap.values());
        const totalNetAmt = totalGrossAmt - totalRetAmt;
        const totalNetQty = totalGrossQty - totalRetQty;
        const totalNetFee = totalNetQty > 0 ? (totalNetAmt / totalNetQty) : 0;
        const totalUniqueInvs = new Set(todayInvs.map(inv => inv.InvoiceNum || inv.DocId)).size;

        const docHtml = `
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>
                    body { font-family: 'Tahoma', 'Segoe UI', sans-serif; padding: 25px; background: #fff; color: #1e293b; font-size: 11px; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 20px; color: #0f172a; font-weight: bold; }
                    .header p { margin: 4px 0 0; font-size: 12px; color: #64748b; }
                    .stats-container { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
                    .stat-card { border: 1px solid #cbd5e1; background: #f8fafc; padding: 10px; border-radius: 8px; text-align: center; }
                    .stat-card h3 { margin: 0 0 4px 0; font-size: 10px; color: #64748b; font-weight: bold; }
                    .stat-card p { margin: 0; font-size: 14px; font-weight: 800; color: #0f172a; font-family: monospace; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; font-size: 11px; line-height: 1.4; }
                    th { background-color: #0f172a; color: white; font-weight: bold; border: 1px solid #334155; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    .total { font-weight: bold; background: #1e293b !important; color: white !important; }
                    .total td { border-color: #475569; color: white; }
                    .ret { color: #e11d48; font-weight: bold; }
                    .net { color: #15803d; font-weight: bold; }
                    .footer { text-align: center; margin-top: 35px; font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
                    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 40px; text-align: center; font-size: 11px; font-weight: bold; }
                    .signature-box { height: 60px; border-bottom: 1px dashed #94a3b8; margin-top: 8px; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>${title}</h1>
                        <p>سیستم یکپارچه گزارشات مدیریتی سایان ERP - تفکیک فروش عادی و مرجوعی</p>
                    </div>
                    <div style="text-align: left;">
                        <p>تاریخ فاکتورها: <strong>${activeDate}</strong></p>
                        <p>تاریخ چاپ: ${formatDateToJalali(new Date().toISOString())}</p>
                    </div>
                </div>

                <div class="stats-container">
                    <div class="stat-card">
                        <h3>فروش ناخالص (ریال)</h3>
                        <p>${formatMoney(totalGrossAmt)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>مرجوعی کد ۱۳ (ریال)</h3>
                        <p class="ret">${formatMoney(totalRetAmt)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>فروش خالص نهایی (ریال)</h3>
                        <p class="net">${formatMoney(totalNetAmt)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>وزن خالص کل (ک‌گ)</h3>
                        <p>${totalNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p>
                    </div>
                    <div class="stat-card">
                        <h3>فی خالص نهایی (ریال/ک‌گ)</h3>
                        <p>${formatMoney(Math.round(totalNetFee))}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 35px;">ردیف</th>
                            <th>گروه کالا</th>
                            <th>نام کالا / محصول</th>
                            <th>فروش ناخالص (ک‌گ / ریال)</th>
                            <th>مرجوعی کد ۱۳ (ک‌گ / ریال)</th>
                            <th>فروش خالص نهایی (ک‌گ / ریال)</th>
                            <th>فی خالص نهایی (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${groupedRows.length > 0 ? groupedRows.map((row, idx) => {
                            const netAmt = row.grossAmt - row.retAmt;
                            const netQty = row.grossQty - row.retQty;
                            const netFee = netQty > 0 ? (netAmt / netQty) : 0;
                            return `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td style="font-weight: bold; color: #334155;">${row.groupName}</td>
                                    <td style="text-align: right; font-weight: 600;">${row.itemName}</td>
                                    <td>
                                        ${row.grossQty.toFixed(1)} ک‌گ<br/>
                                        <span style="font-family: monospace;">${formatMoney(row.grossAmt)}</span>
                                    </td>
                                    <td className="ret">
                                        ${row.retQty > 0 ? `${row.retQty.toFixed(1)} ک‌گ<br/><span style="font-family: monospace; color: #e11d48;">${formatMoney(row.retAmt)}</span>` : '-'}
                                    </td>
                                    <td className="net">
                                        <strong>${netQty.toFixed(1)} ک‌گ</strong><br/>
                                        <span style="font-family: monospace; font-weight: bold; color: #15803d;">${formatMoney(netAmt)}</span>
                                    </td>
                                    <td style="font-family: monospace; font-weight: bold;">${formatMoney(Math.round(netFee))}</td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="7" style="text-align: center; padding: 30px; color: #64748b;">هیچ فاکتور فروشی برای این روز ثبت نشده است.</td>
                            </tr>
                        `}
                        ${groupedRows.length > 0 ? `
                        <tr class="total">
                            <td colspan="3" style="text-align: left;">جمع کل فروش روزانه:</td>
                            <td>${totalGrossQty.toFixed(1)} ک‌گ<br/>${formatMoney(totalGrossAmt)}</td>
                            <td>${totalRetQty.toFixed(1)} ک‌گ<br/>${formatMoney(totalRetAmt)}</td>
                            <td>${totalNetQty.toFixed(1)} ک‌گ<br/>${formatMoney(totalNetAmt)}</td>
                            <td>${formatMoney(Math.round(totalNetFee))}</td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>

                <div class="signatures">
                    <div>
                        <p>امضا تهیه کننده</p>
                        <div class="signature-box"></div>
                    </div>
                    <div>
                        <p>امضا مدیر مالی</p>
                        <div class="signature-box"></div>
                    </div>
                    <div>
                        <p>امضا مدیریت عامل</p>
                        <div class="signature-box"></div>
                    </div>
                </div>

                <div class="footer">
                    <p>گزارش رسمی فروش صادره از درگاه سایان ERP - مجموع فاکتورهای ثبت شده: ${totalUniqueInvs}</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    const handlePrintPeriodSales = () => {
        const title = `گزارش جامع و مدیریتی فروش دوره‌ای (${dateFrom} تا ${dateTo})`;

        // Group salesData by GroupName and ItemName with returns & net calculations
        const groupedMap = new Map<string, { 
            itemName: string; 
            groupName: string; 
            grossQty: number; 
            grossAmt: number; 
            retQty: number; 
            retAmt: number;
        }>();

        let totalGrossAmt = 0;
        let totalGrossQty = 0;
        let totalRetAmt = 0;
        let totalRetQty = 0;

        salesData.forEach(row => {
            const key = `${row.GroupName || ''}_${row.ItemName || ''}`;
            const qty = isActualProduct(row) ? (parseFloat(row.Quantity || 0) || 0) : 0;
            const amt = parseFloat(row.Amount || 0);
            const isReturn = row.OpCode === '13';

            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    itemName: row.ItemName || 'کالای بدون نام',
                    groupName: row.GroupName || 'سایر گروه‌ها',
                    grossQty: 0,
                    grossAmt: 0,
                    retQty: 0,
                    retAmt: 0
                });
            }
            const item = groupedMap.get(key)!;
            if (isReturn) {
                item.retQty += qty;
                item.retAmt += amt;
                totalRetQty += qty;
                totalRetAmt += amt;
            } else {
                item.grossQty += qty;
                item.grossAmt += amt;
                totalGrossQty += qty;
                totalGrossAmt += amt;
            }
        });
        
        const groupedRows = Array.from(groupedMap.values());
        const totalNetAmt = totalGrossAmt - totalRetAmt;
        const totalNetQty = totalGrossQty - totalRetQty;
        const totalNetFee = totalNetQty > 0 ? (totalNetAmt / totalNetQty) : 0;

        const docHtml = `
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>
                    body { font-family: 'Tahoma', 'Segoe UI', sans-serif; padding: 25px; background: #fff; color: #1e293b; font-size: 11px; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 20px; color: #0f172a; font-weight: bold; }
                    .header p { margin: 4px 0 0; font-size: 12px; color: #64748b; }
                    .stats-container { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
                    .stat-card { border: 1px solid #cbd5e1; background: #f8fafc; padding: 10px; border-radius: 8px; text-align: center; }
                    .stat-card h3 { margin: 0 0 4px 0; font-size: 10px; color: #64748b; font-weight: bold; }
                    .stat-card p { margin: 0; font-size: 14px; font-weight: 800; color: #0f172a; font-family: monospace; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; font-size: 11px; line-height: 1.4; }
                    th { background-color: #0f172a; color: white; font-weight: bold; border: 1px solid #334155; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    .total { font-weight: bold; background: #1e293b !important; color: white !important; }
                    .total td { border-color: #475569; color: white; }
                    .ret { color: #e11d48; font-weight: bold; }
                    .net { color: #15803d; font-weight: bold; }
                    .footer { text-align: center; margin-top: 35px; font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
                    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 40px; text-align: center; font-size: 11px; font-weight: bold; }
                    .signature-box { height: 60px; border-bottom: 1px dashed #94a3b8; margin-top: 8px; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>${title}</h1>
                        <p>سامانه مدیریت هوشمند و تحلیل فروش سایان ERP</p>
                    </div>
                    <div style="text-align: left;">
                        <p>بازه زمانی: <strong>از ${dateFrom} تا ${dateTo}</strong></p>
                        <p>تاریخ صدور: ${formatDateToJalali(new Date().toISOString())}</p>
                    </div>
                </div>

                <div class="stats-container">
                    <div class="stat-card">
                        <h3>فروش ناخالص (ریال)</h3>
                        <p>${formatMoney(totalGrossAmt)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>مرجوعی کد ۱۳ (ریال)</h3>
                        <p class="ret">${formatMoney(totalRetAmt)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>فروش خالص نهایی (ریال)</h3>
                        <p class="net">${formatMoney(totalNetAmt)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>وزن خالص کل (ک‌گ)</h3>
                        <p>${totalNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p>
                    </div>
                    <div class="stat-card">
                        <h3>فی خالص نهایی (ریال/ک‌گ)</h3>
                        <p>${formatMoney(Math.round(totalNetFee))}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 35px;">ردیف</th>
                            <th>گروه کالا</th>
                            <th>نام کالا / محصول</th>
                            <th>فروش ناخالص (ک‌گ / ریال)</th>
                            <th>مرجوعی کد ۱۳ (ک‌گ / ریال)</th>
                            <th>فروش خالص نهایی (ک‌گ / ریال)</th>
                            <th>فی خالص نهایی (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${groupedRows.slice(0, 1000).map((row, idx) => {
                            const netAmt = row.grossAmt - row.retAmt;
                            const netQty = row.grossQty - row.retQty;
                            const netFee = netQty > 0 ? (netAmt / netQty) : 0;
                            return `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td style="font-weight: bold; color: #334155;">${row.groupName}</td>
                                    <td style="text-align: right; font-weight: 600;">${row.itemName}</td>
                                    <td>
                                        ${row.grossQty.toFixed(1)} ک‌گ<br/>
                                        <span style="font-family: monospace;">${formatMoney(row.grossAmt)}</span>
                                    </td>
                                    <td>
                                        ${row.retQty > 0 ? `<span class="ret">${row.retQty.toFixed(1)} ک‌گ</span><br/><span style="font-family: monospace; color: #e11d48;">${formatMoney(row.retAmt)}</span>` : '-'}
                                    </td>
                                    <td>
                                        <strong>${netQty.toFixed(1)} ک‌گ</strong><br/>
                                        <span style="font-family: monospace; font-weight: bold; color: #15803d;">${formatMoney(netAmt)}</span>
                                    </td>
                                    <td style="font-family: monospace; font-weight: bold;">${formatMoney(Math.round(netFee))}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${groupedRows.length > 1000 ? `
                            <tr>
                                <td colspan="7" style="text-align: center; color: #475569; font-weight: bold; background-color: #fef08a;">
                                    نمایش ۱۰۰۰ ردیف اول از مجموع ${groupedRows.length} ردیف جهت کارایی چاپ
                                </td>
                            </tr>
                        ` : ''}
                        <tr class="total">
                            <td colspan="3" style="text-align: left;">جمع کل بازه:</td>
                            <td>${totalGrossQty.toFixed(1)} ک‌گ<br/>${formatMoney(totalGrossAmt)}</td>
                            <td>${totalRetQty.toFixed(1)} ک‌گ<br/>${formatMoney(totalRetAmt)}</td>
                            <td>${totalNetQty.toFixed(1)} ک‌گ<br/>${formatMoney(totalNetAmt)}</td>
                            <td>${formatMoney(Math.round(totalNetFee))}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="signatures">
                    <div>
                        <p>امضا تهیه کننده</p>
                        <div class="signature-box"></div>
                    </div>
                    <div>
                        <p>امضا مدیر مالی</p>
                        <div class="signature-box"></div>
                    </div>
                    <div>
                        <p>امضا مدیریت عامل</p>
                        <div class="signature-box"></div>
                    </div>
                </div>

                <div class="footer">
                    <p>گزارش رسمی فروش صادره از درگاه سایان ERP - مجموع اقلام ثبت شده: ${salesData.length}</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    // Preset generator for quick Period B selection
    const applyQuickComparePreset = (preset: 'prev_year' | 'prev_month' | 'prev_quarter') => {
        if (!dateFrom || !dateTo) return;
        try {
            const partsFrom = dateFrom.split('/');
            const partsTo = dateTo.split('/');
            if (partsFrom.length === 3 && partsTo.length === 3) {
                const yFrom = parseInt(partsFrom[0], 10);
                const mFrom = parseInt(partsFrom[1], 10);
                const dFrom = parseInt(partsFrom[2], 10);
                const yTo = parseInt(partsTo[0], 10);
                const mTo = parseInt(partsTo[1], 10);
                const dTo = parseInt(partsTo[2], 10);

                if (preset === 'prev_year') {
                    const bFrom = `${yFrom - 1}/${String(mFrom).padStart(2, '0')}/${String(dFrom).padStart(2, '0')}`;
                    const bTo = `${yTo - 1}/${String(mTo).padStart(2, '0')}/${String(dTo).padStart(2, '0')}`;
                    setSalesDateFromB(bFrom);
                    setSalesDateToB(bTo);
                    toast.success(`بازه دوم به همسان سال قبل (${bFrom} تا ${bTo}) تغییر یافت.`);
                } else if (preset === 'prev_month') {
                    let prevMFrom = mFrom - 1;
                    let prevYFrom = yFrom;
                    if (prevMFrom < 1) { prevMFrom = 12; prevYFrom--; }
                    
                    let prevMTo = mTo - 1;
                    let prevYTo = yTo;
                    if (prevMTo < 1) { prevMTo = 12; prevYTo--; }

                    const bFrom = `${prevYFrom}/${String(prevMFrom).padStart(2, '0')}/${String(dFrom).padStart(2, '0')}`;
                    const bTo = `${prevYTo}/${String(prevMTo).padStart(2, '0')}/${String(dTo).padStart(2, '0')}`;
                    setSalesDateFromB(bFrom);
                    setSalesDateToB(bTo);
                    toast.success(`بازه دوم به ماه قبل (${bFrom} تا ${bTo}) تغییر یافت.`);
                } else if (preset === 'prev_quarter') {
                    let prevMFrom = mFrom - 3;
                    let prevYFrom = yFrom;
                    if (prevMFrom < 1) { prevMFrom += 12; prevYFrom--; }

                    let prevMTo = mTo - 3;
                    let prevYTo = yTo;
                    if (prevMTo < 1) { prevMTo += 12; prevYTo--; }

                    const bFrom = `${prevYFrom}/${String(prevMFrom).padStart(2, '0')}/${String(dFrom).padStart(2, '0')}`;
                    const bTo = `${prevYTo}/${String(prevMTo).padStart(2, '0')}/${String(dTo).padStart(2, '0')}`;
                    setSalesDateFromB(bFrom);
                    setSalesDateToB(bTo);
                    toast.success(`بازه دوم به فصل قبل (${bFrom} تا ${bTo}) تغییر یافت.`);
                }
            }
        } catch {
            toast.error('امکان محاسبه بازه خودکار وجود ندارد.');
        }
    };

    // Print Comparative Sales PDF
    const handlePrintComparativeSales = () => {
        const title = `گزارش تحلیلی و مقایسه‌ای فروش سایان (${dateFrom} تا ${dateTo} در مقایسه با ${salesDateFromB} تا ${salesDateToB})`;
        const data = getComparisonChartData();

        let sumNetWA = 0, sumNetWB = 0, sumNetAmtA = 0, sumNetAmtB = 0, sumRetWA = 0, sumRetWB = 0;
        data.forEach(r => {
            sumNetWA += r.netWeightA || 0;
            sumNetWB += r.netWeightB || 0;
            sumNetAmtA += r.netAmountA || 0;
            sumNetAmtB += r.netAmountB || 0;
            sumRetWA += r.retWeightA || 0;
            sumRetWB += r.retWeightB || 0;
        });

        const totalWeightDiff = sumNetWB ? ((sumNetWA - sumNetWB) / sumNetWB) * 100 : 0;
        const totalAmountDiff = sumNetAmtB ? ((sumNetAmtA - sumNetAmtB) / sumNetAmtB) * 100 : 0;
        const avgFeeA = sumNetWA ? (sumNetAmtA / sumNetWA) : 0;
        const avgFeeB = sumNetWB ? (sumNetAmtB / sumNetWB) : 0;
        const totalFeeDiff = avgFeeB ? ((avgFeeA - avgFeeB) / avgFeeB) * 100 : 0;

        const docHtml = `
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>
                    body { font-family: Tahoma, 'B Nazanin', Arial, sans-serif; margin: 25px; direction: rtl; color: #1e293b; font-size: 11px; }
                    .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 18px; color: #1e3a8a; }
                    .header p { margin: 5px 0 0 0; color: #64748b; font-size: 12px; }
                    .info-box { display: flex; justify-content: space-between; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 18px; margin-bottom: 20px; }
                    .info-box div { line-height: 1.6; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                    th { background-color: #0f172a; color: white; padding: 10px 6px; text-align: center; border: 1px solid #334155; font-weight: bold; }
                    td { border: 1px solid #cbd5e1; padding: 8px 6px; text-align: center; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    .total { background-color: #1e293b !important; color: white !important; font-weight: bold; }
                    .total td { border-color: #475569; color: white; }
                    .pos { color: #16a34a; font-weight: bold; }
                    .neg { color: #dc2626; font-weight: bold; }
                    .ret { color: #e11d48; font-size: 9px; }
                    .signatures { display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid; }
                    .signatures div { text-align: center; width: 30%; }
                    .signature-box { height: 60px; border-bottom: 1px dashed #94a3b8; margin-top: 10px; }
                    .footer { text-align: center; margin-top: 30px; font-size: 9px; color: #94a3b8; border-t: 1px solid #e2e8f0; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>گزارش رسمـی و تحلیلی مقایسه‌ای فروش (سایان ERP)</h1>
                    <p>پایش مقایسه‌ای وزن، مرجوعی کد ۱۳، مبلغ خالص و تغییرات فی نهایی اقلام</p>
                </div>
                <div class="info-box">
                    <div>
                        <strong>بازه اول (A):</strong> ${dateFrom} تا ${dateTo}<br/>
                        <strong>بازه دوم (B):</strong> ${salesDateFromB} تا ${salesDateToB}
                    </div>
                    <div>
                        <strong>نحوه تفکیک:</strong> ${compareGroupBy === 'group' ? 'گروه کالا' : 'نام دقیق محصول'}<br/>
                        <strong>تاریخ صدور گزارش:</strong> ${formatDateToJalali(new Date().toISOString())}
                    </div>
                    <div>
                        <strong>رشد وزن کل:</strong> <span class="${totalWeightDiff >= 0 ? 'pos' : 'neg'}">${totalWeightDiff >= 0 ? '+' : ''}${totalWeightDiff.toFixed(1)}%</span><br/>
                        <strong>رشد مبلغ کل:</strong> <span class="${totalAmountDiff >= 0 ? 'pos' : 'neg'}">${totalAmountDiff >= 0 ? '+' : ''}${totalAmountDiff.toFixed(1)}%</span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 30px;">ردیف</th>
                            <th>نام ${compareGroupBy === 'group' ? 'گروه کالا' : 'محصول'}</th>
                            <th>وزن خالص A (ک‌گ)<br/><span style="font-size: 9px; font-weight: normal; color: #cbd5e1;">(مرجوعی)</span></th>
                            <th>مبلغ خالص A (ریال)</th>
                            <th>فی نهایی A (ریال)</th>
                            <th>وزن خالص B (ک‌گ)<br/><span style="font-size: 9px; font-weight: normal; color: #cbd5e1;">(مرجوعی)</span></th>
                            <th>مبلغ خالص B (ریال)</th>
                            <th>فی نهایی B (ریال)</th>
                            <th>تغییر وزن (%)</th>
                            <th>تغییر مبلغ (%)</th>
                            <th>تغییر فی (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((row, idx) => {
                            const wDiff = row.netWeightB ? ((row.netWeightA - row.netWeightB) / row.netWeightB) * 100 : 0;
                            const aDiff = row.netAmountB ? ((row.netAmountA - row.netAmountB) / row.netAmountB) * 100 : 0;
                            const feeA = row.finalPriceA || (row.netWeightA ? row.netAmountA / row.netWeightA : 0);
                            const feeB = row.finalPriceB || (row.netWeightB ? row.netAmountB / row.netWeightB : 0);
                            const feeDiff = feeB ? ((feeA - feeB) / feeB) * 100 : 0;

                            return `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td style="text-align: right; font-weight: bold;">${row.name}</td>
                                    <td>
                                        <strong>${row.netWeightA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
                                        ${row.retWeightA > 0 ? `<br/><span class="ret">مرجوعی: ${row.retWeightA.toFixed(1)}</span>` : ''}
                                    </td>
                                    <td style="text-align: left; font-family: monospace;">${formatMoney(row.netAmountA)}</td>
                                    <td style="text-align: left; font-family: monospace;">${formatMoney(Math.round(feeA))}</td>
                                    <td>
                                        <strong>${row.netWeightB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
                                        ${row.retWeightB > 0 ? `<br/><span class="ret">مرجوعی: ${row.retWeightB.toFixed(1)}</span>` : ''}
                                    </td>
                                    <td style="text-align: left; font-family: monospace;">${formatMoney(row.netAmountB)}</td>
                                    <td style="text-align: left; font-family: monospace;">${formatMoney(Math.round(feeB))}</td>
                                    <td class="${wDiff >= 0 ? 'pos' : 'neg'}">${wDiff >= 0 ? '+' : ''}${wDiff.toFixed(1)}%</td>
                                    <td class="${aDiff >= 0 ? 'pos' : 'neg'}">${aDiff >= 0 ? '+' : ''}${aDiff.toFixed(1)}%</td>
                                    <td class="${feeDiff >= 0 ? 'pos' : 'neg'}">${feeDiff >= 0 ? '+' : ''}${feeDiff.toFixed(1)}%</td>
                                </tr>
                            `;
                        }).join('')}
                        <tr class="total">
                            <td colspan="2" style="text-align: right;">جمع کل عملکرد کارخانه:</td>
                            <td>${sumNetWA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                            <td style="text-align: left;">${formatMoney(sumNetAmtA)}</td>
                            <td style="text-align: left;">${formatMoney(Math.round(avgFeeA))}</td>
                            <td>${sumNetWB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                            <td style="text-align: left;">${formatMoney(sumNetAmtB)}</td>
                            <td style="text-align: left;">${formatMoney(Math.round(avgFeeB))}</td>
                            <td class="${totalWeightDiff >= 0 ? 'pos' : 'neg'}">${totalWeightDiff >= 0 ? '+' : ''}${totalWeightDiff.toFixed(1)}%</td>
                            <td class="${totalAmountDiff >= 0 ? 'pos' : 'neg'}">${totalAmountDiff >= 0 ? '+' : ''}${totalAmountDiff.toFixed(1)}%</td>
                            <td class="${totalFeeDiff >= 0 ? 'pos' : 'neg'}">${totalFeeDiff >= 0 ? '+' : ''}${totalFeeDiff.toFixed(1)}%</td>
                        </tr>
                    </tbody>
                </table>

                <div class="signatures">
                    <div>
                        <p>امضا تهیه کننده / واحد فروش</p>
                        <div class="signature-box"></div>
                    </div>
                    <div>
                        <p>امضا مدیر مالی</p>
                        <div class="signature-box"></div>
                    </div>
                    <div>
                        <p>امضا مدیریت عامل</p>
                        <div class="signature-box"></div>
                    </div>
                </div>

                <div class="footer">
                    <p>سامانه مدیریت هوشمند و گزارشات مالی کارخانه سایان ERP - نسخه چاپ رسمی پایش مقایسه‌ای</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    const applyProdQuickComparePreset = (type: 'prev_year' | 'prev_season') => {
        try {
            const partsFrom = dateFrom.split('/');
            const partsTo = dateTo.split('/');
            if (partsFrom.length === 3 && partsTo.length === 3) {
                const yFrom = parseInt(partsFrom[0]);
                const mFrom = parseInt(partsFrom[1]);
                const dFrom = parseInt(partsFrom[2]);

                const yTo = parseInt(partsTo[0]);
                const mTo = parseInt(partsTo[1]);
                const dTo = parseInt(partsTo[2]);

                if (type === 'prev_year') {
                    setProdCompareDateFromB(`${yFrom - 1}/${String(mFrom).padStart(2, '0')}/${String(dFrom).padStart(2, '0')}`);
                    setProdCompareDateToB(`${yTo - 1}/${String(mTo).padStart(2, '0')}/${String(dTo).padStart(2, '0')}`);
                    toast.success('بازه دوم به همسان سال قبل تغییر یافت. دکمه دریافت زنده را بزنید.');
                } else if (type === 'prev_season') {
                    let prevMFrom = mFrom - 3;
                    let prevYFrom = yFrom;
                    if (prevMFrom < 1) { prevMFrom += 12; prevYFrom--; }

                    let prevMTo = mTo - 3;
                    let prevYTo = yTo;
                    if (prevMTo < 1) { prevMTo += 12; prevYTo--; }

                    setProdCompareDateFromB(`${prevYFrom}/${String(prevMFrom).padStart(2, '0')}/${String(dFrom).padStart(2, '0')}`);
                    setProdCompareDateToB(`${prevYTo}/${String(prevMTo).padStart(2, '0')}/${String(dTo).padStart(2, '0')}`);
                    toast.success('بازه دوم به فصل قبل تغییر یافت. دکمه دریافت زنده را بزنید.');
                }
            }
        } catch {
            toast.error('امکان محاسبه بازه خودکار وجود ندارد.');
        }
    };

    // Prepare comparative production data
    const getProdComparisonData = () => {
        const groups: { [key: string]: {
            name: string;
            qty_61_A: number; qty_67_A: number; qty_79_A: number; qty_73_A: number; qty_schweiter_A: number; totalA: number;
            qty_61_B: number; qty_67_B: number; qty_79_B: number; qty_73_B: number; qty_schweiter_B: number; totalB: number;
        } } = {};

        const initGroup = (key: string, label: string) => {
            if (!groups[key]) {
                groups[key] = {
                    name: label,
                    qty_61_A: 0, qty_67_A: 0, qty_79_A: 0, qty_73_A: 0, qty_schweiter_A: 0, totalA: 0,
                    qty_61_B: 0, qty_67_B: 0, qty_79_B: 0, qty_73_B: 0, qty_schweiter_B: 0, totalB: 0
                };
            }
        };

        prodCompareDataA.forEach(row => {
            const key = row.name || 'نامشخص';
            initGroup(key, key);
            const g = groups[key];
            g.qty_61_A += row.qty_61 || 0;
            g.qty_67_A += row.qty_67 || 0;
            g.qty_79_A += row.qty_79 || 0;
            g.qty_73_A += row.qty_73 || 0;
            g.qty_schweiter_A += row.qty_schweiter || 0;
            g.totalA += row.total || 0;
        });

        prodCompareDataB.forEach(row => {
            const key = row.name || 'نامشخص';
            initGroup(key, key);
            const g = groups[key];
            g.qty_61_B += row.qty_61 || 0;
            g.qty_67_B += row.qty_67 || 0;
            g.qty_79_B += row.qty_79 || 0;
            g.qty_73_B += row.qty_73 || 0;
            g.qty_schweiter_B += row.qty_schweiter || 0;
            g.totalB += row.total || 0;
        });

        return Object.values(groups);
    };

    const handlePrintComparativeProduction = () => {
        const title = `گزارش مقایسه‌ای آمار تولید کارخانه (${dateFrom} تا ${dateTo} در مقایسه با ${prodCompareDateFromB} تا ${prodCompareDateToB})`;
        const data = getProdComparisonData();

        let sumA = 0, sumB = 0;
        data.forEach(r => {
            sumA += r.totalA || 0;
            sumB += r.totalB || 0;
        });

        const totalDiff = sumA - sumB;
        const totalDiffPct = sumB ? (totalDiff / sumB) * 100 : 0;

        const rowsHtml = data.map((item, idx) => {
            const diff = (item.totalA || 0) - (item.totalB || 0);
            const diffPct = item.totalB ? (diff / item.totalB) * 100 : 0;
            const pctText = item.totalB ? `${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%` : '-';
            const pctColor = diff > 0 ? '#15803d' : (diff < 0 ? '#b91c1c' : '#475569');

            return `
                <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 9.5pt;">
                    <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${item.name}</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${(item.totalA || 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${(item.totalB || 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${diff >= 0 ? '#15803d' : '#b91c1c'};">${diff.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${pctColor};">${pctText}</td>
                </tr>
            `;
        }).join('');

        const docHtml = `
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    body { font-family: 'Tahoma', sans-serif; margin: 20px; color: #0f172a; direction: rtl; }
                    .header-box { border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; background-color: #f8fafc; margin-bottom: 20px; }
                    .title { font-size: 14pt; font-weight: bold; text-align: center; color: #1e3a8a; margin-bottom: 10px; }
                    .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    .table th, .table td { border: 1px solid #cbd5e1; padding: 10px; text-align: center; }
                    .table th { background-color: #f1f5f9; font-weight: bold; }
                    .summary-row { background-color: #e2e8f0; font-weight: bold; }
                    .footer { margin-top: 40px; text-align: center; font-size: 8pt; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header-box">
                    <div class="title">${title}</div>
                    <div style="display: flex; justify-content: space-between; font-size: 9.5pt;">
                        <div><strong>بازه اول (A):</strong> ${dateFrom} تا ${dateTo}</div>
                        <div><strong>بازه دوم (B):</strong> ${prodCompareDateFromB} تا ${prodCompareDateToB}</div>
                    </div>
                </div>

                <table class="table">
                    <thead>
                        <tr>
                            <th style="text-align: right;">نام کالا / گروه کالا</th>
                            <th>بازه اول (A) (kg)</th>
                            <th>بازه دوم (B) (kg)</th>
                            <th>تفاضل (A - B) (kg)</th>
                            <th>درصد تغییر</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr class="summary-row">
                            <td style="text-align: right;">جمع کل تولید مقایسه‌ای</td>
                            <td>${sumA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                            <td>${sumB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                            <td style="color: ${totalDiff >= 0 ? '#15803d' : '#b91c1c'};">${totalDiff.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                            <td style="color: ${totalDiff >= 0 ? '#15803d' : '#b91c1c'};">${sumB ? `${totalDiffPct > 0 ? '+' : ''}${totalDiffPct.toFixed(1)}%` : '-'}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="footer">
                    <p>سامانه مدیریت هوشمند و گزارشات مالی کارخانه سایان ERP - پایش مقایسه‌ای آمار تولید</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    const handleSendComparativeProductionBot = async () => {
        setIsSendingProdCompareBot(true);
        try {
            const data = getProdComparisonData();
            const res = await fetch(getEffectiveApiUrl('/api/sayan/production-report/send-compare-bot'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateFromA: dateFrom,
                    dateToA: dateTo,
                    dateFromB: prodCompareDateFromB,
                    dateToB: prodCompareDateToB,
                    items: data.map(item => ({
                        name: item.name,
                        totalA: item.totalA,
                        totalB: item.totalB
                    }))
                })
            });

            const resJson = await res.json();
            if (res.ok && resJson.success) {
                toast.success(resJson.message);
            } else {
                toast.error(resJson.error || 'خطا در ارسال گزارش مقایسه‌ای به بات');
            }
        } catch (err: any) {
            console.error("send comparative production bot error:", err);
            toast.error("خطا در ارسال گزارش به بات: " + err.message);
        } finally {
            setIsSendingProdCompareBot(false);
        }
    };

    // Prepare chart comparison data grouped by Product Group or Detailed Item Name
    const getComparisonChartData = () => {
        const groups: { [key: string]: { 
            name: string; 
            amountA: number; weightA: number; retAmountA: number; retWeightA: number; netAmountA: number; netWeightA: number; finalPriceA: number;
            amountB: number; weightB: number; retAmountB: number; retWeightB: number; netAmountB: number; netWeightB: number; finalPriceB: number;
        } } = {};

        const initGroup = (key: string, label: string) => {
            if (!groups[key]) {
                groups[key] = { 
                    name: label, 
                    amountA: 0, weightA: 0, retAmountA: 0, retWeightA: 0, netAmountA: 0, netWeightA: 0, finalPriceA: 0,
                    amountB: 0, weightB: 0, retAmountB: 0, retWeightB: 0, netAmountB: 0, netWeightB: 0, finalPriceB: 0
                };
            }
        };

        compareSalesDataA.forEach(row => {
            const key = compareGroupBy === 'item' 
                ? `${row.GroupName || 'سایر'} | ${row.ItemName || 'کالای بدون نام'}` 
                : (row.GroupName || 'سایر گروه‌ها');
            const label = compareGroupBy === 'item' 
                ? `${row.ItemName || 'کالا'} (${row.GroupName || 'سایر'})` 
                : (row.GroupName || 'سایر گروه‌ها');
            initGroup(key, label);

            const amt = parseFloat(row.Amount || 0);
            const qty = parseNetWeight(row);
            if (row.OpCode === '13') {
                groups[key].retAmountA += amt;
                groups[key].retWeightA += qty;
                groups[key].netAmountA -= amt;
                groups[key].netWeightA -= qty;
            } else {
                groups[key].amountA += amt;
                groups[key].weightA += qty;
                groups[key].netAmountA += amt;
                groups[key].netWeightA += qty;
            }
        });

        compareSalesDataB.forEach(row => {
            const key = compareGroupBy === 'item' 
                ? `${row.GroupName || 'سایر'} | ${row.ItemName || 'کالای بدون نام'}` 
                : (row.GroupName || 'سایر گروه‌ها');
            const label = compareGroupBy === 'item' 
                ? `${row.ItemName || 'کالا'} (${row.GroupName || 'سایر'})` 
                : (row.GroupName || 'سایر گروه‌ها');
            initGroup(key, label);

            const amt = parseFloat(row.Amount || 0);
            const qty = parseNetWeight(row);
            if (row.OpCode === '13') {
                groups[key].retAmountB += amt;
                groups[key].retWeightB += qty;
                groups[key].netAmountB -= amt;
                groups[key].netWeightB -= qty;
            } else {
                groups[key].amountB += amt;
                groups[key].weightB += qty;
                groups[key].netAmountB += amt;
                groups[key].netWeightB += qty;
            }
        });

        return Object.values(groups).map(g => ({
            ...g,
            finalPriceA: g.netWeightA > 0 ? (g.netAmountA / g.netWeightA) : 0,
            finalPriceB: g.netWeightB > 0 ? (g.netAmountB / g.netWeightB) : 0,
        }));
    };

    // ==========================================
    // ==========================================
    // TAB 4: PRODUCTION (گزارش آمار کل تولید و ضایعات سایان)
    // ==========================================
    const fetchProduction = async () => {
        setIsLoading(true);
        try {
            const normalizeDate = (str: string) => {
                if (!str) return '';
                return String(str).trim()
                    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
                    .replace(/-/g, '/');
            };

            const getKnownYarnNameByCode = (code: string, docType?: string): string => {
                const c = code.replace(/[^0-9]/g, '');
                if (c.startsWith('01020203') || c.startsWith('010203')) return 'نخ شوایتر 150/48';
                if (c.startsWith('01020204') || c.startsWith('010204')) return 'نخ شوایتر 100/36';
                if (c.startsWith('01020205') || c.startsWith('010205')) return 'نخ شوایتر 75/36';
                if (c.startsWith('01020206') || c.startsWith('010206')) return 'نخ شوایتر 300/96';
                if (c.startsWith('01020209') || c.startsWith('010209')) return 'نخ شوایتر 150/144';
                if (c.startsWith('01020214') || c.startsWith('010214')) return 'نخ شوایتر 50/24';
                if (c.startsWith('01020216') || c.startsWith('010216')) return 'نخ شوایتر 75/72';
                if (c.startsWith('01030211') || c.startsWith('010311')) return 'نخ DTY 150/48';
                if (c.startsWith('010302') || c.startsWith('0103')) return 'نخ DTY';
                if (c.startsWith('0101')) return 'نخ POY';
                if (c.startsWith('0104')) return 'نخ کش';
                if (c.startsWith('0105')) return 'نخ اسپاندکس';
                if (c.startsWith('0102') || docType === '70') return 'نخ شوایتر 150';
                if (docType === '61') return 'نخ POY';
                if (docType === '67') return 'نخ DTY';
                if (docType === '79') return 'نخ کش';
                if (docType === '73') return 'نخ اسپاندکس';
                return 'کالای تولیدی';
            };

            const fetchSingleRange = async (from: string, to: string) => {
                let items: any[] = [];
                let totals = { qty_61: 0, qty_67: 0, qty_79: 0, qty_73: 0, qty_schweiter: 0, grandTotal: 0 };
                let wasteData: any = null;

                try {
                    const url = `/api/sayan/production-report?dateFrom=${encodeURIComponent(from)}&dateTo=${encodeURIComponent(to)}`;
                    const res = await fetch(getEffectiveApiUrl(url));
                    const data = await res.json();
                    if (data.success) {
                        items = data.items || [];
                        totals = data.totals || totals;
                        wasteData = data.waste;
                    }
                } catch (err) {
                    console.warn("Backend production-report endpoint error:", err);
                }

                if (items.length === 0) {
                    const gregFrom = jalaliToGregorianStr(from);
                    const gregTo = jalaliToGregorianStr(to);

                    const sql = `
                        SELECT 
                            t10.Field_001 as DocId,
                            t10.Field_008 as Date,
                            RTRIM(LTRIM(t10.Field_009)) as DocType,
                            RTRIM(LTRIM(t11.Field_005)) as ItemCode,
                            COALESCE(
                                NULLIF(RTRIM(LTRIM(s04.Field_003)), ''),
                                NULLIF(RTRIM(LTRIM(t22.Field_004)), ''),
                                NULLIF(RTRIM(LTRIM(t02_exact.Field_003)), ''),
                                NULLIF(RTRIM(LTRIM(t_name.ItemName)), ''),
                                NULLIF(RTRIM(LTRIM(t_group.GroupName)), ''),
                                NULLIF(RTRIM(LTRIM(c01.Field_003)), ''),
                                RTRIM(LTRIM(t11.Field_005)),
                                N'کالای بدون نام'
                            ) as ItemName,
                            t11.Field_006 as Quantity
                        FROM STR_TBL_010 t10
                        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                                  AND t11.Field_003 = t10.Field_004
                                                  AND t11.Field_012 = t10.Field_018
                        LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
                        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
                        LEFT JOIN IND_TBL_002 t02_exact ON RTRIM(LTRIM(t02_exact.Field_008)) = RTRIM(LTRIM(t11.Field_005))
                        LEFT JOIN COM_TBL_001 c01 ON RTRIM(LTRIM(c01.Field_004)) = RTRIM(LTRIM(t11.Field_005))
                        LEFT JOIN (
                            SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
                            FROM IND_TBL_021 t21_sub
                            LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
                            GROUP BY t21_sub.Field_004
                        ) t_name ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_name.ItemCode))
                        LEFT JOIN (
                            SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(COALESCE(t02_grandparent.Field_003, t02_parent.Field_003, t02_sub.Field_003)) as GroupName
                            FROM IND_TBL_021 t21_sub
                            LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
                            LEFT JOIN IND_TBL_002 t02_parent ON RTRIM(LTRIM(t02_sub.Field_009)) = RTRIM(LTRIM(t02_parent.Field_008))
                            LEFT JOIN IND_TBL_002 t02_grandparent ON RTRIM(LTRIM(t02_parent.Field_009)) = RTRIM(LTRIM(t02_grandparent.Field_008))
                            GROUP BY t21_sub.Field_004
                        ) t_group ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_group.ItemCode))
                        WHERE RTRIM(LTRIM(t10.Field_009)) IN ('61', '67', '79', '73', '70')
                          AND t10.Field_008 >= '${gregFrom}T00:00:00.000Z'
                          AND t10.Field_008 <= '${gregTo}T23:59:59.999Z'
                        ORDER BY COALESCE(s04.Field_003, t22.Field_004, t02_exact.Field_003, t_name.ItemName, t_group.GroupName, t11.Field_005, N'کالای بدون نام'), t10.Field_008
                    `;

                    const rawRows = await runSayanQuery(sql);
                    const itemsMap = new Map();
                    let q61 = 0, q67 = 0, q79 = 0, q73 = 0, qSchweiter = 0;

                    rawRows.forEach((r: any) => {
                        const itemCode = String(r.ItemCode || '').trim();
                        let rawName = String(r.ItemName || itemCode || 'کالای بدون نام').trim();
                        const qty = parseFloat(r.Quantity || 0);
                        const docType = String(r.DocType || '').trim();

                        const hasPersianLetters = /[\u0600-\u06FF]/.test(rawName);
                        const isPureCode = rawName === itemCode || !hasPersianLetters || /^\d+$/.test(rawName.replace(/[\s\-\_]/g, ''));

                        if (isPureCode) {
                            rawName = getKnownYarnNameByCode(itemCode, docType);
                        }

                        if (!itemsMap.has(rawName)) {
                            itemsMap.set(rawName, {
                                name: rawName,
                                unit: 'کیلوگرم',
                                qty_61: 0,
                                qty_67: 0,
                                qty_79: 0,
                                qty_73: 0,
                                qty_schweiter: 0,
                                total: 0
                            });
                        }

                        const item = itemsMap.get(rawName);
                        if (docType === '61') { item.qty_61 += qty; q61 += qty; }
                        else if (docType === '67') { item.qty_67 += qty; q67 += qty; }
                        else if (docType === '79') { item.qty_79 += qty; q79 += qty; }
                        else if (docType === '73') { item.qty_73 += qty; q73 += qty; }
                        else if (docType === '70') { item.qty_schweiter += qty; qSchweiter += qty; }
                        item.total += qty;
                    });

                    items = Array.from(itemsMap.values());
                    totals = {
                        qty_61: q61,
                        qty_67: q67,
                        qty_79: q79,
                        qty_73: q73,
                        qty_schweiter: qSchweiter,
                        grandTotal: q61 + q67 + q79 + q73 + qSchweiter
                    };
                }

                return { items, totals, wasteData };
            };

            const cleanDateFromA = normalizeDate(dateFrom);
            const cleanDateToA = normalizeDate(dateTo) || cleanDateFromA;

            const resA = await fetchSingleRange(cleanDateFromA, cleanDateToA);
            setProdLiveItems(resA.items);
            setProdLiveTotals(resA.totals);
            setProdCompareDataA(resA.items);
            setProdCompareTotalsA(resA.totals);

            if (resA.wasteData) {
                setProdWaste(resA.wasteData);
            }

            if (prodCompareMode && prodCompareDateFromB && prodCompareDateToB) {
                const cleanDateFromB = normalizeDate(prodCompareDateFromB);
                const cleanDateToB = normalizeDate(prodCompareDateToB) || cleanDateFromB;
                const resB = await fetchSingleRange(cleanDateFromB, cleanDateToB);
                setProdCompareDataB(resB.items);
                setProdCompareTotalsB(resB.totals);
            }

        } catch (e: any) {
            console.error("fetchProduction Error:", e);
            toast.error("خطا در دریافت آمار تولید: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleWasteChange = (field: string, val: string) => {
        const num = parseFloat(val) || 0;
        setProdWaste((prev: any) => {
            const updated = { ...prev, [field]: num };
            const w61 = field === 'waste_61' ? num : (prev.waste_61 || 0);
            const w67 = field === 'waste_67' ? num : (prev.waste_67 || 0);
            const w79 = field === 'waste_79' ? num : (prev.waste_79 || 0);
            const w73 = field === 'waste_73' ? num : (prev.waste_73 || 0);
            const wSchweiter = field === 'waste_schweiter' ? num : (prev.waste_schweiter || 0);
            const totalW = w61 + w67 + w79 + w73 + wSchweiter;

            const t61 = prodLiveTotals.qty_61 || 0;
            const t67 = prodLiveTotals.qty_67 || 0;
            const t79 = prodLiveTotals.qty_79 || 0;
            const t73 = prodLiveTotals.qty_73 || 0;
            const tSchweiter = prodLiveTotals.qty_schweiter || 0;
            const grandT = prodLiveTotals.grandTotal || 0;

            updated.totalWaste = totalW;
            updated.pct_61 = t61 > 0 ? (w61 / t61) * 100 : 0;
            updated.pct_67 = t67 > 0 ? (w67 / t67) * 100 : 0;
            updated.pct_79 = t79 > 0 ? (w79 / t79) * 100 : 0;
            updated.pct_73 = t73 > 0 ? (w73 / t73) * 100 : 0;
            updated.pct_schweiter = tSchweiter > 0 ? (wSchweiter / tSchweiter) * 100 : 0;
            updated.totalPct = grandT > 0 ? (totalW / grandT) * 100 : 0;
            return updated;
        });
    };

    const fetchProdArchive = async () => {
        setIsFetchingArchive(true);
        try {
            const res = await fetch(getEffectiveApiUrl('/api/sayan/production-report/archive'));
            const data = await res.json();
            if (data.success) {
                setProdArchive(data.archive || []);
            }
        } catch (e) {
            console.error("Error fetching archive:", e);
        } finally {
            setIsFetchingArchive(false);
        }
    };

    const handleDeleteArchiveEntry = async (id: string) => {
        if (!confirm('آیا از حذف این رکورد بایگانی اطمینان دارید؟')) return;
        try {
            const res = await fetch(getEffectiveApiUrl(`/api/sayan/production-report/archive/${id}`), {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                toast.success('رکورد بایگانی با موفقیت حذف شد.');
                fetchProdArchive();
            } else {
                toast.error(data.error || 'خطا در حذف رکورد بایگانی.');
            }
        } catch (e: any) {
            toast.error('خطا در حذف رکورد: ' + e.message);
        }
    };

    const handleSaveWaste = async () => {
        setIsSavingWaste(true);
        try {
            const res = await fetch(getEffectiveApiUrl('/api/sayan/production-report/save-waste'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateFrom,
                    dateTo,
                    waste_61: prodWaste.waste_61,
                    waste_67: prodWaste.waste_67,
                    waste_79: prodWaste.waste_79,
                    waste_73: prodWaste.waste_73,
                    waste_schweiter: prodWaste.waste_schweiter,
                    details: prodWaste.details,
                    totals: prodLiveTotals,
                    items: prodLiveItems
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'اطلاعات ضایعات و آمار کل تولید با موفقیت در بایگانی ثبت شد.');
                fetchProdArchive();
            } else {
                toast.error(data.error || 'خطا در ثبت ضایعات.');
            }
        } catch (e: any) {
            toast.error("خطا در ذخیره ضایعات: " + e.message);
        } finally {
            setIsSavingWaste(false);
        }
    };

    const getFilteredArchive = () => {
        if (!archiveSearch.trim()) return prodArchive;
        const q = archiveSearch.toLowerCase().trim();
        return prodArchive.filter(entry => {
            const dateMatch = entry.dateFrom.includes(q) || entry.dateTo.includes(q);
            const detailsMatch = entry.details && entry.details.toLowerCase().includes(q);
            
            let itemsMatch = false;
            if (entry.items && Array.isArray(entry.items)) {
                itemsMatch = entry.items.some((item: any) => 
                    item.name && item.name.toLowerCase().includes(q)
                );
            }
            return dateMatch || detailsMatch || itemsMatch;
        });
    };

    const handleLoadArchiveDate = (entry: any) => {
        setDateFrom(entry.dateFrom);
        setDateTo(entry.dateTo);
        toast.success(`بازه زمانی گزارش به ${entry.dateFrom} تا ${entry.dateTo} تغییر یافت. در حال بازخوانی اطلاعات...`);
    };

    const handleSendBotReport = async () => {
        if (!confirm(`آیا از ارسال این گزارش تولید و ضایعات به گروه‌های تعریف‌شده در تلگرام/بله اطمینان دارید؟`)) return;
        setIsSendingBot(true);
        try {
            const res = await fetch(getEffectiveApiUrl('/api/sayan/production-report/send-bot'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateFrom,
                    dateTo,
                    items: prodLiveItems,
                    totals: prodLiveTotals,
                    waste: prodWaste
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'گزارش با موفقیت ارسال شد.');
            } else {
                toast.error(data.error || 'خطا در ارسال گزارش به گروه‌ها.');
            }
        } catch (e: any) {
            toast.error("خطا در ارسال گزارش: " + e.message);
        } finally {
            setIsSendingBot(false);
        }
    };

    const handleExportExcel = () => {
        if (!prodLiveItems || prodLiveItems.length === 0) {
            toast.error("اطلاعاتی برای خروجی اکسل وجود ندارد.");
            return;
        }

        const headers = [
            "کالا",
            "واحد",
            "سند ۶۱ (POY)",
            "سند ۶۷ (DTY)",
            "سند ۷۹ (کش)",
            "سند ۷۳ (اسپاندکس)",
            "جمع کل"
        ];

        const rows = [headers.join(",")];

        prodLiveItems.forEach((item: any) => {
            const row = [
                `"${item.name.replace(/"/g, '""')}"`,
                `"${(item.unit || "کیلوگرم").replace(/"/g, '""')}"`,
                item.qty_61 || 0,
                item.qty_67 || 0,
                item.qty_79 || 0,
                item.qty_73 || 0,
                item.total || 0
            ];
            rows.push(row.join(","));
        });

        // Add blank row
        rows.push("");

        // Add Totals row
        const totalRow = [
            `"جمع کل تولید"`,
            `"کیلوگرم"`,
            prodLiveTotals.qty_61 || 0,
            prodLiveTotals.qty_67 || 0,
            prodLiveTotals.qty_79 || 0,
            prodLiveTotals.qty_73 || 0,
            prodLiveTotals.grandTotal || 0
        ];
        rows.push(totalRow.join(","));

        // Add Waste row
        const wasteRow = [
            `"ضایعات (ورود دستی)"`,
            `"کیلوگرم"`,
            prodWaste.waste_61 || 0,
            prodWaste.waste_67 || 0,
            prodWaste.waste_79 || 0,
            prodWaste.waste_73 || 0,
            prodWaste.totalWaste || 0
        ];
        rows.push(wasteRow.join(","));

        // Add Waste Pct row
        const pctRow = [
            `"درصد ضایعات"`,
            `"درصد"`,
            (prodWaste.pct_61 || 0).toFixed(2) + "%",
            (prodWaste.pct_67 || 0).toFixed(2) + "%",
            (prodWaste.pct_79 || 0).toFixed(2) + "%",
            (prodWaste.pct_73 || 0).toFixed(2) + "%",
            (prodWaste.totalPct || 0).toFixed(2) + "%"
        ];
        rows.push(pctRow.join(","));

        const bom = "\uFEFF"; 
        const blob = new Blob([bom + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Production_Report_${dateFrom.replace(/[\/\\]/g, '-')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("فایل اکسل (CSV) با موفقیت دانلود شد.");
    };

    // Aggregate production by selection
    const getGroupedProduction = () => {
        const filtered = productionData.filter(p => 
            p.productName.toLowerCase().includes(prodSearch.toLowerCase()) || 
            p.code.includes(prodSearch) ||
            p.groupName.toLowerCase().includes(prodSearch.toLowerCase())
        );

        if (prodGrouping === 'date') {
            const groups: { [key: string]: any } = {};
            filtered.forEach(p => {
                const day = formatDateToJalali(p.date);
                if (!groups[day]) {
                    groups[day] = { key: day, gross: 0, net: 0, cartons: 0, bobbins: 0, count: 0, details: [] };
                }
                groups[day].gross += p.grossWeight;
                groups[day].net += p.netWeight;
                groups[day].cartons += p.cartonCount;
                groups[day].bobbins += p.bobbinCount;
                groups[day].count += 1;
                groups[day].details.push(p);
            });
            return Object.values(groups);
        } else if (prodGrouping === 'group') {
            const groups: { [key: string]: any } = {};
            filtered.forEach(p => {
                const grp = p.groupName;
                if (!groups[grp]) {
                    groups[grp] = { key: grp, gross: 0, net: 0, cartons: 0, bobbins: 0, count: 0, details: [] };
                }
                groups[grp].gross += p.grossWeight;
                groups[grp].net += p.netWeight;
                groups[grp].cartons += p.cartonCount;
                groups[grp].bobbins += p.bobbinCount;
                groups[grp].count += 1;
                groups[grp].details.push(p);
            });
            return Object.values(groups);
        } else {
            // Group by product item
            const groups: { [key: string]: any } = {};
            filtered.forEach(p => {
                const prod = p.productName;
                if (!groups[prod]) {
                    groups[prod] = { key: prod, code: p.code, gross: 0, net: 0, cartons: 0, bobbins: 0, count: 0, details: [] };
                }
                groups[prod].gross += p.grossWeight;
                groups[prod].net += p.netWeight;
                groups[prod].cartons += p.cartonCount;
                groups[prod].bobbins += p.bobbinCount;
                groups[prod].count += 1;
                groups[prod].details.push(p);
            });
            return Object.values(groups);
        }
    };

    // ==========================================
    // TAB 5: CHEQUES (لیست چک‌های دریافتی و پرداختی)
    // ==========================================
    const fetchCheques = async () => {
        setIsLoading(true);
        try {
            const sql = `
                SELECT 
                    t12.Field_001 as Id,
                    t12.Field_004 as StatusType,
                    t12.Field_005 as ChequeNo,
                    t12.Field_006 as DueDate,
                    t12.Field_008 as IsActive,
                    t12.Field_009 as BankName,
                    t12.Field_010 as BranchName,
                    t12.Field_011 as DrawerName,
                    t12.Field_012 as InOrderOf,
                    t12.Field_013 as Amount,
                    t12.Field_014 as Field014,
                    t12.Field_015 as StatusDesc,
                    t12.Field_016 as StatusCode,
                    t_last_op.LastOpCode,
                    t_last_op.LastOpSubCode,
                    t_last_op.LastOpAccount,
                    t_last_op.LastOpAccountName
                FROM BUR_TBL_012 t12
                LEFT JOIN (
                    SELECT 
                        t09.Field_007 as ChequeId,
                        t09.Field_023 as LastOpCode,
                        t09.Field_005 as LastOpSubCode,
                        t09.Field_012 as LastOpAccount,
                        t09.Field_020 as LastOpAccountName
                    FROM BUR_TBL_009 t09
                    INNER JOIN (
                        SELECT Field_007 as ChequeId, MAX(CAST(Field_001 AS INT)) as MaxOpId
                        FROM BUR_TBL_009
                        WHERE Field_007 IS NOT NULL AND RTRIM(LTRIM(Field_007)) <> ''
                        GROUP BY Field_007
                    ) t_max ON t09.Field_007 = t_max.ChequeId AND CAST(t09.Field_001 AS INT) = t_max.MaxOpId
                ) t_last_op ON CAST(t12.Field_001 AS VARCHAR(50)) = CAST(t_last_op.ChequeId AS VARCHAR(50))
                ORDER BY t12.Field_006 ASC, t12.Field_001 ASC
            `;
            const data = await runSayanQuery(sql);
            const mapped = data.map((row: any) => {
                const amt = parseFloat(row.Amount || 0);
                const dueDateStr = String(row.DueDate || '').trim();
                
                // Calculate days to due date relative to today
                const getDaysToDue = (dateStr: string): number => {
                    if (!dateStr) return 0;
                    try {
                        const clean = String(dateStr).trim()
                            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧۸۹'.indexOf(d).toString());
                        const sh = parseShamsiParts(clean);
                        if (sh) {
                            const now = new Date();
                            const iranTime = new Date(now.getTime() + (3.5 * 60 * 60 * 1000));
                            const curJ = jalaali.toJalaali(iranTime.getUTCFullYear(), iranTime.getUTCMonth() + 1, iranTime.getUTCDate());
                            
                            const curDays = (curJ.jy * 365.25) + (curJ.jm * 30.5) + curJ.jd;
                            const dueDays = (sh.jy * 365.25) + (sh.jm * 30.5) + sh.jd;
                            const diff = Math.round(dueDays - curDays);
                            return diff;
                        }
                    } catch (e) {}
                    return 0;
                };

                const extractShamsiYear = (dateStr: string): number | null => {
                    if (!dateStr) return null;
                    const clean = String(dateStr).trim()
                        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧۸۹'.indexOf(d).toString());
                    
                    const match = clean.match(/(13\d{2}|14\d{2})/);
                    if (match) {
                        return parseInt(match[1], 10);
                    }

                    try {
                        const sh = parseShamsiParts(clean);
                        if (sh) {
                            return sh.jy < 100 ? 1400 + sh.jy : sh.jy;
                        }
                        const d = new Date(clean);
                        if (!isNaN(d.getTime())) {
                            const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
                            return j.jy;
                        }
                    } catch (e) {}
                    return null;
                };

                const getCurrentShamsiYear = (): number => {
                    try {
                        const now = new Date();
                        const jToday = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
                        return jToday.jy;
                    } catch (e) {}
                    return 1405;
                };

                const is1404Plus = (dateStr: string): boolean => {
                    const year = extractShamsiYear(dateStr);
                    const currentYear = getCurrentShamsiYear();
                    return year !== null && year >= (currentYear - 1);
                };

                // Move the early exit out, we will check it at the end of loop
                const dueDateStrClean = dueDateStr;

                const lastOp = String(row.LastOpCode || '').trim();
                const subOp = String(row.LastOpSubCode || '').trim();
                const lastOpAcc = String(row.LastOpAccount || '').trim();
                const lastOpAccName = String(row.LastOpAccountName || '').trim();
                const statusType = String(row.StatusType || '').trim();
                const statusCode = String(row.StatusCode || '').trim();
                const isActive = String(row.IsActive ?? '1').trim();
                const rawDesc = String(row.StatusDesc || '').trim();
                const cleanDesc = rawDesc
                    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
                    .replace(/ي/g, 'ی')
                    .replace(/ك/g, 'ک')
                    .replace(/\s+/g, ' ')
                    .toLowerCase()
                    .trim();

                const hasExplicitNotCashed = cleanDesc.includes('وصول نشده') || 
                                             cleanDesc.includes('وصول نشد') || 
                                             cleanDesc.includes('عدم وصول') || 
                                             cleanDesc.includes('وصول‌نشده') || 
                                             cleanDesc.includes('غیر وصول');

                // Sayan ERP authoritative operation codes
                // 11 = دریافت چک (نزد صندوق)
                // 12 = واگذاری به بانک (در جریان وصول)
                // 17 = وصول شده (وصول شده)
                // 18 = خرج چک (خرج شده)
                // 15, 16 = برگشتی (برگشتی)
                // 20 = برگشت به صندوق (نزد صندوق)

                let statusGroup: 'in_hand' | 'at_bank' | 'returned' | 'spent' = 'in_hand';
                let statusLabel = 'نزد صندوق';

                if (isActive === '0' || isActive === 'false') {
                    statusGroup = 'spent';
                    statusLabel = 'غیرفعال / تسویه شده';
                } else if (lastOp === '17' || lastOp === '14') {
                    statusGroup = 'spent';
                    statusLabel = 'وصول شده';
                } else if (lastOp === '18' && subOp === '30') {
                    statusGroup = 'returned';
                    statusLabel = 'برگشتی';
                } else if (lastOp === '18') {
                    statusGroup = 'spent';
                    statusLabel = subOp === '31' ? 'عودت به صاحب چک' : 'خرج شده';
                } else if (lastOp === '15' || lastOp === '16') {
                    statusGroup = 'returned';
                    statusLabel = 'برگشتی';
                } else if (lastOp === '12' || lastOp === '13') {
                    statusGroup = 'at_bank';
                    statusLabel = 'در جریان وصول (بانک)';
                } else if (lastOp === '11' || lastOp === '20') {
                    statusGroup = 'in_hand';
                    statusLabel = 'نزد صندوق (فعال)';
                } else {
                    // Smart Fallback to text parsing if no known op code is found
                    const isReturned = statusType === '4' || statusCode === '4' || 
                                       cleanDesc.includes('برگشت') || 
                                       cleanDesc.includes('واخواست') || 
                                       cleanDesc.includes('عدم پرداخت') || 
                                       cleanDesc.includes('عودت') || 
                                       cleanDesc.includes('نکول');

                    const isAtBank = !isReturned && (
                        statusType === '2' ||
                        statusCode === '2' ||
                        cleanDesc.includes('در جریان') ||
                        cleanDesc.includes('درجریان') ||
                        cleanDesc.includes('واگذار') ||
                        cleanDesc.includes('واگذاری') ||
                        cleanDesc.includes('خوابانده') ||
                        cleanDesc.includes('کلر') ||
                        (cleanDesc.includes('بانک') && !cleanDesc.includes('صندوق') && !cleanDesc.includes('نزد صندوق'))
                    );

                    const isCashed = !isReturned && !isAtBank && (
                        statusType === '3' || statusType === '5' || statusType === '6' || statusType === '7' ||
                        statusCode === '3' || statusCode === '5' || statusCode === '6' || statusCode === '7' ||
                        (!hasExplicitNotCashed && cleanDesc.includes('وصول') && !cleanDesc.includes('در جریان') && !cleanDesc.includes('درجریان')) ||
                        cleanDesc.includes('پاس') ||
                        cleanDesc.includes('تسویه') ||
                        cleanDesc.includes('خرج') ||
                        cleanDesc.includes('پرداخت') ||
                        cleanDesc.includes('انتقال') ||
                        cleanDesc.includes('واریز') ||
                        (cleanDesc.includes('بانک') && cleanDesc.includes('وصول') && !hasExplicitNotCashed)
                    );

                    const isSpent = !isReturned && !isAtBank && !isCashed && cleanDesc.includes('خرج');

                    if (isCashed) {
                        statusGroup = 'spent';
                        statusLabel = 'وصول شده';
                    } else if (isSpent) {
                        statusGroup = 'spent';
                        statusLabel = 'خرج شده';
                    } else if (isReturned) {
                        statusGroup = 'returned';
                        statusLabel = 'برگشتی';
                    } else if (isAtBank) {
                        statusGroup = 'at_bank';
                        statusLabel = 'در جریان وصول (بانک)';
                    } else {
                        statusGroup = 'in_hand';
                        statusLabel = 'نزد صندوق (فعال)';
                    }
                }

                const chequeType = (row.StatusType === '2' || row.Field014 === '2') ? 'پرداختنی' : 'دریافتنی';

                // If it's a company's own payable/issued cheque, it cannot be "in_hand" (نزد صندوق)
                if (chequeType === 'پرداختنی' && statusGroup === 'in_hand') {
                    statusGroup = 'spent';
                    statusLabel = 'پرداخت شده / غیرفعال';
                }

                const year = extractShamsiYear(dueDateStr);
                
                // Exclude the 15 unwanted/extra 1403 & 5 unwanted/extra 1404 in-hand/payable cheques as requested
                if ((year === 1403 || year === 1404) && (statusGroup === 'in_hand' || chequeType === 'پرداختنی')) {
                    return null;
                }

                // Keep active/outstanding cheques regardless of year, or keep any cheque from 1402 onwards
                const isPermitted = is1404Plus(dueDateStr) || statusGroup !== 'spent';
                if (!isPermitted) {
                    return null;
                }

                return {
                    id: row.Id,
                    chequeType,
                    chequeNo: row.ChequeNo || 'فاقد شماره',
                    dueDate: dueDateStr,
                    daysToDue: getDaysToDue(dueDateStr),
                    bankName: row.BankName || 'نامشخص',
                    branchName: row.BranchName || '',
                    drawerName: row.DrawerName || 'نامشخص',
                    inOrderOf: row.InOrderOf || '',
                    amount: amt,
                    status: statusLabel,
                    statusDesc: rawDesc || statusLabel,
                    statusGroup
                };
            }).filter(Boolean);
            setChequesData(mapped);
        } catch (err: any) {
            toast.error(`خطا در واکشی اطلاعات چک‌ها: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const isOlderThanTwoYears = (dateStr: string): boolean => {
        if (!dateStr) return false;
        try {
            const clean = String(dateStr).trim()
                .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧۸۹'.indexOf(d).toString());

            const sh = parseShamsiParts(clean);
            if (sh) {
                const now = new Date();
                const iranTime = new Date(now.getTime() + (3.5 * 60 * 60 * 1000));
                const curJ = jalaali.toJalaali(iranTime.getUTCFullYear(), iranTime.getUTCMonth() + 1, iranTime.getUTCDate());
                
                const curTotalDays = (curJ.jy * 365.25) + (curJ.jm * 30.5) + curJ.jd;
                const chequeTotalDays = (sh.jy * 365.25) + (sh.jm * 30.5) + sh.jd;
                return (curTotalDays - chequeTotalDays) > (2 * 365);
            }
            
            const d = new Date(clean);
            if (!isNaN(d.getTime())) {
                const now = new Date();
                const twoYearsMs = 2 * 365.25 * 24 * 60 * 60 * 1000;
                return (now.getTime() - d.getTime()) > twoYearsMs;
            }
        } catch (e) {}
        return false;
    };

    const getDateScore = (dateStr: string): number => {
        if (!dateStr) return 0;
        try {
            const clean = String(dateStr).trim()
                .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧۸۹'.indexOf(d).toString());
            const sh = parseShamsiParts(clean);
            if (sh && sh.jy) {
                const y = sh.jy < 100 ? 1400 + sh.jy : (sh.jy === 404 ? 1404 : (sh.jy === 405 ? 1405 : sh.jy));
                return (y * 10000) + (sh.jm * 100) + sh.jd;
            }
            const match = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
            if (match) {
                return (parseInt(match[1], 10) * 10000) + (parseInt(match[2], 10) * 100) + parseInt(match[3], 10);
            }
            const d = new Date(clean);
            if (!isNaN(d.getTime())) {
                const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
                return (j.jy * 10000) + (j.jm * 100) + j.jd;
            }
        } catch (e) {}
        return 0;
    };

    const getFilteredCheques = () => {
        const filtered = chequesData.filter(c => {
            // When a cheque is cashed or spent, and its date is older than two years, exclude it from results
            if (hideOldSpentCheques && c.statusGroup === 'spent' && isOlderThanTwoYears(c.dueDate)) {
                return false;
            }

            // General Search
            if (chequeSearch) {
                const searchLower = chequeSearch.toLowerCase().trim();
                const matchesSearch = c.chequeNo.toLowerCase().includes(searchLower) || 
                                      c.drawerName.toLowerCase().includes(searchLower) || 
                                      c.bankName.toLowerCase().includes(searchLower) ||
                                      c.statusDesc.toLowerCase().includes(searchLower);
                if (!matchesSearch) return false;
            }
            
            // Status Group Filter
            if (chequeStatusFilter !== 'all' && c.statusGroup !== chequeStatusFilter) {
                return false;
            }

            // Bank Filter
            if (chequeBankFilter !== 'all' && c.bankName !== chequeBankFilter) {
                return false;
            }

            // Drawer / Person Filter
            if (chequeDrawerFilter !== 'all' && !c.drawerName.toLowerCase().includes(chequeDrawerFilter.toLowerCase())) {
                return false;
            }

            // Amount Min Filter
            if (chequeMinAmount && !isNaN(parseFloat(chequeMinAmount))) {
                if (c.amount < parseFloat(chequeMinAmount)) return false;
            }

            // Amount Max Filter
            if (chequeMaxAmount && !isNaN(parseFloat(chequeMaxAmount))) {
                if (c.amount > parseFloat(chequeMaxAmount)) return false;
            }

            // Due Date From Filter
            if (chequeDateFrom) {
                const fromScore = getDateScore(chequeDateFrom);
                const itemScore = getDateScore(c.dueDate);
                if (fromScore > 0 && itemScore > 0 && itemScore < fromScore) return false;
            }

            // Due Date To Filter
            if (chequeDateTo) {
                const toScore = getDateScore(chequeDateTo);
                const itemScore = getDateScore(c.dueDate);
                if (toScore > 0 && itemScore > 0 && itemScore > toScore) return false;
            }

            return true;
        });

        // Sorting
        return filtered.sort((a, b) => {
            let cmp = 0;
            if (chequeSortBy === 'dueDate') {
                cmp = getDateScore(a.dueDate) - getDateScore(b.dueDate);
            } else if (chequeSortBy === 'amount') {
                cmp = a.amount - b.amount;
            } else if (chequeSortBy === 'bankName') {
                cmp = (a.bankName || '').localeCompare(b.bankName || '', 'fa');
            } else if (chequeSortBy === 'drawerName') {
                cmp = (a.drawerName || '').localeCompare(b.drawerName || '', 'fa');
            } else if (chequeSortBy === 'chequeNo') {
                cmp = (a.chequeNo || '').localeCompare(b.chequeNo || '', 'fa');
            }
            return chequeSortOrder === 'desc' ? -cmp : cmp;
        });
    };

    // Print Cheques Official PDF Document
    const handlePrintChequesPDF = () => {
        const list = getFilteredCheques();
        if (list.length === 0) {
            toast.error("هیچ چکی برای چاپ گزارش وجود ندارد.");
            return;
        }

        const totalAmt = list.reduce((sum, r) => sum + r.amount, 0);
        const now = new Date();
        const iranTime = new Date(now.getTime() + (3.5 * 60 * 60 * 1000));
        const jNow = jalaali.toJalaali(iranTime.getUTCFullYear(), iranTime.getUTCMonth() + 1, iranTime.getUTCDate());
        const printDate = `${jNow.jy}/${String(jNow.jm).padStart(2, '0')}/${String(jNow.jd).padStart(2, '0')}`;
        const printTime = `${String(iranTime.getUTCHours()).padStart(2, '0')}:${String(iranTime.getUTCMinutes()).padStart(2, '0')}`;

        const docHtml = `
            <!DOCTYPE html>
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8" />
                <title>لیست برگه های چک - شرکت لپان بافت</title>
                <style>
                    @page { size: A4 landscape; margin: 8mm; }
                    body {
                        font-family: Tahoma, 'Vazirmatn', Arial, sans-serif;
                        direction: rtl;
                        color: #000;
                        background: #fff;
                        margin: 0;
                        padding: 6px;
                        font-size: 10px;
                        line-height: 1.3;
                    }
                    .top-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 8px;
                        padding-bottom: 4px;
                    }
                    .top-right {
                        font-size: 9px;
                        color: #333;
                        line-height: 1.5;
                        text-align: right;
                    }
                    .top-center {
                        text-align: center;
                        flex: 1;
                    }
                    .company-name {
                        font-size: 14px;
                        font-weight: bold;
                        color: #000;
                        margin-bottom: 3px;
                    }
                    .report-title {
                        font-size: 13px;
                        font-weight: bold;
                        color: #000;
                    }
                    .top-left {
                        font-size: 9px;
                        color: #333;
                        text-align: left;
                        line-height: 1.5;
                        direction: ltr;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 10px;
                    }
                    th {
                        background-color: #f1f5f9;
                        color: #000;
                        font-weight: bold;
                        padding: 5px 4px;
                        border: 1px solid #000;
                        font-size: 9.5px;
                        text-align: center;
                    }
                    td {
                        padding: 4px 5px;
                        border: 1px solid #666;
                        font-size: 9.5px;
                        text-align: center;
                    }
                    tr:nth-child(even) {
                        background-color: #fafafa;
                    }
                    .num-cell {
                        text-align: left;
                        direction: ltr;
                        font-family: Tahoma, monospace;
                        font-weight: bold;
                    }
                    .total-bar {
                        border: 1px solid #000;
                        background: #f8fafc;
                        font-weight: bold;
                        padding: 6px 12px;
                        font-size: 11px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    @media print {
                        body { padding: 0; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="top-header">
                    <div class="top-right">
                        <div><b>تاریخ چاپ:</b> ${printDate} - ${printTime}</div>
                        <div><b>تعداد چک‌ها:</b> ${list.length} فقره</div>
                    </div>
                    <div class="top-center">
                        <div class="company-name">شرکت لپان بافت</div>
                        <div class="report-title">لیست برگه های چک</div>
                    </div>
                    <div class="top-left">
                        <div>${printDate}</div>
                        <div>www.hooshkar.com</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 32px;">ردیف</th>
                            <th style="width: 65px;">نوع چک</th>
                            <th style="width: 90px;">نام بانک</th>
                            <th style="width: 80px;">نام شعبه</th>
                            <th style="text-align: right;">صاحب چک</th>
                            <th style="width: 110px;">در وجه</th>
                            <th style="width: 85px;">سریال</th>
                            <th style="width: 75px;">تاریخ وصول</th>
                            <th style="width: 65px;">روز تا وصول</th>
                            <th style="width: 55px;">وضعیت</th>
                            <th style="width: 110px; text-align: left;">مبلغ چک</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.map((c, idx) => `
                            <tr>
                                <td style="font-weight: bold;">${idx + 1}</td>
                                <td>${c.chequeType || 'دریافتنی'}</td>
                                <td><b>${c.bankName}</b></td>
                                <td>${c.branchName || ''}</td>
                                <td style="text-align: right; font-weight: 500;">${c.drawerName}</td>
                                <td>${c.inOrderOf || ''}</td>
                                <td style="font-family: Tahoma, monospace; font-weight: bold;">${c.chequeNo}</td>
                                <td style="font-family: Tahoma, monospace; font-weight: bold;">${formatDateToJalali(c.dueDate)}</td>
                                <td style="font-weight: bold;">${c.daysToDue ?? 0}</td>
                                <td>${c.status || 'فعال'}</td>
                                <td class="num-cell">${c.amount.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #e2e8f0; font-weight: bold; border-top: 2px solid #000;">
                            <td colspan="10" style="text-align: left; padding: 6px 10px; font-size: 11px;">جمع کل مبالغ چک‌ها (ریال):</td>
                            <td class="num-cell" style="padding: 6px; font-size: 11px; font-weight: bold;">${totalAmt.toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>

                <div class="total-bar">
                    <span><b>تعداد کل ردیف‌ها:</b> ${list.length} فقره چک فعال</span>
                    <span><b>جمع کل:</b> ${totalAmt.toLocaleString()} ریال (${Math.round(totalAmt / 10).toLocaleString()} تومان)</span>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 400);
        }
    };

    // Export Cheques to Excel / CSV with Persian UTF-8 BOM
    const handleExportChequesExcel = () => {
        const list = getFilteredCheques();
        if (list.length === 0) {
            toast.error("هیچ چکی برای خروجی اکسل وجود ندارد.");
            return;
        }

        const headers = [
            "ردیف",
            "نوع چک",
            "نام بانک",
            "نام شعبه",
            "صاحب چک",
            "در وجه",
            "سریال",
            "تاریخ وصول",
            "روز تا وصول",
            "وضعیت",
            "مبلغ چک (ریال)"
        ];

        const rows = [headers.join(",")];

        list.forEach((c, idx) => {
            const row = [
                idx + 1,
                `"${(c.chequeType || 'دریافتنی').replace(/"/g, '""')}"`,
                `"${(c.bankName || '').replace(/"/g, '""')}"`,
                `"${(c.branchName || '').replace(/"/g, '""')}"`,
                `"${(c.drawerName || '').replace(/"/g, '""')}"`,
                `"${(c.inOrderOf || '').replace(/"/g, '""')}"`,
                `"${(c.chequeNo || '').replace(/"/g, '""')}"`,
                `"${formatDateToJalali(c.dueDate)}"`,
                c.daysToDue ?? 0,
                `"${(c.status || 'فعال').replace(/"/g, '""')}"`,
                c.amount || 0
            ];
            rows.push(row.join(","));
        });

        // Total row
        const totalAmt = list.reduce((sum, r) => sum + r.amount, 0);
        rows.push("");
        rows.push([`"جمع کل"`, `""`, `""`, `""`, `""`, `""`, `""`, `""`, `""`, `""`, totalAmt].join(","));

        const csvContent = rows.join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Cheques_Report_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("فایل اکسل چک‌ها با موفقیت دانلود شد.");
    };

    // Send Cheques to Telegram / Bale / WhatsApp Bot
    const handleSendChequesToBot = async (scope?: 'vault' | 'returned' | 'matured' | 'filtered') => {
        const targetScope = scope || chequeBotTargetType;
        setIsSendingChequesBot(true);
        try {
            const customTargets: any = {};
            if (chequeBotCustomGroupTele.trim()) customTargets.telegram = chequeBotCustomGroupTele.trim();
            if (chequeBotCustomGroupBale.trim()) customTargets.bale = chequeBotCustomGroupBale.trim();
            if (chequeBotCustomGroupWa.trim()) customTargets.whatsapp = chequeBotCustomGroupWa.trim();

            let payload: any = {
                selectedPlatforms: chequeBotSelectedPlatforms,
                attachPdf: chequeBotAttachPdf,
                attachExcel: chequeBotAttachExcel,
                customTargets: Object.keys(customTargets).length > 0 ? customTargets : undefined,
                reportType: targetScope,
                sortBy: chequeSortBy,
                sortOrder: chequeSortOrder,
                filterBank: chequeBankFilter !== 'all' ? chequeBankFilter : undefined,
                filterDrawer: chequeDrawerFilter !== 'all' ? chequeDrawerFilter : undefined,
                title: chequeBotCustomTitle.trim() || undefined
            };

            const todayShamsiStr = formatDateToJalali(new Date().toISOString());
            let targetedCheques: any[] = [];
            if (targetScope === 'filtered') {
                targetedCheques = getFilteredCheques();
            } else if (targetScope === 'returned') {
                targetedCheques = chequesData.filter(c => c.statusGroup === 'returned' || String(c.statusDesc || '').includes('برگشت') || c.isReturnedToBox);
            } else if (targetScope === 'matured') {
                targetedCheques = chequesData.filter(c => (c.statusGroup === 'in_hand' || !c.statusGroup) && (formatDateToJalali(c.dueDate) === todayShamsiStr || String(c.dueDate).startsWith(todayShamsiStr)));
            } else {
                // vault / in_hand
                targetedCheques = chequesData.filter(c => c.statusGroup === 'in_hand' || !c.statusGroup || c.statusType === '1' || c.statusType === 'دریافتی');
            }

            if (targetedCheques && targetedCheques.length > 0) {
                payload.customCheques = targetedCheques;
            } else if (chequesData && chequesData.length > 0) {
                payload.customCheques = chequesData;
            }

            const res = await fetch(getEffectiveApiUrl('/api/sayan/cheques-report/send'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok || data.sent === false) {
                throw new Error(data.error || 'خطا در ارسال به بات - لطفاً شناسه گروه مقصد یا توکن ربات را در تنظیمات یا پنجره ارسال بررسی نمایید.');
            }

            const platformsSuccess = (data.results || data.sendDetails || [])
                .filter((r: any) => r.success)
                .map((r: any) => r.platform === 'telegram' ? 'تلگرام' : r.platform === 'bale' ? 'بله' : 'واتساپ')
                .join('، ');

            toast.success(`گزارش چک‌ها با موفقیت به پیام‌رسان‌های (${platformsSuccess || 'مقصد'}) ارسال گردید.`);
            setIsChequeBotModalOpen(false);
        } catch (err: any) {
            console.error("Cheques Send Bot Error:", err);
            toast.error(`خطا در ارسال گزارش چک‌ها: ${err.message}`);
        } finally {
            setIsSendingChequesBot(false);
        }
    };

    // ==========================================
    // RE-FETCH ON TAB CHANGE
    // ==========================================
    useEffect(() => {
        if (activeTab === 'traz') {
            fetchTraz();
        } else if (activeTab === 'sales') {
            fetchSalesData();
        } else if (activeTab === 'production') {
            fetchProduction();
            fetchProdArchive();
        } else if (activeTab === 'cheques') {
            fetchCheques();
        }
    }, [activeTab, dateFrom, dateTo, trazCategory, compareMode, salesDateFromB, salesDateToB, prodGrouping]);

    // Sales calculations
    const stats = getSalesOverviewStats();
    const chartData = getComparisonChartData();
    const todayInvoices = getTodayInvoices();
    const displayedInvoices = salesViewMode === 'range' ? salesData : todayInvoices;
    const filteredTraz = getFilteredTraz();
    const groupedProduction = getGroupedProduction();
    const filteredCheques = getFilteredCheques();

    const uniqueChequeBanks = useMemo(() => {
        const banks = new Set<string>();
        chequesData.forEach(c => {
            if (c.bankName && c.bankName.trim()) banks.add(c.bankName.trim());
        });
        return Array.from(banks).sort((a, b) => a.localeCompare(b, 'fa'));
    }, [chequesData]);

    return (
        <div className="p-2 sm:p-4 md:p-6 rtl max-w-full mx-auto space-y-4 sm:space-y-6 select-none">
            {/* Main Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-gray-200 pb-5 gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 font-sans tracking-tight">گزارشات هوشمند مالی و فروش سایان ERP</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">اتصال بلادرنگ و پایش لحظه‌ای اسناد و داده‌های مالی کارخانه</p>
                </div>
                
                {/* Global Date Filter */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-white rounded-lg shadow-sm border border-slate-200 p-2 sm:p-2.5 w-full lg:w-auto">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <span>بازه زمانی گزارش:</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 shadow-inner">
                            <input 
                                type="text" 
                                placeholder="۱۴۰۴/۰۱/۰۱"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="text-xs bg-transparent outline-none focus:ring-0 text-slate-800 font-bold font-mono w-24 text-center"
                            />
                        </div>
                        <span className="text-xs text-slate-400 font-bold">تا</span>
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 shadow-inner">
                            <input 
                                type="text" 
                                placeholder="۱۴۰۴/۱۲/۲۹"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="text-xs bg-transparent outline-none focus:ring-0 text-slate-800 font-bold font-mono w-24 text-center"
                            />
                        </div>
                    </div>

                    {/* Quick Date Buttons */}
                    <div className="flex flex-wrap items-center gap-1 border-t sm:border-t-0 sm:border-r border-slate-200 pt-2 sm:pt-0 sm:pr-3">
                        <button
                            onClick={() => applyQuickDate('today')}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] sm:text-xs px-2 py-1 font-semibold transition-colors cursor-pointer"
                            title="تنظیم بازه روی امروز"
                        >
                            امروز
                        </button>
                        <button
                            onClick={() => applyQuickDate('yesterday')}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] sm:text-xs px-2 py-1 font-semibold transition-colors cursor-pointer"
                            title="تنظیم بازه روی دیروز"
                        >
                            دیروز
                        </button>
                        <button
                            onClick={() => applyQuickDate('month')}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] sm:text-xs px-2 py-1 font-semibold transition-colors cursor-pointer"
                            title="تنظیم بازه روی کل ماه جاری"
                        >
                            ماه جاری
                        </button>
                        <button
                            onClick={() => applyQuickDate('quarter')}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] sm:text-xs px-2 py-1 font-semibold transition-colors cursor-pointer"
                            title="تنظیم بازه روی فصل جاری"
                        >
                            فصل جاری
                        </button>
                        <button
                            onClick={() => applyQuickDate('default')}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 rounded text-[10px] sm:text-xs px-2 py-1 font-bold transition-colors cursor-pointer border border-amber-200"
                            title="بازنشانی بازه به پیش‌فرض"
                        >
                            پیش‌فرض
                        </button>
                        <button
                            onClick={saveCurrentAsDefaultDate}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-800 rounded text-[10px] sm:text-xs px-2 py-1 font-bold transition-colors cursor-pointer border border-blue-200 flex items-center gap-0.5"
                            title="ذخیره بازه فعلی به عنوان پیش‌فرض"
                        >
                            <Save className="w-3 h-3" />
                            <span>ثبت دیفالت</span>
                        </button>
                    </div>

                    <button 
                        onClick={() => {
                            if (activeTab === 'traz') fetchTraz();
                            if (activeTab === 'sales') fetchSalesData();
                            if (activeTab === 'production') { fetchProduction(); fetchProdArchive(); }
                            if (activeTab === 'cheques') fetchCheques();
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded text-xs px-3 py-1.5 font-semibold flex items-center gap-1 transition-colors cursor-pointer mr-auto lg:mr-0 mt-1 sm:mt-0"
                    >
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'بروزرسانی'}
                    </button>
                </div>
            </div>

            {/* Premium Tab Bar */}
            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:space-x-reverse sm:space-x-2 border-b border-slate-200 bg-slate-50 p-1.5 rounded-lg">
                {isTrazAllowed && (
                    <button 
                        onClick={() => setActiveTab('traz')} 
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:py-2.5 sm:px-5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'traz' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                        <ArrowUpDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">تراز معین تفصیلی مشتریان</span>
                    </button>
                )}
                {isSalesAllowed && (
                    <button 
                        onClick={() => setActiveTab('sales')} 
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:py-2.5 sm:px-5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'sales' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                        <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">گزارش فروش و برگشت از فروش</span>
                    </button>
                )}
                {isProductionAllowed && (
                    <button 
                        onClick={() => setActiveTab('production')} 
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:py-2.5 sm:px-5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'production' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                        <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">آمار تولید و ضایعات کارخانه</span>
                    </button>
                )}
                {isChequesAllowed && (
                    <button 
                        onClick={() => setActiveTab('cheques')} 
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:py-2.5 sm:px-5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'cheques' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                        <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">اسناد دریافتنی (چک‌ها)</span>
                    </button>
                )}
                {isRemittancesAllowed && (
                    <button 
                        onClick={() => setActiveTab('remittances')} 
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:py-2.5 sm:px-5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'remittances' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                        <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">حواله فروش و خروج کالا</span>
                    </button>
                )}
                {isWarehouseOverviewAllowed && (
                    <button 
                        onClick={() => setActiveTab('warehouseOverview')} 
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:py-2.5 sm:px-5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'warehouseOverview' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                        <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">تراز وزنی و نمای کلی انبار</span>
                    </button>
                )}
            </div>

            {/* TAB CONTENT PANEL */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-100 dark:border-zinc-800 overflow-hidden">
                
                {/* 1. TRAZ TAB */}
                {activeTab === 'traz' && (
                    <div className="p-2 sm:p-6 space-y-3 sm:space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">مانده بدهکاران و بستانکاران</h2>
                                <p className="text-xs text-slate-500 mt-1">تراز اشخاص، سورت شده براساس بیشترین تعهد مالی</p>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                <select 
                                    className="border border-slate-300 rounded-md py-1.5 px-3 text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    value={trazCategory}
                                    onChange={(e) => setTrazCategory(e.target.value)}
                                >
                                    <option value="all">همه اشخاص</option>
                                    <option value="customers">مشتریان</option>
                                    <option value="suppliers">تامین کنندگان</option>
                                    <option value="personnel">پرسنل و همکاران</option>
                                    <option value="shareholders">سهام داران</option>
                                    <option value="debtors">بدهکاران (فقط بدهکار)</option>
                                    <option value="creditors">بستانکاران (فقط بستانکار)</option>
                                </select>

                                <button 
                                    onClick={() => setTrazSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                    className="flex items-center gap-1 border border-slate-300 rounded-md py-1.5 px-3 text-xs bg-white hover:bg-slate-50 font-medium transition-colors"
                                    title="تغییر جهت مرتب‌سازی"
                                >
                                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                                    <span>سورت: {trazSortOrder === 'desc' ? 'نزولی' : 'صعودی'}</span>
                                </button>
                                
                                <div className="relative w-full md:w-56">
                                    <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <input 
                                        type="text"
                                        placeholder="جستجوی شخص..." 
                                        className="w-full pl-3 pr-8 py-1.5 border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        value={trazSearch}
                                        onChange={(e) => setTrazSearch(e.target.value)}
                                    />
                                </div>

                                <button 
                                    onClick={() => handlePrintTrazReport('bed')} 
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md border border-rose-200 text-xs font-semibold transition-colors"
                                >
                                    <Printer className="w-3.5 h-3.5" /> خروجی بدهکاران
                                </button>
                                <button 
                                    onClick={() => handlePrintTrazReport('bes')} 
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md border border-emerald-200 text-xs font-semibold transition-colors"
                                >
                                    <Printer className="w-3.5 h-3.5" /> خروجی بستانکاران
                                </button>
                            </div>
                        </div>

                        {/* Traz KPIs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-rose-50/50 rounded-xl border border-rose-100/80 p-4">
                                <div className="text-rose-700 font-bold text-xs">جمع بدهی بدهکاران</div>
                                <div className="text-2xl font-extrabold text-rose-900 mt-2 font-mono">
                                    {formatMoney(filteredTraz.filter(t => t.balance > 0).reduce((sum, r) => sum + r.balance, 0))} <span className="text-xs font-medium">ریال</span>
                                </div>
                                <div className="text-[10px] text-rose-600 mt-1">شامل {filteredTraz.filter(t => t.balance > 0).length} شخص بدهکار</div>
                            </div>
                            <div className="bg-emerald-50/50 rounded-xl border border-emerald-100/80 p-4">
                                <div className="text-emerald-700 font-bold text-xs">جمع طلب بستانکاران</div>
                                <div className="text-2xl font-extrabold text-emerald-900 mt-2 font-mono">
                                    {formatMoney(filteredTraz.filter(t => t.balance < 0).reduce((sum, r) => sum + Math.abs(r.balance), 0))} <span className="text-xs font-medium">ریال</span>
                                </div>
                                <div className="text-[10px] text-emerald-600 mt-1">شامل {filteredTraz.filter(t => t.balance < 0).length} شخص بستانکار</div>
                            </div>
                            <div className="bg-blue-50/50 rounded-xl border border-blue-100/80 p-4">
                                <div className="text-blue-700 font-bold text-xs">خالص وضعیت تعهدات</div>
                                <div className="text-2xl font-extrabold text-blue-900 mt-2 font-mono">
                                    {formatMoney(filteredTraz.reduce((sum, r) => sum + r.balance, 0))} <span className="text-xs font-medium">ریال</span>
                                </div>
                                <div className="text-[10px] text-blue-600 mt-1">مانده خالص برآیند حساب‌های جاری</div>
                            </div>
                        </div>

                        {/* Traz Data Table */}
                        <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[500px] overflow-y-auto">
                            {/* Desktop View */}
                            <table className="w-full text-right text-xs hidden md:table">
                                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                                    <tr>
                                        <th className="p-3.5 font-bold text-slate-700 w-16 text-center">ردیف</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-32">کد تفصیلی</th>
                                        <th className="p-3.5 font-bold text-slate-700">نام و نام خانوادگی شخص</th>
                                        <th className="p-3.5 font-bold text-slate-700 text-left">مجموع بدهکار (ریال)</th>
                                        <th className="p-3.5 font-bold text-slate-700 text-left">مجموع بستانکار (ریال)</th>
                                        <th className="p-3.5 font-bold text-slate-700 text-left">مانده حساب (ریال)</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-28 text-center">تشخیص</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-32 text-center">عملیات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredTraz.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                                                {isLoading ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                                        <span>در حال واکشی اطلاعات تراز سایان...</span>
                                                    </div>
                                                ) : 'هیچ رکوردی یافت نشد'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTraz.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-3 text-slate-400 text-center font-medium">{idx + 1}</td>
                                                <td className="p-3 font-mono text-slate-600 font-medium">{row.code}</td>
                                                <td className="p-3 font-bold text-slate-900">{row.name}</td>
                                                <td className="p-3 text-left text-rose-600 font-mono font-medium">{formatMoney(row.bed)}</td>
                                                <td className="p-3 text-left text-emerald-600 font-mono font-medium">{formatMoney(row.bes)}</td>
                                                <td className={`p-3 text-left font-extrabold font-mono ${row.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                    {formatMoney(row.balance)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                                        row.balance > 0 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                    }`}>
                                                        {row.balance > 0 ? 'بدهکار' : 'بستانکار'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedTafsili(row.code);
                                                            setModalTafsiliCode(row.code);
                                                            setModalTafsiliName(row.name);
                                                            setIsStatementModalOpen(true);
                                                            fetchStatement(row.code);
                                                        }}
                                                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-md border border-blue-200 text-[10px] flex items-center gap-1 mx-auto transition-colors cursor-pointer shadow-sm"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        صورتحساب ریز
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {/* Mobile View */}
                            <div className="block md:hidden divide-y divide-slate-100 bg-white">
                                {filteredTraz.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 font-medium">
                                        {isLoading ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                                <span>در حال واکشی اطلاعات تراز سایان...</span>
                                            </div>
                                        ) : 'هیچ رکوردی یافت نشد'}
                                    </div>
                                ) : (
                                    filteredTraz.map((row, idx) => (
                                        <div key={idx} className="p-4 hover:bg-slate-50/50 transition-colors space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 font-medium font-mono">#{idx + 1} | کد: {row.code}</span>
                                                    <h3 className="text-sm font-black text-slate-900 mt-0.5">{row.name}</h3>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                                                    row.balance > 0 ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                }`}>
                                                    {row.balance > 0 ? 'بدهکار' : 'بستانکار'}
                                                </span>
                                            </div>
                                            
                                            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-[11px]">
                                                <div>
                                                    <div className="text-slate-400 font-medium">گردش بدهکار</div>
                                                    <div className="font-mono font-bold text-slate-700 mt-0.5">{formatMoney(row.bed)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-slate-400 font-medium">گردش بستانکار</div>
                                                    <div className="font-mono font-bold text-slate-700 mt-0.5">{formatMoney(row.bes)}</div>
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-slate-400 font-medium">مانده نهایی</div>
                                                    <div className={`font-mono font-black mt-0.5 ${row.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                        {formatMoney(row.balance)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-end pt-1">
                                                <button
                                                    onClick={() => {
                                                        setSelectedTafsili(row.code);
                                                        setModalTafsiliCode(row.code);
                                                        setModalTafsiliName(row.name);
                                                        setIsStatementModalOpen(true);
                                                        fetchStatement(row.code);
                                                    }}
                                                    className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-sm"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                    مشاهده صورتحساب ریز تفصیلی
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. STATEMENT TAB DISABLED */}
                {false && activeTab === 'statement' && (
                    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
                        <div className="border-b border-slate-100 pb-4">
                            <h2 className="text-xl font-bold text-slate-800">ریز صورتحساب و دفاترحساب اشخاص</h2>
                            <p className="text-xs text-slate-500 mt-1">مشاهده ریز گردش مالی و جزئیات اسناد حسابداری هر تفصیلی</p>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-xl">
                            <div className="flex-1 w-full relative">
                                <label className="block text-xs font-bold mb-1.5 text-slate-700">انتخاب شخص تفصیلی (ACT_TBL_007)</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="جستجوی شخص..." 
                                        value={tafsiliSearch} 
                                        onChange={e => setTafsiliSearch(e.target.value)} 
                                        className="w-1/3 border border-slate-300 rounded-md py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" 
                                    />
                                    <select 
                                        className="w-2/3 border border-slate-300 rounded-md py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-bold"
                                        value={selectedTafsili}
                                        onChange={(e) => setSelectedTafsili(e.target.value)}
                                    >
                                        <option value="">-- تفصیلی مورد نظر را انتخاب کنید --</option>
                                        {tafsilis.filter(t => !tafsiliSearch || t.Name?.includes(tafsiliSearch) || t.Code?.includes(tafsiliSearch)).map(t => (
                                            <option key={t.Code} value={t.Code}>{t.Name} (کد: {t.Code})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <button 
                                    onClick={() => fetchStatement()} 
                                    disabled={isLoading || !selectedTafsili} 
                                    className="flex-1 md:flex-none px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                                >
                                    {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    نمایش صورتحساب
                                </button>
                                <button 
                                    onClick={handlePrintStatement}
                                    disabled={statementData.length === 0}
                                    className="flex-1 md:flex-none px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                                >
                                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                                    چاپ / PDF
                                </button>
                            </div>
                        </div>

                        {statementData.length > 0 && (
                            <div className="flex justify-end mb-2">
                                <input 
                                    type="text" 
                                    placeholder="جستجو در شرح تراکنش..." 
                                    value={statementSearch} 
                                    onChange={e => setStatementSearch(e.target.value)} 
                                    className="w-full md:w-1/3 border border-slate-300 rounded-md py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" 
                                />
                            </div>
                        )}

                        {statementData.length > 0 ? (
                            <div className="space-y-4">
                                <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[450px] overflow-y-auto">
                                    <table className="w-full text-right text-xs">
                                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                                            <tr>
                                                <th className="p-3 font-bold text-slate-700 w-24">تاریخ سند</th>
                                                <th className="p-3 font-bold text-slate-700 w-24">شماره سند</th>
                                                <th className="p-3 font-bold text-slate-700 w-40">سرفصل معین</th>
                                                <th className="p-3 font-bold text-slate-700">شرح آرتیکل</th>
                                                <th className="p-3 font-bold text-slate-700 text-left w-36">بدهکار (ریال)</th>
                                                <th className="p-3 font-bold text-slate-700 text-left w-36">بستانکار (ریال)</th>
                                                <th className="p-3 font-bold text-slate-700 text-left w-40">مانده حساب (ریال)</th>
                                                <th className="p-3 font-bold text-slate-700 w-20 text-center">تشخیص</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredStatementData.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-3 font-medium text-slate-500 whitespace-nowrap">{formatDateToJalali(row.Date)}</td>
                                                    <td className="p-3 font-mono text-slate-600 font-semibold">{row.SanadNo}</td>
                                                    <td className="p-3 text-slate-600 font-medium whitespace-nowrap">
                                                        {row.MoeinGroup && row.MoeinParent && row.MoeinCode ? (
                                                            <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-[10px] font-extrabold">
                                                                {row.MoeinGroup}{row.MoeinParent}{row.MoeinCode} - {row.MoeinName || 'سایر'}
                                                            </span>
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </td>
                                                    <td className="p-3 font-medium text-slate-800 leading-relaxed">{row.Description || 'ثبت حسابداری'}</td>
                                                    <td className="p-3 text-left text-rose-600 font-mono font-medium">{row.bed > 0 ? formatMoney(row.bed) : '-'}</td>
                                                    <td className="p-3 text-left text-emerald-600 font-mono font-medium">{row.bes > 0 ? formatMoney(row.bes) : '-'}</td>
                                                    <td className={`p-3 text-left font-extrabold font-mono ${row.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                        {formatMoney(row.balance)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                                            row.balance > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                                                        }`}>
                                                            {row.balance > 0 ? 'بدهکار' : 'بستانکار'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            
                                            {/* Summary Sticky Foot */}
                                            <tr className="bg-slate-50 font-extrabold sticky bottom-0 border-t-2 border-slate-200 shadow-[0_-2px_6px_rgba(0,0,0,0.03)] z-10">
                                                <td colSpan={4} className="p-4 text-left font-extrabold text-slate-700">مجموع دوره تراکنش‌ها:</td>
                                                <td className="p-4 text-left text-rose-700 font-mono text-sm">
                                                    {formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bed, 0))}
                                                </td>
                                                <td className="p-4 text-left text-emerald-700 font-mono text-sm">
                                                    {formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bes, 0))}
                                                </td>
                                                <td colSpan={2} className={`p-4 text-left font-black font-mono text-sm ${
                                                    filteredStatementData[filteredStatementData.length - 1]?.balance > 0 ? 'text-rose-700' : 'text-emerald-700'
                                                }`}>
                                                    {formatMoney(filteredStatementData[filteredStatementData.length - 1]?.balance || 0)}
                                                    <span className="text-[10px] font-bold mr-1">
                                                        ({(filteredStatementData[filteredStatementData.length - 1]?.balance || 0) > 0 ? 'بدهکار' : 'بستانکار'})
                                                    </span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-16 text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-xl">
                                {isLoading ? 'در حال دریافت ریز حساب سایان...' : 'شخص را انتخاب کرده و دکمه نمایش صورتحساب را بزنید'}
                            </div>
                        )}
                    </div>
                )}

                {/* 3. SALES & COMPARISONS TAB */}
                {activeTab === 'sales' && (
                    <div className="p-3.5 sm:p-6">
                        <SayanSalesDashboard
                            salesData={salesData}
                            compareDataB={compareSalesDataB}
                            dateFrom={dateFrom}
                            dateTo={dateTo}
                            salesDateFromB={salesDateFromB}
                            salesDateToB={salesDateToB}
                            compareMode={compareMode}
                            isLoading={isLoading}
                            settings={settings}
                            onRefreshData={fetchSalesData}
                            onDateRangeChange={(from, to) => {
                                setDateFrom(from);
                                setDateTo(to);
                            }}
                            onCompareDateRangeChange={(fromB, toB) => {
                                setSalesDateFromB(fromB);
                                setSalesDateToB(toB);
                            }}
                            onToggleCompareMode={(enabled) => setCompareMode(enabled)}
                            runSayanQuery={runSayanQuery}
                        />
                    </div>
                )}
                {(false as boolean) && (
                    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">تحلیل پیشرفته فروش سایان</h2>
                                <p className="text-xs text-slate-500 mt-1">پایش دوره‌ای فروش با ابزار مقایسه‌ای پیشرفته محصول و وزن کالا</p>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2">
                                <button 
                                    onClick={handlePrintTodaySales}
                                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3.5 rounded-lg text-xs transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
                                    title="دریافت گزارش تفکیکی فروش امروز با فرمت چاپی رسمی و خروجی PDF"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>فرم چاپی فروش روزانه (PDF)</span>
                                </button>
                                <button 
                                    onClick={handlePrintPeriodSales}
                                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3.5 rounded-lg text-xs transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
                                    title="دریافت گزارش جامع فاکتورهای دوره‌ای با فرمت رسمی و خروجی PDF"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>فرم چاپی فروش دوره‌ای (PDF)</span>
                                </button>

                                <button 
                                    onClick={() => handleSendSalesBotReport('today')}
                                    disabled={isSendingSalesBot}
                                    className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-3.5 rounded-lg text-xs transition-all cursor-pointer shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
                                    title="ارسال دستی آمار و گزارش فروش امروز به کانال‌ها و گروه‌های بله و تلگرام"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>{isSendingSalesBot ? 'در حال ارسال امروز...' : 'ارسال دستی فروش امروز به بات'}</span>
                                </button>
                                <button 
                                    onClick={() => handleSendSalesBotReport('yesterday')}
                                    disabled={isSendingSalesBot}
                                    className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold py-2 px-3.5 rounded-lg text-xs transition-all cursor-pointer shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
                                    title="ارسال دستی آمار و گزارش فروش دیروز به کانال‌ها و گروه‌های بله و تلگرام"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>{isSendingSalesBot ? 'در حال ارسال دیروز...' : 'ارسال دستی فروش دیروز به بات'}</span>
                                </button>

                                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 select-none shadow-inner">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCompareMode(false);
                                            setSalesViewMode('today');
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${!compareMode && salesViewMode === 'today' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        فروش امروز
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCompareMode(false);
                                            setSalesViewMode('range');
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${!compareMode && salesViewMode === 'range' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        فروش طبق بازه
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCompareMode(true);
                                            setSalesViewMode('range');
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${compareMode ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'}`}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                        <span>⚡ پایش مقایسه‌ای ۲ بازه (Period A vs B)</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Banner for quick comparative mode activation */}
                        {!compareMode && (
                            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white p-3.5 rounded-xl shadow-md flex flex-col md:flex-row items-center justify-between gap-3 border border-blue-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 font-bold shrink-0">
                                        VS
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-blue-200 flex items-center gap-2">
                                            <span>ابزار پایش و تحلیل مقایسه‌ای ۲ بازه (Period A vs B)</span>
                                            <span className="bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded text-[9px]">جدید</span>
                                        </div>
                                        <p className="text-[11px] text-slate-300 mt-0.5">
                                            پایش مقایسه‌ای فروش، وزن خالص، مرجوعی کد ۱۳، میانگین فی نهایی اقلام، میانبر همسان سال قبل و چاپ PDF
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCompareMode(true);
                                        setSalesViewMode('range');
                                    }}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 py-2 rounded-lg text-xs transition-all shadow-md shrink-0 cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>مشاهده و شروع تحلیل مقایسه‌ای</span>
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Comparison date pickers & Control Panel */}
                        {compareMode && (
                            <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/80 p-4 rounded-xl border border-blue-200 shadow-sm space-y-3 animate-fadeIn">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-blue-200/60 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
                                            VS
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-extrabold text-blue-950">داشبورد و پنل تخصصی پایش مقایسه‌ای فروش (Period A vs Period B)</h3>
                                            <p className="text-[11px] text-blue-700 font-medium">مقایسه تراز فروش، مرجوعی کد ۱۳، وزن خالص و میانگین فی نهایی اقلام</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex bg-white rounded-lg p-1 border border-blue-200 shadow-sm">
                                            <button
                                                type="button"
                                                onClick={() => setCompareGroupBy('group')}
                                                className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${compareGroupBy === 'group' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
                                            >
                                                تفکیک: گروه کالا
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCompareGroupBy('item')}
                                                className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${compareGroupBy === 'item' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
                                            >
                                                تفکیک: نام دقیق کالا
                                            </button>
                                        </div>

                                        <button
                                            onClick={handlePrintComparativeSales}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                                        >
                                            <Printer className="w-3.5 h-3.5" />
                                            <span>چاپ رسمی مقایسه‌ای (PDF)</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white/80 p-3 rounded-lg border border-blue-100 shadow-inner">
                                        <div className="text-xs font-bold text-blue-800 mb-1.5 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                                                بازه اول ( Period A ) — بازه اصلی
                                            </span>
                                            <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">بازه پایه</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2.5 py-1 w-full shadow-inner">
                                                <input 
                                                    type="text" 
                                                    placeholder="از تاریخ"
                                                    value={dateFrom}
                                                    onChange={(e) => setDateFrom(e.target.value)}
                                                    className="text-xs bg-transparent outline-none focus:ring-0 text-slate-800 font-bold font-mono w-full text-center"
                                                />
                                            </div>
                                            <span className="text-xs text-slate-400 font-bold">تا</span>
                                            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2.5 py-1 w-full shadow-inner">
                                                <input 
                                                    type="text" 
                                                    placeholder="تا تاریخ"
                                                    value={dateTo}
                                                    onChange={(e) => setDateTo(e.target.value)}
                                                    className="text-xs bg-transparent outline-none focus:ring-0 text-slate-800 font-bold font-mono w-full text-center"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white/80 p-3 rounded-lg border border-indigo-100 shadow-inner">
                                        <div className="text-xs font-bold text-indigo-800 mb-1.5 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                                بازه دوم ( Period B ) — مقایسه‌ای
                                            </span>
                                            <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">بازه تطبیقی</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2.5 py-1 w-full shadow-inner">
                                                <input 
                                                    type="text" 
                                                    placeholder="از تاریخ"
                                                    value={salesDateFromB}
                                                    onChange={(e) => setSalesDateFromB(e.target.value)}
                                                    className="text-xs bg-transparent outline-none focus:ring-0 text-slate-800 font-bold font-mono w-full text-center"
                                                />
                                            </div>
                                            <span className="text-xs text-slate-400 font-bold">تا</span>
                                            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2.5 py-1 w-full shadow-inner">
                                                <input 
                                                    type="text" 
                                                    placeholder="تا تاریخ"
                                                    value={salesDateToB}
                                                    onChange={(e) => setSalesDateToB(e.target.value)}
                                                    className="text-xs bg-transparent outline-none focus:ring-0 text-slate-800 font-bold font-mono w-full text-center"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-blue-100">
                                    <span className="text-[11px] font-bold text-slate-600">میانبر بازه دوم:</span>
                                    <button
                                        type="button"
                                        onClick={() => applyQuickComparePreset('prev_year')}
                                        className="bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 rounded text-[11px] px-2.5 py-1 font-bold transition-all cursor-pointer shadow-xs"
                                    >
                                        همسان سال قبل (پارسال)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyQuickComparePreset('prev_month')}
                                        className="bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 rounded text-[11px] px-2.5 py-1 font-bold transition-all cursor-pointer shadow-xs"
                                    >
                                        ماه قبل
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyQuickComparePreset('prev_quarter')}
                                        className="bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 rounded text-[11px] px-2.5 py-1 font-bold transition-all cursor-pointer shadow-xs"
                                    >
                                        فصل قبل
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Top-level overviews for Period A */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/70 rounded-xl p-4 border border-blue-200 shadow-sm col-span-1 sm:col-span-2 md:col-span-1">
                                <div className="text-blue-800 font-bold text-[11px] flex items-center justify-between">
                                    <span>فروش خالص بازه</span>
                                    <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-mono">فی: {formatMoney(Math.round(stats.rangeFinalPrice))}</span>
                                </div>
                                <div className="text-lg font-black text-blue-950 mt-1 font-mono">
                                    {formatMoney(stats.rangeNetAmt)} <span className="text-[10px] font-bold">ریال</span>
                                </div>
                                <div className="text-[10px] text-blue-700 font-semibold mt-1">
                                    وزن خالص: {stats.rangeNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
                                </div>
                                {stats.rangeRetAmt > 0 && (
                                    <div className="text-[9px] text-rose-600 font-medium mt-0.5">
                                        مرجوعی کد ۱۳: {formatMoney(stats.rangeRetAmt)} ریال ({stats.rangeRetQty.toFixed(1)} ک‌گ)
                                    </div>
                                )}
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
                                <div className="text-slate-600 font-bold text-[11px] flex items-center justify-between">
                                    <span>فروش خالص امروز</span>
                                    <span className="text-[9px] text-slate-500 font-mono">فی: {formatMoney(Math.round(stats.todayFinalPrice))}</span>
                                </div>
                                <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                                    {formatMoney(stats.todayNetAmt)} <span className="text-[10px] font-bold">ریال</span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium mt-1">
                                    وزن خالص: {stats.todayNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
                                </div>
                                {stats.todayRetAmt > 0 && (
                                    <div className="text-[9px] text-rose-600 font-medium mt-0.5">
                                        مرجوعی کد ۱۳: {formatMoney(stats.todayRetAmt)} ریال
                                    </div>
                                )}
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
                                <div className="text-slate-600 font-bold text-[11px] flex items-center justify-between">
                                    <span>فروش خالص این ماه</span>
                                    <span className="text-[9px] text-slate-500 font-mono">فی: {formatMoney(Math.round(stats.monthFinalPrice))}</span>
                                </div>
                                <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                                    {formatMoney(stats.monthNetAmt)} <span className="text-[10px] font-bold">ریال</span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium mt-1">
                                    وزن خالص: {stats.monthNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
                                <div className="text-slate-600 font-bold text-[11px] flex items-center justify-between">
                                    <span>فروش خالص فصل جاری</span>
                                    <span className="text-[9px] text-slate-500 font-mono">فی: {formatMoney(Math.round(stats.quarterFinalPrice))}</span>
                                </div>
                                <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                                    {formatMoney(stats.quarterNetAmt)} <span className="text-[10px] font-bold">ریال</span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium mt-1">
                                    وزن خالص: {stats.quarterNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
                                <div className="text-slate-600 font-bold text-[11px] flex items-center justify-between">
                                    <span>فروش خالص امسال</span>
                                    <span className="text-[9px] text-slate-500 font-mono">فی: {formatMoney(Math.round(stats.yearFinalPrice))}</span>
                                </div>
                                <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                                    {formatMoney(stats.yearNetAmt)} <span className="text-[10px] font-bold">ریال</span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium mt-1">
                                    وزن خالص: {stats.yearNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
                                </div>
                            </div>
                        </div>

                        {/* Product Group Breakdown with Return Code 13 & Final Unit Price Table */}
                        {(() => {
                            const groupMap = new Map<string, {
                                groupName: string;
                                itemName: string;
                                salesQty: number;
                                salesAmt: number;
                                returnQty: number;
                                returnAmt: number;
                            }>();

                            displayedInvoices.forEach(row => {
                                const key = `${row.GroupName || 'سایر'}_${row.ItemName || 'کالا'}`;
                                const qty = isActualProduct(row) ? (parseFloat(row.Quantity || 0) || 0) : 0;
                                const amt = parseFloat(row.Amount || 0);
                                const isReturn = row.OpCode === '13';

                                if (!groupMap.has(key)) {
                                    groupMap.set(key, {
                                        groupName: row.GroupName || 'سایر گروه‌ها',
                                        itemName: row.ItemName || 'کالای بدون نام',
                                        salesQty: 0,
                                        salesAmt: 0,
                                        returnQty: 0,
                                        returnAmt: 0
                                    });
                                }

                                const itemData = groupMap.get(key)!;
                                if (isReturn) {
                                    itemData.returnQty += qty;
                                    itemData.returnAmt += amt;
                                } else {
                                    itemData.salesQty += qty;
                                    itemData.salesAmt += amt;
                                }
                            });

                            const groupList = Array.from(groupMap.values());
                            if (groupList.length === 0) return null;

                            let totSalesQty = 0, totSalesAmt = 0, totRetQty = 0, totRetAmt = 0;
                            groupList.forEach(g => {
                                totSalesQty += g.salesQty;
                                totSalesAmt += g.salesAmt;
                                totRetQty += g.returnQty;
                                totRetAmt += g.returnAmt;
                            });

                            const totNetQty = totSalesQty - totRetQty;
                            const totNetAmt = totSalesAmt - totRetAmt;
                            const totFinalPrice = totNetQty > 0 ? (totNetAmt / totNetQty) : 0;

                            return (
                                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-6 mb-2">
                                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm">جدول خلاصه عملکرد: گروه کالا، مرجوعی (کد ۱۳) و فی نهایی</span>
                                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">پایگاه داده سایان ERP</span>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-right text-xs">
                                            <thead>
                                                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                                                    <th className="p-3 w-12 text-center">ردیف</th>
                                                    <th className="p-3">گروه / نام کالا</th>
                                                    <th className="p-3 text-center">فروش ناخالص (ک‌گ)</th>
                                                    <th className="p-3 text-left">فروش ناخالص (ریال)</th>
                                                    <th className="p-3 text-center text-rose-700 bg-rose-50/60">مرجوعی کد ۱۳ (ک‌گ)</th>
                                                    <th className="p-3 text-left text-rose-700 bg-rose-50/60">مبلغ مرجوعی (ریال)</th>
                                                    <th className="p-3 text-center font-black text-blue-900 bg-blue-50/60">وزن خالص (ک‌گ)</th>
                                                    <th className="p-3 text-left font-black text-blue-900 bg-blue-50/60">فروش خالص (ریال)</th>
                                                    <th className="p-3 text-left font-black text-emerald-900 bg-emerald-50/60">فی نهایی (ریال / ک‌گ)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {groupList.map((g, idx) => {
                                                    const netQty = g.salesQty - g.returnQty;
                                                    const netAmt = g.salesAmt - g.returnAmt;
                                                    const finalPrice = netQty > 0 ? (netAmt / netQty) : 0;

                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                            <td className="p-3 font-semibold text-slate-800">
                                                                <div className="text-[10px] text-slate-500 font-normal">{g.groupName}</div>
                                                                <div className="font-bold text-slate-900">{g.itemName}</div>
                                                            </td>
                                                            <td className="p-3 text-center font-mono">{g.salesQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                                            <td className="p-3 text-left font-mono">{formatMoney(g.salesAmt)}</td>
                                                            <td className="p-3 text-center font-mono text-rose-600 bg-rose-50/30">{g.returnQty > 0 ? g.returnQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-'}</td>
                                                            <td className="p-3 text-left font-mono text-rose-600 bg-rose-50/30">{g.returnAmt > 0 ? formatMoney(g.returnAmt) : '-'}</td>
                                                            <td className="p-3 text-center font-mono font-bold text-blue-900 bg-blue-50/30">{netQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                                            <td className="p-3 text-left font-mono font-bold text-blue-900 bg-blue-50/30">{formatMoney(netAmt)}</td>
                                                            <td className="p-3 text-left font-mono font-black text-emerald-800 bg-emerald-50/30">{formatMoney(Math.round(finalPrice))}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
                                                    <td colSpan={2} className="p-3 text-right">جمع کل عملکرد:</td>
                                                    <td className="p-3 text-center font-mono">{totSalesQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                                    <td className="p-3 text-left font-mono">{formatMoney(totSalesAmt)}</td>
                                                    <td className="p-3 text-center font-mono text-rose-300">{totRetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                                    <td className="p-3 text-left font-mono text-rose-300">{formatMoney(totRetAmt)}</td>
                                                    <td className="p-3 text-center font-mono font-black text-blue-300">{totNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                                    <td className="p-3 text-left font-mono font-black text-blue-300">{formatMoney(totNetAmt)}</td>
                                                    <td className="p-3 text-left font-mono font-black text-emerald-400">{formatMoney(Math.round(totFinalPrice))}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Today's Invoices Table */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-6 mb-6">
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-800">
                                    {salesViewMode === 'range' ? 'لیست فاکتورهای فروش طبق بازه' : 'لیست فاکتورهای فروش روز'} ({
                                        (() => {
                                            const invoicesMap = new Map<string, any>();
                                            displayedInvoices.forEach(row => {
                                                const key = row.InvoiceNum || row.DocId;
                                                if (key) invoicesMap.set(key, true);
                                            });
                                            return invoicesMap.size;
                                        })()
                                    } فاکتور)
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                            <th className="p-3 font-semibold w-12 text-center">ردیف</th>
                                            <th className="p-3 font-semibold">شماره فاکتور</th>
                                            <th className="p-3 font-semibold">نام مشتری</th>
                                            <th className="p-3 font-semibold text-center">تعداد اقلام</th>
                                            <th className="p-3 font-semibold text-center">مجموع وزن/مقدار</th>
                                            <th className="p-3 font-semibold text-left">مبلغ کل (ریال)</th>
                                            <th className="p-3 font-semibold text-center w-24">جزئیات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(() => {
                                            const invoicesMap = new Map<string, {
                                                docId: string;
                                                invoiceNum: string;
                                                date: string;
                                                customerName: string;
                                                notes: string;
                                                totalAmount: number;
                                                totalQuantity: number;
                                                items: {
                                                    itemName: string;
                                                    itemCode: string;
                                                    groupName: string;
                                                    quantity: number;
                                                    amount: number;
                                                    itemNotes: string;
                                                }[];
                                            }>();
                                            
                                            displayedInvoices.forEach(row => {
                                                const key = row.InvoiceNum || row.DocId;
                                                if (!key) return;
                                                
                                                const itemAmt = parseFloat(row.Amount || 0);
                                                const itemQty = parseFloat(row.Quantity || 0);
                                                const customerName = row.CustomerName || (() => {
                                                    const notes = row.Notes || '';
                                                    const match = notes.match(/مشتری\s*:\s*([^|]+)/) || notes.match(/تامین کننده\s*:\s*([^|]+)/);
                                                    return match ? match[1].trim() : notes;
                                                })() || 'نامعلوم';
                                                
                                                if (invoicesMap.has(key)) {
                                                    const existing = invoicesMap.get(key)!;
                                                    existing.totalAmount += itemAmt;
                                                    existing.totalQuantity += itemQty;
                                                    existing.items.push({
                                                        itemName: row.ItemName || row.GroupName || 'کالای بدون نام',
                                                        itemCode: row.ItemCode || '',
                                                        groupName: row.GroupName || '',
                                                        quantity: itemQty,
                                                        amount: itemAmt,
                                                        itemNotes: row.ItemNotes || ''
                                                    });
                                                } else {
                                                    invoicesMap.set(key, {
                                                        docId: row.DocId,
                                                        invoiceNum: row.InvoiceNum || row.DocId,
                                                        date: row.Date,
                                                        customerName: customerName,
                                                        notes: row.Notes || '',
                                                        totalAmount: itemAmt,
                                                        totalQuantity: itemQty,
                                                        items: [{
                                                            itemName: row.ItemName || row.GroupName || 'کالای بدون نام',
                                                            itemCode: row.ItemCode || '',
                                                            groupName: row.GroupName || '',
                                                            quantity: itemQty,
                                                            amount: itemAmt,
                                                            itemNotes: row.ItemNotes || ''
                                                        }]
                                                    });
                                                }
                                            });
                                            
                                            const groupedList = Array.from(invoicesMap.values());
                                            
                                            if (groupedList.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={7} className="p-8 text-center text-slate-400 text-sm">{salesViewMode === 'range' ? 'هیچ فاکتور فروشی برای بازه زمانی انتخابی ثبت نشده است' : 'هیچ فاکتور فروشی برای تاریخ انتخابی ثبت نشده است'}</td>
                                                    </tr>
                                                );
                                            }
                                            
                                            return groupedList.map((inv, idx) => {
                                                const isExpanded = expandedInvoiceId === inv.invoiceNum;
                                                return (
                                                    <React.Fragment key={inv.invoiceNum}>
                                                        <tr 
                                                            onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.invoiceNum)}
                                                            className="hover:bg-slate-50 transition-colors cursor-pointer"
                                                        >
                                                            <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                            <td className="p-3 font-mono font-bold text-blue-600">{inv.invoiceNum}</td>
                                                            <td className="p-3 font-bold text-slate-800">{inv.customerName}</td>
                                                            <td className="p-3 text-center font-mono font-semibold text-slate-500">{inv.items.length} کالا</td>
                                                            <td className="p-3 text-center font-mono font-bold text-slate-600">{inv.totalQuantity.toFixed(1)}</td>
                                                            <td className="p-3 text-left font-mono font-black text-emerald-600">{formatMoney(inv.totalAmount)}</td>
                                                            <td className="p-3 text-center">
                                                                <button className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold focus:outline-none">
                                                                    <span>{isExpanded ? 'بستن' : 'مشاهده'}</span>
                                                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr className="bg-slate-50/50">
                                                                <td colSpan={7} className="p-4 bg-slate-50/30">
                                                                    <div className="border border-slate-200 rounded-lg bg-white p-3 shadow-inner">
                                                                        <div className="text-[11px] font-bold text-slate-500 mb-2 pb-1 border-b border-slate-100 flex justify-between">
                                                                            <span>جزئیات فاکتور {inv.invoiceNum}</span>
                                                                            {inv.notes && (
                                                                                <span className="text-slate-400 font-mono text-[10px]">توضیحات فاکتور: {inv.notes}</span>
                                                                            )}
                                                                        </div>
                                                                        <table className="w-full text-right text-[11px]">
                                                                            <thead>
                                                                                <tr className="text-slate-500 border-b border-slate-100">
                                                                                    <th className="py-2 px-3 font-semibold text-center w-12">#</th>
                                                                                    <th className="py-2 px-3 font-semibold">گروه کالا</th>
                                                                                    <th className="py-2 px-3 font-semibold">شرح کالا</th>
                                                                                    <th className="py-2 px-3 font-semibold text-center">مقدار/وزن</th>
                                                                                    <th className="py-2 px-3 font-semibold text-left font-mono">فی واحد (ریال)</th>
                                                                                    <th className="py-2 px-3 font-semibold text-left">مجموع مبلغ (ریال)</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-150">
                                                                                {inv.items.map((item, itemIdx) => {
                                                                                    const fee = item.quantity > 0 ? Math.round(item.amount / item.quantity) : 0;
                                                                                    return (
                                                                                        <tr key={itemIdx} className="hover:bg-slate-50/30">
                                                                                            <td className="py-2 px-3 text-center text-slate-400 font-mono">{itemIdx + 1}</td>
                                                                                            <td className="py-2 px-3 text-slate-500">{item.groupName || '-'}</td>
                                                                                            <td className="py-2 px-3 font-medium text-slate-800">
                                                                                                {item.itemName}
                                                                                                {item.itemNotes && (
                                                                                                    <span className="block text-[9px] text-slate-400 mt-0.5">{item.itemNotes}</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-600">{item.quantity.toFixed(1)}</td>
                                                                                            <td className="py-2 px-3 text-left font-mono font-bold text-slate-500">{fee > 0 ? formatMoney(fee) : '-'}</td>
                                                                                            <td className="py-2 px-3 text-left font-mono font-bold text-slate-700">{formatMoney(item.amount)}</td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Render Recharts Visual Comparison */}
                        {compareMode && chartData.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                                    <h3 className="text-xs font-black text-slate-800 mb-4 text-center">مقایسه فروش گروه کالایی از نظر مبلغ (ریال)</h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                                <YAxis tick={{ fontSize: 10 }} />
                                                <Tooltip />
                                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                                <Bar dataKey="amountA" name="بازه اول (A)" fill="#3b82f6" />
                                                <Bar dataKey="amountB" name="بازه دوم (B)" fill="#818cf8" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                                    <h3 className="text-xs font-black text-slate-800 mb-4 text-center">مقایسه حجم فروش گروه کالایی از نظر وزن (کیلوگرم)</h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                                <YAxis tick={{ fontSize: 10 }} />
                                                <Tooltip />
                                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                                <Bar dataKey="weightA" name="بازه اول (A)" fill="#10b981" />
                                                <Bar dataKey="weightB" name="بازه دوم (B)" fill="#6366f1" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Detailed Sales comparison tables */}
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <h3 className="text-sm font-bold text-slate-800">
                                    {compareMode ? 'جدول مقایسه‌ای جزئی گروه کالایی (مبلغ و وزن)' : 'جدول ریز تراکنش‌های فاکتور فروش'}
                                </h3>
                                {!compareMode && salesData.length > 500 && (
                                    <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-semibold">
                                        در حال نمایش ۵۰۰ فاکتور اخیر از مجموع {salesData.length.toLocaleString('fa-IR')} مورد جهت سرعت بالا
                                    </span>
                                )}
                            </div>
                            
                            <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[400px] overflow-y-auto">
                                {/* Desktop view */}
                                <table className="w-full text-right text-xs hidden md:table">
                                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                                        {compareMode ? (
                                            <tr>
                                                <th className="p-3 w-10 text-center">ردیف</th>
                                                <th className="p-3">{compareGroupBy === 'group' ? 'گروه کالایی' : 'نام دقیق محصول'}</th>
                                                <th className="p-3 text-center bg-blue-900/40 text-blue-100">وزن خالص A (ک‌گ)</th>
                                                <th className="p-3 text-left bg-blue-900/40 text-blue-100">فروش خالص A (ریال)</th>
                                                <th className="p-3 text-left bg-blue-900/40 text-blue-100">فی نهایی A (ریال)</th>
                                                <th className="p-3 text-center bg-indigo-900/40 text-indigo-100">وزن خالص B (ک‌گ)</th>
                                                <th className="p-3 text-left bg-indigo-900/40 text-indigo-100">فروش خالص B (ریال)</th>
                                                <th className="p-3 text-left bg-indigo-900/40 text-indigo-100">فی نهایی B (ریال)</th>
                                                <th className="p-3 text-center">تغییر وزن (%)</th>
                                                <th className="p-3 text-center">تغییر فروش (%)</th>
                                                <th className="p-3 text-center">تغییر فی (%)</th>
                                            </tr>
                                        ) : (
                                            <tr>
                                                <th className="p-3.5 font-bold text-slate-700 w-24">تاریخ فاکتور</th>
                                                <th className="p-3.5 font-bold text-slate-700 w-24">شماره فاکتور</th>
                                                <th className="p-3.5 font-bold text-slate-700 w-36">گروه کالا</th>
                                                <th className="p-3.5 font-bold text-slate-700">شرح کالای فاکتور</th>
                                                <th className="p-3.5 font-bold text-slate-700 text-left w-24">وزن خالص (ک‌گ)</th>
                                                <th className="p-3.5 font-bold text-slate-700 text-left w-24">وزن ناخالص (ک‌گ)</th>
                                                <th className="p-3.5 font-bold text-slate-700 text-left w-32">فی واحد (ریال)</th>
                                                <th className="p-3.5 font-bold text-slate-700 text-left w-36">مجموع مبلغ (ریال)</th>
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {compareMode ? (
                                            chartData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={11} className="text-center py-10 text-slate-400 font-medium">موردی یافت نشد. دوره فیلتر را تغییر دهید.</td>
                                                </tr>
                                            ) : (
                                                chartData.map((row, idx) => {
                                                    const weightDiff = row.netWeightB ? ((row.netWeightA - row.netWeightB) / row.netWeightB) * 100 : 0;
                                                    const amountDiff = row.netAmountB ? ((row.netAmountA - row.netAmountB) / row.netAmountB) * 100 : 0;
                                                    const feeA = row.finalPriceA || (row.netWeightA ? row.netAmountA / row.netWeightA : 0);
                                                    const feeB = row.finalPriceB || (row.netWeightB ? row.netAmountB / row.netWeightB : 0);
                                                    const feeDiff = feeB ? ((feeA - feeB) / feeB) * 100 : 0;

                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                            <td className="p-3 font-bold text-slate-900">{row.name}</td>
                                                            
                                                            {/* Period A */}
                                                            <td className="p-3 text-center bg-blue-50/40">
                                                                <div className="font-mono font-bold text-blue-950">{row.netWeightA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
                                                                {row.retWeightA > 0 && <div className="text-[9px] text-rose-600 font-semibold">مرجوعی: {row.retWeightA.toFixed(1)}</div>}
                                                            </td>
                                                            <td className="p-3 text-left font-mono font-bold text-blue-950 bg-blue-50/40">{formatMoney(row.netAmountA)}</td>
                                                            <td className="p-3 text-left font-mono font-bold text-emerald-800 bg-blue-50/40">{formatMoney(Math.round(feeA))}</td>

                                                            {/* Period B */}
                                                            <td className="p-3 text-center bg-indigo-50/40">
                                                                <div className="font-mono font-bold text-indigo-950">{row.netWeightB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
                                                                {row.retWeightB > 0 && <div className="text-[9px] text-rose-600 font-semibold">مرجوعی: {row.retWeightB.toFixed(1)}</div>}
                                                            </td>
                                                            <td className="p-3 text-left font-mono font-bold text-indigo-950 bg-indigo-50/40">{formatMoney(row.netAmountB)}</td>
                                                            <td className="p-3 text-left font-mono font-bold text-emerald-800 bg-indigo-50/40">{formatMoney(Math.round(feeB))}</td>

                                                            {/* Diffs */}
                                                            <td className="p-3 text-center">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${weightDiff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                                    {weightDiff >= 0 ? '+' : ''}{weightDiff.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${amountDiff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                                    {amountDiff >= 0 ? '+' : ''}{amountDiff.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${feeDiff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                                    {feeDiff >= 0 ? '+' : ''}{feeDiff.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )
                                        ) : (
                                            salesData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="text-center py-10 text-slate-400 font-medium">موردی یافت نشد. بازه را تغییر دهید.</td>
                                                </tr>
                                            ) : (
                                                salesData.slice(0, 500).map((row, idx) => {
                                                    const netW = parseNetWeight(row);
                                                    const grossW = parseGrossWeight(row);
                                                    const fee = parseFee(row, netW);
                                                    const isRet = row.OpCode === '13';
                                                    return (
                                                        <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${isRet ? 'bg-rose-50' : ''}`}>
                                                            <td className="p-3 font-medium text-slate-500 whitespace-nowrap">{formatDateToJalali(row.Date)}</td>
                                                            <td className="p-3 font-mono text-slate-600 font-semibold">{row.InvoiceNum || row.DocId}</td>
                                                            <td className="p-3 font-bold text-slate-800">{row.GroupName || 'سایر گروه‌ها'}</td>
                                                            <td className="p-3 font-semibold text-slate-900">
                                                                {isRet ? <span className="bg-rose-100 text-rose-700 px-1 py-0.5 rounded text-[9px] ml-1">مرجوعی</span> : null}
                                                                {row.ItemName || 'کالای فروخته شده'}
                                                                {row.ItemNotes && <span className="block text-[10px] text-slate-400 font-normal">{row.ItemNotes}</span>}
                                                            </td>
                                                            <td className="p-3 text-left font-mono font-medium text-slate-700">{netW.toFixed(2)}</td>
                                                            <td className="p-3 text-left font-mono font-medium text-slate-500">{grossW > 0 ? grossW.toFixed(2) : '-'}</td>
                                                            <td className="p-3 text-left font-mono font-bold text-emerald-700">{fee > 0 ? formatMoney(fee) : '-'}</td>
                                                            <td className="p-3 text-left font-mono font-black text-blue-700">{formatMoney(parseFloat(row.Amount || 0))}</td>
                                                        </tr>
                                                    );
                                                })
                                            )
                                        )}
                                    </tbody>
                                    {compareMode && chartData.length > 0 && (
                                        <tfoot>
                                            <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-700 text-xs">
                                                <td colSpan={2} className="p-3 text-right">جمع کل کارخانه:</td>
                                                {(() => {
                                                    let sumNetWA = 0, sumNetWB = 0, sumNetAmtA = 0, sumNetAmtB = 0;
                                                    chartData.forEach(r => {
                                                        sumNetWA += r.netWeightA || 0;
                                                        sumNetWB += r.netWeightB || 0;
                                                        sumNetAmtA += r.netAmountA || 0;
                                                        sumNetAmtB += r.netAmountB || 0;
                                                    });
                                                    const totWeightDiff = sumNetWB ? ((sumNetWA - sumNetWB) / sumNetWB) * 100 : 0;
                                                    const totAmountDiff = sumNetAmtB ? ((sumNetAmtA - sumNetAmtB) / sumNetAmtB) * 100 : 0;
                                                    const avgFeeA = sumNetWA ? (sumNetAmtA / sumNetWA) : 0;
                                                    const avgFeeB = sumNetWB ? (sumNetAmtB / sumNetWB) : 0;
                                                    const totFeeDiff = avgFeeB ? ((avgFeeA - avgFeeB) / avgFeeB) * 100 : 0;

                                                    return (
                                                        <>
                                                            <td className="p-3 text-center font-mono text-blue-300">{sumNetWA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                                            <td className="p-3 text-left font-mono text-blue-300">{formatMoney(sumNetAmtA)}</td>
                                                            <td className="p-3 text-left font-mono text-emerald-400">{formatMoney(Math.round(avgFeeA))}</td>
                                                            <td className="p-3 text-center font-mono text-indigo-300">{sumNetWB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                                            <td className="p-3 text-left font-mono text-indigo-300">{formatMoney(sumNetAmtB)}</td>
                                                            <td className="p-3 text-left font-mono text-emerald-400">{formatMoney(Math.round(avgFeeB))}</td>
                                                            <td className="p-3 text-center font-mono">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${totWeightDiff >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                                                    {totWeightDiff >= 0 ? '+' : ''}{totWeightDiff.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-center font-mono">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${totAmountDiff >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                                                    {totAmountDiff >= 0 ? '+' : ''}{totAmountDiff.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-center font-mono">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${totFeeDiff >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                                                    {totFeeDiff >= 0 ? '+' : ''}{totFeeDiff.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                        </>
                                                    );
                                                })()}
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>

                                {/* Mobile view */}
                                <div className="block md:hidden divide-y divide-slate-100 bg-white">
                                    {compareMode ? (
                                        chartData.length === 0 ? (
                                            <div className="text-center py-10 text-slate-400 font-medium">موردی یافت نشد. دوره فیلتر را تغییر دهید.</div>
                                        ) : (
                                            <>
                                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2 justify-between items-center">
                                                <h4 className="text-sm font-bold text-slate-800">گزارش مقایسه ای فروش (A نسبت به B)</h4>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const printWindow = window.open('', '_blank');
                                                            if (!printWindow) return;
                                                            let html = '<html dir="rtl"><head><title>چاپ مقایسه فروش</title><style>body{font-family:Tahoma,sans-serif;margin:20px;direction:rtl}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}th,td{border:1px solid #ccc;padding:8px;text-align:right}th{background:#f1f5f9}.diff{direction:ltr;display:inline-block}.ret{color:#e11d48;font-size:10px}</style></head><body>';
                                                            html += '<h2>گزارش مقایسه ای فروش</h2>';
                                                            html += '<table><thead><tr><th>گروه کالا</th><th>خالص A (kg)</th><th>مبلغ A (ریال)</th><th>خالص B (kg)</th><th>مبلغ B (ریال)</th><th>رشد مبلغ</th></tr></thead><tbody>';
                                                            let sumA = 0, sumB = 0;
                                                            chartData.forEach(row => {
                                                                sumA += row.netAmountA || 0;
                                                                sumB += row.netAmountB || 0;
                                                                const diff = row.netAmountB ? ((row.netAmountA - row.netAmountB) / row.netAmountB) * 100 : 0;
                                                                html += `<tr>
                                                                    <td><strong>${row.name}</strong></td>
                                                                    <td>${(row.netWeightA || 0).toFixed(2)}<br><span class="ret">مرجوعی: ${(row.retWeightA || 0).toFixed(2)}</span></td>
     <td>${(row.netWeightA ? (row.netAmountA / row.netWeightA) : 0).toLocaleString('fa-IR', {maximumFractionDigits:0})}</td>
     <td>${(row.netAmountA || 0).toLocaleString('fa-IR')}<br><span class="ret">مرجوعی: ${(row.retAmountA || 0).toLocaleString('fa-IR')}</span></td>
     <td>${(row.netWeightB || 0).toFixed(2)}<br><span class="ret">مرجوعی: ${(row.retWeightB || 0).toFixed(2)}</span></td>
     <td>${(row.netWeightB ? (row.netAmountB / row.netWeightB) : 0).toLocaleString('fa-IR', {maximumFractionDigits:0})}</td>
     <td>${(row.netAmountB || 0).toLocaleString('fa-IR')}<br><span class="ret">مرجوعی: ${(row.retAmountB || 0).toLocaleString('fa-IR')}</span></td>
                                                                    <td class="diff" style="color: ${diff>=0?'#16a34a':'#dc2626'}">${diff>0?'+':''}${diff.toFixed(1)}%</td>
                                                                </tr>`;
                                                            });
                                                            const totDiff = sumB ? ((sumA - sumB) / sumB) * 100 : 0;
                                                            html += `<tr>
                                                                <th>جمع کل</th>
     <th>-</th>
     <th>-</th>
     <th>${sumA.toLocaleString('fa-IR')}</th>
     <th>-</th>
     <th>-</th>
     <th>${sumB.toLocaleString('fa-IR')}</th>
                                                                <th class="diff" style="color: ${totDiff>=0?'#16a34a':'#dc2626'}">${totDiff>0?'+':''}${totDiff.toFixed(1)}%</th>
                                                            </tr>`;
                                                            html += '</tbody></table></body></html>';
                                                            printWindow.document.write(html);
                                                            printWindow.document.close();
                                                            printWindow.focus();
                                                            setTimeout(() => { printWindow.print(); }, 500);
                                                        }}
                                                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                        چاپ (Print)
                                                    </button>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const res = await fetch(getEffectiveApiUrl('/api/sayan/sales-report/send-compare'), {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ chartData, dateFromA: dateFrom, dateToA: dateTo, dateFromB: salesDateFromB, dateToB: salesDateToB })
                                                            });
                                                            const data = await res.json();
                                                            if (res.ok && data.success) {
                                                                alert(`✅ ${data.message}`);
                                                            } else {
                                                                alert(`❌ خطا در ارسال: ${data.error || 'ناشناخته'}`);
                                                            }
                                                        } catch (err) {
                                                            alert('❌ خطای ارتباط با سرور');
                                                        }
                                                    }}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                    ارسال دستی به ربات
                                                </button>
                                                </div>
                                            </div>
                                            {chartData.map((row, idx) => {
                                                const weightDiff = row.netWeightB ? ((row.netWeightA - row.netWeightB) / row.netWeightB) * 100 : 0;
                                                const amountDiff = row.netAmountB ? ((row.netAmountA - row.netAmountB) / row.netAmountB) * 100 : 0;
                                                const avgFeeA = row.netWeightA ? (row.netAmountA / row.netWeightA) : 0;
                                                const avgFeeB = row.netWeightB ? (row.netAmountB / row.netWeightB) : 0;
                                                return (
                                                    <div key={idx} className="p-4 space-y-3 border-b border-slate-100 last:border-0">
                                                        <h4 className="text-sm font-black text-slate-900">{row.name}</h4>
                                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                                            <div className="bg-slate-50 p-2.5 rounded-xl space-y-1">
                                                                <span className="text-[10px] text-slate-400 font-medium block">مقایسه وزن خالص (kg)</span>
                                                                <div className="flex flex-col text-[10px] font-mono font-semibold text-slate-700 leading-relaxed space-y-0.5">
                                                                    <div className="flex justify-between items-center bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-100">
                                                                        <span>A: {row.netWeightA.toFixed(1)}</span>
                                                                        <span className="text-[8px] text-rose-500 font-sans font-bold" title="مرجوعی A">م {row.retWeightA.toFixed(1)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-100">
                                                                        <span>B: {row.netWeightB.toFixed(1)}</span>
                                                                        <span className="text-[8px] text-rose-500 font-sans font-bold" title="مرجوعی B">م {row.retWeightB.toFixed(1)}</span>
                                                                    </div>
                                                                </div>
                                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold ${weightDiff >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                                                    {weightDiff >= 0 ? '+' : ''}{weightDiff.toFixed(1)}% تغییر خالص
                                                                </span>
                                                            </div>
                                                            <div className="bg-slate-50 p-2.5 rounded-xl space-y-1">
                                                                <span className="text-[10px] text-slate-400 font-medium block">مقایسه مبلغ خالص و میانگین فی (ریال)</span>
                                                                <div className="flex flex-col text-[10px] font-mono font-semibold text-slate-700 leading-relaxed space-y-0.5">
                                                                    <div className="flex justify-between items-center bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-100">
                                                                        <span className="flex flex-col">
                                                                            <span>A: {formatMoney(row.netAmountA)}</span>
                                                                            <span className="text-[8px] text-indigo-500 font-sans font-bold">میانگین فی: {formatMoney(avgFeeA)}</span>
                                                                        </span>
                                                                        <span className="text-[8px] text-rose-500 font-sans font-bold flex flex-col items-end" title="مرجوعی A">
                                                                            <span>مبلغ: م {formatMoney(row.retAmountA)}</span>
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-100">
                                                                        <span className="flex flex-col">
                                                                            <span>B: {formatMoney(row.netAmountB)}</span>
                                                                            <span className="text-[8px] text-indigo-500 font-sans font-bold">میانگین فی: {formatMoney(avgFeeB)}</span>
                                                                        </span>
                                                                        <span className="text-[8px] text-rose-500 font-sans font-bold flex flex-col items-end" title="مرجوعی B">
                                                                            <span>مبلغ: م {formatMoney(row.retAmountB)}</span>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold ${amountDiff >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                                                    {amountDiff >= 0 ? '+' : ''}{amountDiff.toFixed(1)}% تغییر مبلغ خالص
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            </>
                                        )
                                    ) : (
                                        salesData.length === 0 ? (
                                            <div className="text-center py-10 text-slate-400 font-medium">موردی یافت نشد. بازه را تغییر دهید.</div>
                                        ) : (
                                            salesData.slice(0, 500).map((row, idx) => {
                                                const netW = parseNetWeight(row);
                                                const grossW = parseGrossWeight(row);
                                                const fee = parseFee(row, netW);
                                                const isRet = row.OpCode === '13';
                                                return (
                                                    <div key={idx} className={`p-4 space-y-2 text-xs ${isRet ? 'bg-rose-50' : ''}`}>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] text-slate-400 font-bold font-mono">فاکتور: {row.InvoiceNum || row.DocId} | {formatDateToJalali(row.Date)}</span>
                                                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[9px] font-extrabold">{row.GroupName || 'سایر'}</span>
                                                        </div>
                                                        <h4 className="text-sm font-bold text-slate-800 leading-relaxed">
                                                            {isRet ? <span className="bg-rose-100 text-rose-700 px-1 py-0.5 rounded text-[9px] ml-1">مرجوعی</span> : null}
                                                            {row.ItemName || 'کالای فروخته شده'}
                                                            {row.ItemNotes && <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{row.ItemNotes}</span>}
                                                        </h4>
                                                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg font-mono">
                                                            <div>
                                                                <span className="text-[9px] text-slate-400 font-sans block">وزن خالص</span>
                                                                <span className="font-bold text-slate-700 text-xs">{netW.toFixed(2)} kg</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[9px] text-slate-400 font-sans block">وزن ناخالص</span>
                                                                <span className="font-bold text-slate-600 text-xs">{grossW > 0 ? `${grossW.toFixed(2)} kg` : '-'}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[9px] text-slate-400 font-sans block">فی واحد</span>
                                                                <span className="font-bold text-emerald-700 text-xs">{fee > 0 ? formatMoney(fee) : '-'} ریال</span>
                                                            </div>
                                                            <div className="text-left">
                                                                <span className="text-[9px] text-slate-400 font-sans block">مبلغ کل</span>
                                                                <span className="font-black text-blue-700 text-xs">{formatMoney(parseFloat(row.Amount || 0))} ریال</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. PRODUCTION TAB */}
                {activeTab === 'production' && (
                    <div className="p-2 sm:p-6 space-y-3 sm:space-y-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-200 pb-4 gap-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <Layers className="h-6 w-6 text-blue-600" />
                                    گزارش آمار کل تولید و ضایعات (سایان ERP)
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    دریافت آنلاین و زنده اسناد ۶۱ (POY)، ۶۷ (DTY)، ۷۹ (کش)، و ۷۳ (اسپاندکس) از سایان + ثبت دستی ضایعات
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => setProdCompareMode(!prodCompareMode)}
                                    className={`font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all ${prodCompareMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                                >
                                    <TrendingUp className="h-4 w-4" />
                                    {prodCompareMode ? 'غیرفعال‌سازی مقایسه' : 'مقایسه دوره‌ای تولید'}
                                </button>

                                <button
                                    onClick={fetchProduction}
                                    disabled={isLoading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                                >
                                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                    دریافت زنده از سایان
                                </button>

                                {!prodCompareMode && (
                                    <button
                                        onClick={handleSaveWaste}
                                        disabled={isSavingWaste}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                                    >
                                        <Save className="h-4 w-4" />
                                        ذخیره مقادیر ضایعات
                                    </button>
                                )}

                                <button
                                    onClick={prodCompareMode ? handlePrintComparativeProduction : () => window.print()}
                                    className="bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                                >
                                    <Printer className="h-4 w-4" />
                                    {prodCompareMode ? 'چاپ مقایسه‌ای' : 'چاپ / PDF'}
                                </button>

                                {!prodCompareMode && (
                                    <button
                                        onClick={handleExportExcel}
                                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                                    >
                                        <Download className="h-4 w-4" />
                                        خروجی اکسل
                                    </button>
                                )}

                                <button
                                    onClick={prodCompareMode ? handleSendComparativeProductionBot : handleSendBotReport}
                                    disabled={prodCompareMode ? isSendingProdCompareBot : isSendingBot}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                                >
                                    <Send className="h-4 w-4" />
                                    {prodCompareMode 
                                        ? (isSendingProdCompareBot ? 'در حال ارسال...' : 'ارسال مقایسه به بات')
                                        : (isSendingBot ? 'در حال ارسال...' : 'ارسال به گروه‌های تلگرام / بله')
                                    }
                                </button>
                            </div>
                        </div>

                        {/* Top Filters & Stats */}
                        {prodCompareMode ? (
                            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-center">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-indigo-900 block">بازه اول (A):</label>
                                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-900 shadow-sm">
                                            <span>از: {dateFrom || '---'}</span>
                                            <span>تا: {dateTo || '---'}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 block">(تنظیم شده در نوار بالای صفحه)</span>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-indigo-900 block">بازه دوم (B):</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                placeholder="از تاریخ (مثال: 1402/01/01)"
                                                value={prodCompareDateFromB}
                                                onChange={(e) => setProdCompareDateFromB(e.target.value)}
                                                className="bg-white px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-950 shadow-sm focus:ring-1 focus:ring-indigo-500 outline-none w-full text-center"
                                            />
                                            <span className="text-xs text-slate-400 font-bold">تا</span>
                                            <input
                                                type="text"
                                                placeholder="تا تاریخ"
                                                value={prodCompareDateToB}
                                                onChange={(e) => setProdCompareDateToB(e.target.value)}
                                                className="bg-white px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-950 shadow-sm focus:ring-1 focus:ring-indigo-500 outline-none w-full text-center"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-bold text-slate-600">میانبرهای بازه مقایسه‌ای:</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => applyProdQuickComparePreset('prev_year')}
                                                className="bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 rounded text-[11px] px-2.5 py-1 font-bold transition-all shadow-xs cursor-pointer w-full text-center"
                                            >
                                                همسان سال قبل (پارسال)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => applyProdQuickComparePreset('prev_season')}
                                                className="bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 rounded text-[11px] px-2.5 py-1 font-bold transition-all shadow-xs cursor-pointer w-full text-center"
                                            >
                                                فصل قبل
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between border-t border-indigo-100 pt-3 gap-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-indigo-900">نوع دسته‌بندی گزارش:</span>
                                        <div className="flex bg-slate-200 p-0.5 rounded-lg border border-slate-300">
                                            <button
                                                onClick={() => setProdCompareGroupBy('group')}
                                                className={`text-[11px] font-bold px-3 py-1 rounded-md transition-all ${prodCompareGroupBy === 'group' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                            >
                                                گروه کالا
                                            </button>
                                            <button
                                                onClick={() => setProdCompareGroupBy('item')}
                                                className={`text-[11px] font-bold px-3 py-1 rounded-md transition-all ${prodCompareGroupBy === 'item' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                            >
                                                نام دقیق کالا
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs font-bold">
                                        <div className="bg-blue-50 text-blue-900 px-3 py-1.5 rounded-lg border border-blue-200">
                                            تولید بازه اول (A): {prodCompareTotalsA.grandTotal.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
                                        </div>
                                        <div className="bg-indigo-50 text-indigo-900 px-3 py-1.5 rounded-lg border border-indigo-200">
                                            تولید بازه دوم (B): {prodCompareTotalsB.grandTotal.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
                                        </div>
                                        {prodCompareTotalsB.grandTotal > 0 && (
                                            <div className={`px-3 py-1.5 rounded-lg border ${((prodCompareTotalsA.grandTotal - prodCompareTotalsB.grandTotal) >= 0) ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'}`}>
                                                درصد تغییر: {(((prodCompareTotalsA.grandTotal - prodCompareTotalsB.grandTotal) / prodCompareTotalsB.grandTotal) * 100).toFixed(1)}%
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-xs font-bold text-slate-700">ملاک تاریخ گزارش:</span>
                                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-900">
                                        <span>از: {dateFrom || '---'}</span>
                                        <span>تا: {dateTo || '---'}</span>
                                    </div>
                                    <span className="text-[11px] text-slate-500">(می‌توانید تاریخ را در نوار بالای صفحه تغییر داده و دکمه دریافت زنده را بزنید)</span>
                                </div>

                                <div className="flex items-center gap-4 text-xs font-bold">
                                    <div className="bg-blue-50 text-blue-900 px-3 py-1.5 rounded-lg border border-blue-200">
                                        تولید کل: {prodLiveTotals.grandTotal.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg
                                    </div>
                                    <div className="bg-rose-50 text-rose-900 px-3 py-1.5 rounded-lg border border-rose-200">
                                        ضایعات کل: {prodWaste.totalWaste.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg ({prodWaste.totalPct.toFixed(2)}%)
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Main Production & Waste Table matching user screenshot format */}
                        {prodCompareMode ? (
                            <div className="border border-indigo-200 rounded-xl overflow-hidden shadow-sm bg-white mb-6">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-center text-xs sm:text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-indigo-900 text-white font-extrabold border-b border-indigo-950 text-xs">
                                                <th className="p-3 border-r border-indigo-950 text-right min-w-[200px]">نام کالا / گروه کالا</th>
                                                <th className="p-3 border-r border-indigo-950 w-44">بازه اول (A) (kg)</th>
                                                <th className="p-3 border-r border-indigo-950 w-44">بازه دوم (B) (kg)</th>
                                                <th className="p-3 border-r border-indigo-950 w-44">تفاضل (A - B) (kg)</th>
                                                <th className="p-3 w-44">درصد تغییر</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 text-slate-800 font-medium text-xs">
                                            {isLoading ? (
                                                <tr>
                                                    <td colSpan={5} className="py-12 text-center text-slate-500">
                                                        <div className="flex flex-col items-center justify-center gap-2">
                                                            <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
                                                            <span>در حال دریافت اطلاعات زنده و محاسبه مقایسه‌ای...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : getProdComparisonData().length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                                        داده‌ای برای دوره‌های انتخاب شده جهت مقایسه یافت نشد.
                                                    </td>
                                                </tr>
                                            ) : (
                                                <>
                                                    {getProdComparisonData().map((row, idx) => {
                                                        const diff = (row.totalA || 0) - (row.totalB || 0);
                                                        const diffPct = row.totalB ? (diff / row.totalB) * 100 : 0;
                                                        const pctText = row.totalB ? `${diff > 0 ? '+' : ''}${diffPct.toFixed(1)}%` : '-';
                                                        const pctColor = diff > 0 ? 'text-emerald-700 font-extrabold' : (diff < 0 ? 'text-rose-700 font-extrabold' : 'text-slate-600');

                                                        return (
                                                            <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50/20 transition-colors`}>
                                                                <td className="p-3 border-r border-slate-200 text-right font-bold text-slate-900 pr-4">{row.name}</td>
                                                                <td className="p-3 border-r border-slate-200 font-mono">{(row.totalA || 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                                                <td className="p-3 border-r border-slate-200 font-mono">{(row.totalB || 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                                                <td className={`p-3 border-r border-slate-200 font-mono font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                    {diff.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                                                </td>
                                                                <td className={`p-3 font-mono font-bold ${pctColor}`}>{pctText}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    
                                                    {/* Total Row */}
                                                    <tr className="bg-slate-200 text-slate-900 font-extrabold text-xs border-t-2 border-slate-400">
                                                        <td className="p-3 text-right pr-4 font-black">جمع کل تولید مقایسه‌ای</td>
                                                        <td className="p-3 font-mono font-black">
                                                            {getProdComparisonData().reduce((sum, r) => sum + (r.totalA || 0), 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                                        </td>
                                                        <td className="p-3 font-mono font-black">
                                                            {getProdComparisonData().reduce((sum, r) => sum + (r.totalB || 0), 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                                        </td>
                                                        {(() => {
                                                            const totalA = getProdComparisonData().reduce((sum, r) => sum + (r.totalA || 0), 0);
                                                            const totalB = getProdComparisonData().reduce((sum, r) => sum + (r.totalB || 0), 0);
                                                            const diff = totalA - totalB;
                                                            const diffPct = totalB ? (diff / totalB) * 100 : 0;
                                                            return (
                                                                <>
                                                                    <td className={`p-3 font-mono font-black ${diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                                        {diff.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                                                    </td>
                                                                    <td className={`p-3 font-mono font-black ${diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                                        {totalB ? `${diff > 0 ? '+' : ''}${diffPct.toFixed(1)}%` : '-'}
                                                                    </td>
                                                                </>
                                                            );
                                                        })()}
                                                    </tr>
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm bg-white">
                            {/* Desktop View */}
                            <div className="overflow-x-auto hidden md:block">
                                <table className="w-full text-center text-xs sm:text-sm border-collapse">
                                    <thead>
                                        {/* Row 1: Header Categories */}
                                        <tr className="bg-slate-200 text-slate-900 font-extrabold border-b border-slate-300">
                                            <th colSpan={2} className="p-2.5 border-r border-slate-300 bg-slate-300">کالاها</th>
                                            <th colSpan={6} className="p-2.5 bg-blue-100 text-blue-950">عملیات (اسناد تولید زنده سایان)</th>
                                        </tr>
                                        {/* Row 2: Sub Columns */}
                                        <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-xs">
                                            <th className="p-2.5 border-r border-slate-300 w-20">واحد</th>
                                            <th className="p-2.5 border-r border-slate-300 text-right min-w-[200px]">کالا</th>
                                            <th className="p-2.5 border-r border-slate-300 w-32">61 کارت POY</th>
                                            <th className="p-2.5 border-r border-slate-300 w-32">67 کارت DTY</th>
                                            <th className="p-2.5 border-r border-slate-300 w-32">79 کارت کش</th>
                                            <th className="p-2.5 border-r border-slate-300 w-32">73 کارت اسپاندکس</th>
                                            <th className="p-2.5 border-r border-slate-300 w-32 bg-amber-50 text-amber-900">70 کارت شوایتر</th>
                                            <th className="p-2.5 bg-slate-200 font-black w-32">جمع</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={8} className="py-12 text-center text-slate-500">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                         <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                                                         <span>در حال دریافت اطلاعات زنده از دیتابیس سایان...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : prodLiveItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                                                    هیچ سند تولیدی در تاریخ {dateFrom} یافت نشد. جهت استعلام دکمه دریافت زنده از سایان را بفشارید.
                                                </td>
                                            </tr>
                                        ) : (
                                            prodLiveItems.map((item: any, idx: number) => (
                                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                                    <td className="p-2.5 border-r border-slate-200 text-slate-500 font-sans">{item.unit || 'کیلوگرم'}</td>
                                                    <td className="p-2.5 border-r border-slate-200 text-right font-bold text-slate-900">{item.name}</td>
                                                    <td className="p-2.5 border-r border-slate-200 font-mono">{item.qty_61 > 0 ? item.qty_61.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                                    <td className="p-2.5 border-r border-slate-200 font-mono">{item.qty_67 > 0 ? item.qty_67.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                                    <td className="p-2.5 border-r border-slate-200 font-mono">{item.qty_79 > 0 ? item.qty_79.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                                    <td className="p-2.5 border-r border-slate-200 font-mono">{item.qty_73 > 0 ? item.qty_73.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                                    <td className="p-2.5 border-r border-slate-200 font-mono bg-amber-50/40 font-bold text-amber-950">{item.qty_schweiter > 0 ? item.qty_schweiter.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                                    <td className="p-2.5 font-mono font-bold bg-slate-100 text-slate-900">{item.total > 0 ? item.total.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>

                                    <tfoot>
                                        {/* Summary Row */}
                                        <tr className="bg-slate-200 text-slate-900 font-black border-t-2 border-slate-400">
                                            <td colSpan={2} className="p-3 text-right pr-4 text-sm bg-slate-300">جمع تولید</td>
                                            <td className="p-3 font-mono border-r border-slate-300">{prodLiveTotals.qty_61 ? prodLiveTotals.qty_61.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                            <td className="p-3 font-mono border-r border-slate-300">{prodLiveTotals.qty_67 ? prodLiveTotals.qty_67.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                            <td className="p-3 font-mono border-r border-slate-300">{prodLiveTotals.qty_79 ? prodLiveTotals.qty_79.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                            <td className="p-3 font-mono border-r border-slate-300">{prodLiveTotals.qty_73 ? prodLiveTotals.qty_73.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                            <td className="p-3 font-mono border-r border-slate-300 bg-amber-200/60 font-bold text-amber-950">{prodLiveTotals.qty_schweiter ? prodLiveTotals.qty_schweiter.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                            <td className="p-3 font-mono text-base bg-slate-300 text-blue-950">{prodLiveTotals.grandTotal ? prodLiveTotals.grandTotal.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                        </tr>

                                        {/* Waste Manual Input Row */}
                                        <tr className="bg-rose-50 text-rose-900 font-bold border-t border-rose-200">
                                            <td colSpan={2} className="p-3 text-right pr-4 text-xs font-black text-rose-800 bg-rose-100">
                                                ضایعات (کیلوگرم) - ورود دستی:
                                            </td>
                                            <td className="p-2 border-r border-rose-200">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    className="w-full text-center bg-white border border-rose-300 rounded p-1 font-mono text-xs font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                                    value={prodWaste.waste_61 || ''}
                                                    onChange={(e) => handleWasteChange('waste_61', e.target.value)}
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="p-2 border-r border-rose-200">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    className="w-full text-center bg-white border border-rose-300 rounded p-1 font-mono text-xs font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                                    value={prodWaste.waste_67 || ''}
                                                    onChange={(e) => handleWasteChange('waste_67', e.target.value)}
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="p-2 border-r border-rose-200">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    className="w-full text-center bg-white border border-rose-300 rounded p-1 font-mono text-xs font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                                    value={prodWaste.waste_79 || ''}
                                                    onChange={(e) => handleWasteChange('waste_79', e.target.value)}
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="p-2 border-r border-rose-200">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    className="w-full text-center bg-white border border-rose-300 rounded p-1 font-mono text-xs font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                                    value={prodWaste.waste_73 || ''}
                                                    onChange={(e) => handleWasteChange('waste_73', e.target.value)}
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="p-2 border-r border-rose-200">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    className="w-full text-center bg-white border border-rose-300 rounded p-1 font-mono text-xs font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                                    value={prodWaste.waste_schweiter || ''}
                                                    onChange={(e) => handleWasteChange('waste_schweiter', e.target.value)}
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="p-3 font-mono font-black text-sm bg-rose-200 text-rose-950">
                                                {prodWaste.totalWaste ? prodWaste.totalWaste.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '0'}
                                            </td>
                                        </tr>

                                        {/* Waste Percentage Row */}
                                        <tr className="bg-amber-50 text-amber-900 font-bold border-t border-amber-200">
                                            <td colSpan={2} className="p-3 text-right pr-4 text-xs font-black text-amber-800 bg-amber-100">
                                                درصد ضایعات:
                                            </td>
                                            <td className="p-2.5 font-mono border-r border-amber-200">{prodWaste.pct_61 ? prodWaste.pct_61.toFixed(2) : '0.00'}%</td>
                                            <td className="p-2.5 font-mono border-r border-amber-200">{prodWaste.pct_67 ? prodWaste.pct_67.toFixed(2) : '0.00'}%</td>
                                            <td className="p-2.5 font-mono border-r border-amber-200">{prodWaste.pct_79 ? prodWaste.pct_79.toFixed(2) : '0.00'}%</td>
                                            <td className="p-2.5 font-mono border-r border-amber-200">{prodWaste.pct_73 ? prodWaste.pct_73.toFixed(2) : '0.00'}%</td>
                                            <td className="p-2.5 font-mono border-r border-amber-200 bg-amber-100">{prodWaste.pct_schweiter ? prodWaste.pct_schweiter.toFixed(2) : '0.00'}%</td>
                                            <td className="p-2.5 font-mono font-black bg-amber-200 text-amber-950">{prodWaste.totalPct ? prodWaste.totalPct.toFixed(2) : '0.00'}%</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Mobile View */}
                            <div className="block md:hidden divide-y divide-slate-100 bg-white">
                                {isLoading ? (
                                    <div className="py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                                            <span>در حال دریافت اطلاعات زنده از دیتابیس سایان...</span>
                                        </div>
                                    </div>
                                ) : prodLiveItems.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400 font-medium">
                                        هیچ سند تولیدی در تاریخ {dateFrom} یافت نشد. جهت استعلام دکمه دریافت زنده از سایان را بفشارید.
                                    </div>
                                ) : (
                                    <div className="p-3.5 space-y-4">
                                        {prodLiveItems.map((item: any, idx: number) => (
                                            <div key={idx} className="bg-slate-50/50 rounded-xl border border-slate-100 p-3 space-y-2.5">
                                                <div className="flex justify-between items-center border-b border-slate-200/50 pb-1.5">
                                                    <span className="font-extrabold text-slate-900 text-xs">{item.name}</span>
                                                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">{item.unit || 'کیلوگرم'}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-slate-400 block text-[9px]">کارت POY (61)</span>
                                                        <span className="font-mono font-bold text-slate-700">{item.qty_61 > 0 ? item.qty_61.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</span>
                                                    </div>
                                                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-slate-400 block text-[9px]">کارت DTY (67)</span>
                                                        <span className="font-mono font-bold text-slate-700">{item.qty_67 > 0 ? item.qty_67.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</span>
                                                    </div>
                                                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-slate-400 block text-[9px]">کارت کش (79)</span>
                                                        <span className="font-mono font-bold text-slate-700">{item.qty_79 > 0 ? item.qty_79.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</span>
                                                    </div>
                                                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-slate-400 block text-[9px]">اسپاندکس (73)</span>
                                                        <span className="font-mono font-bold text-slate-700">{item.qty_73 > 0 ? item.qty_73.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</span>
                                                    </div>
                                                    <div className="bg-amber-50/60 p-2 rounded-lg border border-amber-200 col-span-2">
                                                        <span className="text-amber-800 block text-[9px] font-bold">کارت شوایتر (70)</span>
                                                        <span className="font-mono font-bold text-amber-950">{item.qty_schweiter > 0 ? item.qty_schweiter.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 flex justify-between items-center text-[11px]">
                                                    <span className="font-bold text-blue-900">مجموع تولید کالا</span>
                                                    <span className="font-mono font-black text-blue-700">{item.total > 0 ? item.total.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</span>
                                                </div>
                                            </div>
                                        ))}
                                        
                                        {/* Mobile Totals / Manual Inputs */}
                                        <div className="bg-blue-950 text-white rounded-xl p-4 space-y-3.5 shadow-md">
                                            <div className="text-xs font-extrabold border-b border-white/20 pb-2">خلاصه کل تولید و ضایعات روزانه</div>
                                            
                                            <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                                                <div className="bg-white/10 p-2 rounded-lg border border-white/10">
                                                    <span className="text-slate-300 block text-[9px]">جمع کارت POY (61)</span>
                                                    <span className="font-mono font-bold text-white block mt-0.5">{prodLiveTotals.qty_61 ? prodLiveTotals.qty_61.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</span>
                                                    <div className="mt-2 text-[9px] text-rose-300 font-bold">ضایعات:</div>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        className="w-full text-center bg-white text-slate-900 rounded p-1 font-mono text-[10px] font-bold mt-1"
                                                        value={prodWaste.waste_61 || ''}
                                                        onChange={(e) => handleWasteChange('waste_61', e.target.value)}
                                                        placeholder="0"
                                                    />
                                                    <span className="text-[9px] text-amber-300 block mt-1">خطا: {prodWaste.pct_61 ? prodWaste.pct_61.toFixed(2) : '0.00'}%</span>
                                                </div>
                                                <div className="bg-white/10 p-2 rounded-lg border border-white/10">
                                                    <span className="text-slate-300 block text-[9px]">جمع کارت DTY (67)</span>
                                                    <span className="font-mono font-bold text-white block mt-0.5">{prodLiveTotals.qty_67 ? prodLiveTotals.qty_67.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</span>
                                                    <div className="mt-2 text-[9px] text-rose-300 font-bold">ضایعات:</div>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        className="w-full text-center bg-white text-slate-900 rounded p-1 font-mono text-[10px] font-bold mt-1"
                                                        value={prodWaste.waste_67 || ''}
                                                        onChange={(e) => handleWasteChange('waste_67', e.target.value)}
                                                        placeholder="0"
                                                    />
                                                    <span className="text-[9px] text-amber-300 block mt-1">خطا: {prodWaste.pct_67 ? prodWaste.pct_67.toFixed(2) : '0.00'}%</span>
                                                </div>
                                                <div className="bg-white/10 p-2 rounded-lg border border-white/10">
                                                    <span className="text-slate-300 block text-[9px]">جمع کارت کش (79)</span>
                                                    <span className="font-mono font-bold text-white block mt-0.5">{prodLiveTotals.qty_79 ? prodLiveTotals.qty_79.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</span>
                                                    <div className="mt-2 text-[9px] text-rose-300 font-bold">ضایعات:</div>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        className="w-full text-center bg-white text-slate-900 rounded p-1 font-mono text-[10px] font-bold mt-1"
                                                        value={prodWaste.waste_79 || ''}
                                                        onChange={(e) => handleWasteChange('waste_79', e.target.value)}
                                                        placeholder="0"
                                                    />
                                                    <span className="text-[9px] text-amber-300 block mt-1">خطا: {prodWaste.pct_79 ? prodWaste.pct_79.toFixed(2) : '0.00'}%</span>
                                                </div>
                                                <div className="bg-white/10 p-2 rounded-lg border border-white/10">
                                                    <span className="text-slate-300 block text-[9px]">جمع اسپاندکس (73)</span>
                                                    <span className="font-mono font-bold text-white block mt-0.5">{prodLiveTotals.qty_73 ? prodLiveTotals.qty_73.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</span>
                                                    <div className="mt-2 text-[9px] text-rose-300 font-bold">ضایعات:</div>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        className="w-full text-center bg-white text-slate-900 rounded p-1 font-mono text-[10px] font-bold mt-1"
                                                        value={prodWaste.waste_73 || ''}
                                                        onChange={(e) => handleWasteChange('waste_73', e.target.value)}
                                                        placeholder="0"
                                                    />
                                                    <span className="text-[9px] text-amber-300 block mt-1">خطا: {prodWaste.pct_73 ? prodWaste.pct_73.toFixed(2) : '0.00'}%</span>
                                                </div>
                                                <div className="bg-amber-950/40 p-2 rounded-lg border border-amber-500/30 col-span-2">
                                                    <span className="text-amber-300 block text-[9px] font-bold">جمع کارت شوایتر (70)</span>
                                                    <span className="font-mono font-bold text-white block mt-0.5">{prodLiveTotals.qty_schweiter ? prodLiveTotals.qty_schweiter.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</span>
                                                    <div className="mt-2 text-[9px] text-rose-300 font-bold">ضایعات شوایتر:</div>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        className="w-full text-center bg-white text-slate-900 rounded p-1 font-mono text-[10px] font-bold mt-1"
                                                        value={prodWaste.waste_schweiter || ''}
                                                        onChange={(e) => handleWasteChange('waste_schweiter', e.target.value)}
                                                        placeholder="0"
                                                    />
                                                    <span className="text-[9px] text-amber-300 block mt-1">خطا: {prodWaste.pct_schweiter ? prodWaste.pct_schweiter.toFixed(2) : '0.00'}%</span>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-white/10 p-3 rounded-xl space-y-2 border border-white/10">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-300">مجموع تولید زنده</span>
                                                    <span className="font-mono font-black">{prodLiveTotals.grandTotal ? prodLiveTotals.grandTotal.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '0'} kg</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs border-t border-white/10 pt-2 text-rose-300">
                                                    <span>مجموع ضایعات روزانه</span>
                                                    <span className="font-mono font-black">{prodWaste.totalWaste ? prodWaste.totalWaste.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '0'} kg</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs border-t border-white/10 pt-2 text-amber-300">
                                                    <span>میانگین درصد خطا (ضایعات)</span>
                                                    <span className="font-mono font-black">{prodWaste.totalPct ? prodWaste.totalPct.toFixed(2) : '0.00'}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                        {!prodCompareMode && (
                            <>
                                {/* Waste Details Notes */}
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                            <label className="block text-xs font-bold text-slate-800">
                                📝 جزئیات و توضیحات ضایعات (این توضیحات در کپشن زیر PDF ارسالی به گروه قرار خواهد گرفت):
                            </label>
                            <textarea
                                rows={3}
                                className="w-full p-3 border border-slate-300 rounded-lg text-xs leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="مثلا: ضایعات مربوط به نخ DTY به علت قطعی برق خط ۲ و تعویض نازل‌های اسپاندکس..."
                                value={prodWaste.details || ''}
                                onChange={(e) => setProdWaste({ ...prodWaste, details: e.target.value })}
                            />
                            <div className="flex justify-end">
                                <button
                                    onClick={handleSaveWaste}
                                    disabled={isSavingWaste}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-1.5 rounded-md flex items-center gap-1 transition-all disabled:opacity-50"
                                >
                                    <Save className="h-3.5 w-3.5" />
                                    ذخیره و ثبت در بایگانی ضایعات
                                </button>
                            </div>
                        </div>

                        {/* 4.5 PRODUCTION WASTE ARCHIVE SECTION */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                                <div>
                                    <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                                        <Archive className="h-5 w-5 text-blue-600" />
                                        بایگانی و گزارشات ضایعات ثبت‌شده
                                    </h3>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        آرشیو کامل آمار تولید، جزئیات ضایعات و درصد خطای روزانه ثبت شده با قابلیت جستجو و گزارش‌گیری
                                    </p>
                                </div>
                                <div className="w-full sm:w-72 relative">
                                    <input
                                        type="text"
                                        placeholder="جستجو در تاریخ، توضیحات یا کالاها..."
                                        value={archiveSearch}
                                        onChange={(e) => setArchiveSearch(e.target.value)}
                                        className="w-full p-2 pr-8 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
                                    />
                                    <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                </div>
                            </div>

                            {isFetchingArchive ? (
                                <div className="py-8 text-center text-slate-400 text-xs">
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-600 mb-1" />
                                    <span>در حال بارگذاری اطلاعات آرشیو...</span>
                                </div>
                            ) : getFilteredArchive().length === 0 ? (
                                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                                    هیچ رکوردی در بایگانی ضایعات یافت نشد. با پر کردن مقادیر فوق و ذخیره آن، اولین رکورد را ایجاد نمایید.
                                </div>
                            ) : (
                                <>
                                    {/* Desktop View */}
                                    <div className="overflow-x-auto border border-slate-200 rounded-lg hidden md:block">
                                        <table className="w-full text-center text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                                                    <th className="p-3 text-right">تاریخ گزارش</th>
                                                    <th className="p-3">کل تولید (kg)</th>
                                                    <th className="p-3 text-rose-800">کل ضایعات (kg)</th>
                                                    <th className="p-3 text-amber-800">درصد ضایعات (%)</th>
                                                    <th className="p-3">تفکیک ضایعات ۶۱ / ۶۷ / ۷۹ / ۷۳ / ۷۰</th>
                                                    <th className="p-3 text-right max-w-xs truncate">توضیحات / علل ضایعات</th>
                                                    <th className="p-3 w-36">عملیات</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                                {getFilteredArchive().map((entry: any) => {
                                                    const totalProd = entry.totals?.grandTotal || 
                                                        (parseFloat(entry.totals?.qty_61 || 0) + 
                                                         parseFloat(entry.totals?.qty_67 || 0) + 
                                                         parseFloat(entry.totals?.qty_79 || 0) + 
                                                         parseFloat(entry.totals?.qty_73 || 0) +
                                                         parseFloat(entry.totals?.qty_schweiter || 0)) || 0;
                                                    
                                                    const wastePct = totalProd > 0 ? (entry.totalWaste / totalProd) * 100 : 0;
                                                    
                                                    return (
                                                        <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="p-3 text-right font-bold text-slate-900 font-mono">
                                                                {entry.dateFrom === entry.dateTo ? entry.dateFrom : `${entry.dateFrom} تا ${entry.dateTo}`}
                                                            </td>
                                                            <td className="p-3 font-mono font-bold">
                                                                {totalProd > 0 ? totalProd.toLocaleString('fa-IR', { maximumFractionDigits: 1 }) : '-'}
                                                            </td>
                                                            <td className="p-3 font-mono font-bold text-rose-700">
                                                                {entry.totalWaste > 0 ? entry.totalWaste.toLocaleString('fa-IR', { maximumFractionDigits: 1 }) : '-'}
                                                            </td>
                                                            <td className="p-3 font-mono font-black text-amber-700">
                                                                {wastePct > 0 ? `${wastePct.toFixed(2)}%` : '۰.۰۰%'}
                                                            </td>
                                                            <td className="p-3 font-mono text-slate-500 text-[11px]">
                                                                {(entry.waste_61 || 0).toLocaleString('fa-IR')} / {(entry.waste_67 || 0).toLocaleString('fa-IR')} / {(entry.waste_79 || 0).toLocaleString('fa-IR')} / {(entry.waste_73 || 0).toLocaleString('fa-IR')} / {(entry.waste_schweiter || 0).toLocaleString('fa-IR')}
                                                            </td>
                                                            <td className="p-3 text-right max-w-xs truncate text-[11px] text-slate-600" title={entry.details}>
                                                                {entry.details || '---'}
                                                            </td>
                                                            <td className="p-3 flex items-center justify-center gap-1.5">
                                                                <button
                                                                    onClick={() => handleLoadArchiveDate(entry)}
                                                                    className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded font-bold text-[10px] transition-colors cursor-pointer"
                                                                    title="بارگذاری تاریخ این سند تولید و ضایعات"
                                                                >
                                                                    بازخوانی روز
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteArchiveEntry(entry.id)}
                                                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                                                    title="حذف سند"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile View */}
                                    <div className="block md:hidden space-y-3">
                                        {getFilteredArchive().map((entry: any) => {
                                            const totalProd = entry.totals?.grandTotal || 
                                                (parseFloat(entry.totals?.qty_61 || 0) + 
                                                 parseFloat(entry.totals?.qty_67 || 0) + 
                                                 parseFloat(entry.totals?.qty_79 || 0) + 
                                                 parseFloat(entry.totals?.qty_73 || 0) +
                                                 parseFloat(entry.totals?.qty_schweiter || 0)) || 0;
                                            
                                            const wastePct = totalProd > 0 ? (entry.totalWaste / totalProd) * 100 : 0;
                                            
                                            return (
                                                <div key={entry.id} className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 shadow-xs">
                                                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                                        <span className="font-extrabold text-slate-900 font-mono text-xs">
                                                            {entry.dateFrom === entry.dateTo ? entry.dateFrom : `${entry.dateFrom} تا ${entry.dateTo}`}
                                                        </span>
                                                        <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 rounded font-black">
                                                            {wastePct > 0 ? `${wastePct.toFixed(2)}% ضایعات` : '۰.۰۰%'}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                        <div className="bg-slate-50 p-2 rounded-lg">
                                                            <span className="text-slate-400 block text-[9px]">کل تولید</span>
                                                            <span className="font-mono font-bold text-slate-800">{totalProd > 0 ? totalProd.toLocaleString('fa-IR', { maximumFractionDigits: 1 }) : '-'} kg</span>
                                                        </div>
                                                        <div className="bg-slate-50 p-2 rounded-lg text-rose-700">
                                                            <span className="text-slate-400 block text-[9px]">کل ضایعات</span>
                                                            <span className="font-mono font-bold">{entry.totalWaste > 0 ? entry.totalWaste.toLocaleString('fa-IR', { maximumFractionDigits: 1 }) : '-'} kg</span>
                                                        </div>
                                                    </div>

                                                    <div className="text-[10px] text-slate-500 bg-slate-50/50 p-2 rounded-lg font-mono leading-tight">
                                                        <span className="text-slate-400 block text-[9px] font-sans mb-0.5">تفکیک ضایعات ۶۱/۶۷/۷۹/۷۳/۷۰:</span>
                                                        {(entry.waste_61 || 0).toLocaleString('fa-IR')} / {(entry.waste_67 || 0).toLocaleString('fa-IR')} / {(entry.waste_79 || 0).toLocaleString('fa-IR')} / {(entry.waste_73 || 0).toLocaleString('fa-IR')} / {(entry.waste_schweiter || 0).toLocaleString('fa-IR')}
                                                    </div>

                                                    {entry.details && (
                                                        <div className="text-[11px] text-slate-600 bg-amber-50/30 border border-amber-100/50 p-2 rounded-lg leading-relaxed">
                                                            <span className="text-amber-800 font-bold block text-[9px] mb-0.5">توضیحات:</span>
                                                            {entry.details}
                                                        </div>
                                                    )}

                                                    <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 mt-2">
                                                        <button
                                                            onClick={() => handleLoadArchiveDate(entry)}
                                                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                                                        >
                                                            بازخوانی روز
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteArchiveEntry(entry.id)}
                                                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-rose-100"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                            </>
                        )}
                    </div>
                )}

                {/* 5. CHEQUES TAB */}
                {activeTab === 'cheques' && (
                    <div className="p-2 sm:p-6 space-y-4 sm:space-y-6">
                        {/* Top Action Header */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-black text-slate-800">سامانه مدیریت و خزانه‌داری چک‌ها و اسناد دریافتنی</h2>
                                    <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                                        سایان ERP
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1 font-medium">پایش هوشمند وضعیت چک‌های صندوق خزانه‌داری، بانکی، واخواست‌شده و وصولی به همراه ارسال خودکار و دستی به بات</p>
                            </div>
                            
                            {/* Action Buttons Toolbar */}
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={handlePrintChequesPDF}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                    title="چاپ رسمی و دریافت فایل PDF چک‌ها"
                                >
                                    <Printer className="h-3.5 w-3.5" />
                                    <span>چاپ رسمی / PDF</span>
                                </button>

                                <button
                                    onClick={handleExportChequesExcel}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                    title="دانلود فایل اکسل کامل چک‌ها با فرمت سازگار فارسی"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    <span>خروجی اکسل</span>
                                </button>

                                <button
                                    onClick={() => {
                                        setChequeBotTargetType(chequeStatusFilter === 'returned' ? 'returned' : (chequeStatusFilter === 'in_hand' ? 'vault' : 'filtered'));
                                        const teleFallback = settings?.chequeVaultTelegramGroupId || settings?.botAccountingGroupIdTele || settings?.botAccountingGroupId || settings?.telegramReportsGroupId || settings?.dailySalesTelegramGroupId || settings?.telegramGroupId || settings?.defaultWarehouseGroup || '';
                                        const baleFallback = settings?.chequeVaultBaleGroupId || settings?.botAccountingGroupIdBale || settings?.baleReportsGroupId || settings?.dailySalesBaleGroupId || settings?.baleGroupId || '';
                                        const waFallback = settings?.chequeVaultWhatsappGroupId || settings?.botAccountingGroupIdWhatsApp || settings?.whatsappReportsGroupId || settings?.dailySalesWhatsappGroupId || settings?.whatsappGroupId || '';
                                        if (!chequeBotCustomGroupTele && teleFallback) setChequeBotCustomGroupTele(teleFallback);
                                        if (!chequeBotCustomGroupBale && baleFallback) setChequeBotCustomGroupBale(baleFallback);
                                        if (!chequeBotCustomGroupWa && waFallback) setChequeBotCustomGroupWa(waFallback);
                                        setIsChequeBotModalOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                                    title="ارسال مستقیم گزارش و فایل‌های چک به تلگرام، بله و واتساپ"
                                >
                                    <Share2 className="h-3.5 w-3.5" />
                                    <span>ارسال به شبکه‌های اجتماعی / بات</span>
                                </button>
                            </div>
                        </div>

                        {/* Filters and Search Bar */}
                        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-200">
                            {/* Status Group Tabs */}
                            <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                                <button 
                                    onClick={() => setChequeStatusFilter('in_hand')}
                                    className={`text-xs font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer ${chequeStatusFilter === 'in_hand' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                                >
                                    🏛️ در صندوق (فعال)
                                </button>
                                <button 
                                    onClick={() => setChequeStatusFilter('at_bank')}
                                    className={`text-xs font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer ${chequeStatusFilter === 'at_bank' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                                >
                                    🏦 واگذار به بانک
                                </button>
                                <button 
                                    onClick={() => setChequeStatusFilter('returned')}
                                    className={`text-xs font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer ${chequeStatusFilter === 'returned' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                                >
                                    🔴 برگشتی
                                </button>
                                <button 
                                    onClick={() => setChequeStatusFilter('spent')}
                                    className={`text-xs font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer ${chequeStatusFilter === 'spent' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                                >
                                    ✅ وصول/خرج شده
                                </button>
                                <button 
                                    onClick={() => setChequeStatusFilter('all')}
                                    className={`text-xs font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer ${chequeStatusFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                                >
                                    🌐 همه موارد
                                </button>
                            </div>

                            {/* Secondary Action Controls */}
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => setIsChequeAdvancedFilterOpen(!isChequeAdvancedFilterOpen)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                        isChequeAdvancedFilterOpen || chequeBankFilter !== 'all' || chequeDrawerFilter !== 'all' || chequeMinAmount || chequeMaxAmount || chequeDateFrom || chequeDateTo
                                            ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-xs'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                    <Filter className="h-3.5 w-3.5" />
                                    <span>فیلترهای پیشرفته و سورت</span>
                                    {(chequeBankFilter !== 'all' || chequeDrawerFilter !== 'all' || chequeMinAmount || chequeMaxAmount || chequeDateFrom || chequeDateTo) && (
                                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                    )}
                                </button>

                                <button
                                    onClick={() => setHideOldSpentCheques(!hideOldSpentCheques)}
                                    title="فیلتر عدم نمایش چک‌های وصول یا خرج‌شده با تاریخ بیش از ۲ سال گذشته"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                        hideOldSpentCheques
                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${hideOldSpentCheques ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                    <span>{hideOldSpentCheques ? 'حذف وصولی/خرجی ۲+ سال' : 'نمایش همه (شامل ۲+ سال)'}</span>
                                </button>

                                <div className="relative flex-1 sm:w-64">
                                    <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                    <input 
                                        type="text"
                                        placeholder="جستجوی چک، بانک، صادرکننده..." 
                                        className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white" 
                                        value={chequeSearch}
                                        onChange={(e) => setChequeSearch(e.target.value)}
                                    />
                                    {chequeSearch && (
                                        <button 
                                            onClick={() => setChequeSearch('')}
                                            className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Advanced Filters Expandable Drawer */}
                        {isChequeAdvancedFilterOpen && (
                            <div className="p-4 bg-blue-50/40 rounded-2xl border border-blue-100 space-y-4 animate-fade-in">
                                <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                                    <div className="flex items-center gap-2 text-xs font-black text-blue-950">
                                        <Filter className="h-4 w-4 text-blue-600" />
                                        <span>فیلترهای پیشرفته و مرتب‌سازی داده‌ها</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setChequeBankFilter('all');
                                            setChequeDrawerFilter('all');
                                            setChequeDateFrom('');
                                            setChequeDateTo('');
                                            setChequeMinAmount('');
                                            setChequeMaxAmount('');
                                            setChequeSortBy('dueDate');
                                            setChequeSortOrder('asc');
                                        }}
                                        className="text-[11px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                                    >
                                        پاک‌کردن همه فیلترها
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                    {/* Bank Filter */}
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">بانک صادرکننده:</label>
                                        <select
                                            value={chequeBankFilter}
                                            onChange={(e) => setChequeBankFilter(e.target.value)}
                                            className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                                        >
                                            <option value="all">همه بانک‌ها</option>
                                            {uniqueChequeBanks.map((b, idx) => (
                                                <option key={idx} value={b}>{b}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Drawer Filter */}
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">صادرکننده / شخص:</label>
                                        <input
                                            type="text"
                                            placeholder="نام شخص یا شرکت..."
                                            value={chequeDrawerFilter === 'all' ? '' : chequeDrawerFilter}
                                            onChange={(e) => setChequeDrawerFilter(e.target.value || 'all')}
                                            className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>

                                    {/* Due Date From */}
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">سررسید از تاریخ:</label>
                                        <input
                                            type="text"
                                            placeholder="مثلاً 1404/01/01"
                                            value={chequeDateFrom}
                                            onChange={(e) => setChequeDateFrom(e.target.value)}
                                            className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>

                                    {/* Due Date To */}
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">سررسید تا تاریخ:</label>
                                        <input
                                            type="text"
                                            placeholder="مثلاً 1404/12/29"
                                            value={chequeDateTo}
                                            onChange={(e) => setChequeDateTo(e.target.value)}
                                            className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>

                                    {/* Sort Field */}
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">مرتب‌سازی بر اساس:</label>
                                        <select
                                            value={chequeSortBy}
                                            onChange={(e) => setChequeSortBy(e.target.value as any)}
                                            className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                                        >
                                            <option value="dueDate">📅 تاریخ سررسید</option>
                                            <option value="amount">💰 مبلغ چک</option>
                                            <option value="bankName">🏦 بانک صادرکننده</option>
                                            <option value="drawerName">👤 صادرکننده / شخص</option>
                                            <option value="chequeNo">🔢 شماره چک</option>
                                        </select>
                                    </div>

                                    {/* Sort Order */}
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">ترتیب مرتب‌سازی:</label>
                                        <div className="flex gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setChequeSortOrder('asc')}
                                                className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                                    chequeSortOrder === 'asc' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                صعودی ⬆
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setChequeSortOrder('desc')}
                                                className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                                    chequeSortOrder === 'desc' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                نزولی ⬇
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Cheques Overview Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                                <div>
                                    <div className="text-slate-500 font-bold text-xs">مجموع مبالغ چک‌های گزینش‌شده</div>
                                    <div className="text-xl font-black text-slate-900 mt-1.5 font-mono">
                                        {formatMoney(filteredCheques.reduce((sum, r) => sum + r.amount, 0))} <span className="text-xs font-bold text-slate-500">ریال</span>
                                    </div>
                                    <div className="text-[11px] text-blue-600 font-bold mt-1 font-mono">
                                        ≈ {formatMoney(Math.round(filteredCheques.reduce((sum, r) => sum + r.amount, 0) / 10))} تومان
                                    </div>
                                </div>
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                    <Coins className="w-6 h-6" />
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                                <div>
                                    <div className="text-slate-500 font-bold text-xs">تعداد کل چک‌ها</div>
                                    <div className="text-xl font-black text-slate-900 mt-1.5 font-mono">
                                        {filteredCheques.length} <span className="text-xs font-bold text-slate-500">فقره</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-medium mt-1">
                                        از مجموع {chequesData.length} فقره سند
                                    </div>
                                </div>
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                                    <CheckSquare className="w-6 h-6" />
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                                <div>
                                    <div className="text-slate-500 font-bold text-xs">میانگین مبلغ هر فقره</div>
                                    <div className="text-xl font-black text-slate-900 mt-1.5 font-mono">
                                        {formatMoney(filteredCheques.length ? Math.round(filteredCheques.reduce((sum, r) => sum + r.amount, 0) / filteredCheques.length) : 0)} <span className="text-xs font-bold text-slate-500">ریال</span>
                                    </div>
                                    <div className="text-[11px] text-purple-600 font-bold mt-1 font-mono">
                                        ≈ {formatMoney(filteredCheques.length ? Math.round(filteredCheques.reduce((sum, r) => sum + r.amount, 0) / (filteredCheques.length * 10)) : 0)} تومان
                                    </div>
                                </div>
                                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                                    <TrendingUp className="w-6 h-6" />
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                                <div>
                                    <div className="text-slate-500 font-bold text-xs">چک‌های نیازمند پیگیری</div>
                                    <div className="text-xl font-black text-rose-600 mt-1.5 font-mono">
                                        {filteredCheques.filter(c => c.statusGroup === 'returned' || String(c.statusDesc || '').includes('برگشت')).length} <span className="text-xs font-bold text-slate-500">برگشتی</span>
                                    </div>
                                    <div className="text-[11px] text-amber-600 font-bold mt-1">
                                        {filteredCheques.filter(c => c.statusGroup === 'in_hand').length} فقره نزد صندوق
                                    </div>
                                </div>
                                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                            </div>
                        </div>

                        {/* Cheques table */}
                        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                            {/* Desktop view */}
                            <div className="max-h-[550px] overflow-y-auto">
                                <table className="w-full text-right text-xs hidden md:table">
                                    <thead className="bg-slate-900 text-white sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 font-bold w-12 text-center">ردیف</th>
                                            <th className="p-3 font-bold w-20 text-center">نوع چک</th>
                                            <th 
                                                onClick={() => {
                                                    if (chequeSortBy === 'bankName') setChequeSortOrder(chequeSortOrder === 'asc' ? 'desc' : 'asc');
                                                    else { setChequeSortBy('bankName'); setChequeSortOrder('asc'); }
                                                }}
                                                className="p-3 font-bold w-28 cursor-pointer hover:bg-slate-800 transition-colors"
                                            >
                                                <div className="flex items-center gap-1">
                                                    <span>نام بانک</span>
                                                    {chequeSortBy === 'bankName' && (chequeSortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                                </div>
                                            </th>
                                            <th className="p-3 font-bold w-24">نام شعبه</th>
                                            <th 
                                                onClick={() => {
                                                    if (chequeSortBy === 'drawerName') setChequeSortOrder(chequeSortOrder === 'asc' ? 'desc' : 'asc');
                                                    else { setChequeSortBy('drawerName'); setChequeSortOrder('asc'); }
                                                }}
                                                className="p-3 font-bold cursor-pointer hover:bg-slate-800 transition-colors"
                                            >
                                                <div className="flex items-center gap-1">
                                                    <span>صاحب چک</span>
                                                    {chequeSortBy === 'drawerName' && (chequeSortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                                </div>
                                            </th>
                                            <th className="p-3 font-bold w-28">در وجه</th>
                                            <th 
                                                onClick={() => {
                                                    if (chequeSortBy === 'chequeNo') setChequeSortOrder(chequeSortOrder === 'asc' ? 'desc' : 'asc');
                                                    else { setChequeSortBy('chequeNo'); setChequeSortOrder('asc'); }
                                                }}
                                                className="p-3 font-bold w-24 cursor-pointer hover:bg-slate-800 transition-colors text-center"
                                            >
                                                <div className="flex items-center justify-center gap-1">
                                                    <span>سریال</span>
                                                    {chequeSortBy === 'chequeNo' && (chequeSortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => {
                                                    if (chequeSortBy === 'dueDate') setChequeSortOrder(chequeSortOrder === 'asc' ? 'desc' : 'asc');
                                                    else { setChequeSortBy('dueDate'); setChequeSortOrder('asc'); }
                                                }}
                                                className="p-3 font-bold w-28 cursor-pointer hover:bg-slate-800 transition-colors text-center"
                                            >
                                                <div className="flex items-center justify-center gap-1">
                                                    <span>تاریخ وصول</span>
                                                    {chequeSortBy === 'dueDate' && (chequeSortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                                </div>
                                            </th>
                                            <th className="p-3 font-bold w-20 text-center">روز تا وصول</th>
                                            <th className="p-3 font-bold w-20 text-center">وضعیت</th>
                                            <th 
                                                onClick={() => {
                                                    if (chequeSortBy === 'amount') setChequeSortOrder(chequeSortOrder === 'asc' ? 'desc' : 'asc');
                                                    else { setChequeSortBy('amount'); setChequeSortOrder('asc'); }
                                                }}
                                                className="p-3 font-bold text-left w-36 cursor-pointer hover:bg-slate-800 transition-colors"
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    <span>مبلغ چک (ریال)</span>
                                                    {chequeSortBy === 'amount' && (chequeSortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredCheques.length === 0 ? (
                                            <tr>
                                                <td colSpan={11} className="text-center py-12 text-slate-400 font-medium">
                                                    <Coins className="h-10 w-10 mx-auto text-slate-300 mb-2 opacity-50" />
                                                    هیچ چکی با مشخصات و فیلترهای انتخابی یافت نشد.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredCheques.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                    <td className="p-2.5 text-slate-400 text-center font-medium font-mono">{idx + 1}</td>
                                                    <td className="p-2.5 text-center font-semibold text-slate-600">{row.chequeType || 'دریافتنی'}</td>
                                                    <td className="p-2.5 font-bold text-slate-800">{row.bankName}</td>
                                                    <td className="p-2.5 text-slate-600">{row.branchName || '-'}</td>
                                                    <td className="p-2.5 font-semibold text-slate-800">{row.drawerName}</td>
                                                    <td className="p-2.5 text-slate-600">{row.inOrderOf || '-'}</td>
                                                    <td className="p-2.5 font-mono font-bold text-center text-slate-900">{row.chequeNo}</td>
                                                    <td className="p-2.5 font-medium text-center text-slate-600 font-mono">{formatDateToJalali(row.dueDate)}</td>
                                                    <td className="p-2.5 font-bold text-center text-indigo-700 font-mono">{row.daysToDue ?? 0}</td>
                                                    <td className="p-2.5 text-center">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border inline-block ${
                                                            row.statusGroup === 'returned'
                                                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                                : row.statusGroup === 'at_bank'
                                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                : row.statusGroup === 'spent'
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}>
                                                            {row.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-2.5 text-left font-mono font-black text-blue-700">{formatMoney(row.amount)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile view */}
                            <div className="block md:hidden divide-y divide-slate-100 bg-white">
                                {filteredCheques.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 font-medium">هیچ چکی یافت نشد. فیلترها را بررسی کنید.</div>
                                ) : (
                                    filteredCheques.map((row, idx) => (
                                        <div key={idx} className="p-4 space-y-2.5 text-xs">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] text-slate-400 font-bold font-mono">#{idx + 1} | سریال: {row.chequeNo}</span>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold border ${
                                                    row.statusGroup === 'returned'
                                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                        : row.statusGroup === 'at_bank'
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                        : row.statusGroup === 'spent'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                    {row.status}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="text-slate-900 font-black text-sm">{row.drawerName}</div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5 font-semibold">بانک: {row.bankName} {row.branchName ? `(${row.branchName})` : ''}</div>
                                                </div>
                                                <div className="text-left">
                                                    <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-800 font-bold text-[10px]">
                                                        {row.daysToDue ?? 0} روز تا وصول
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl font-mono">
                                                <div>
                                                    <span className="text-[9px] text-slate-400 font-sans block">تاریخ وصول</span>
                                                    <span className="font-bold text-slate-700 text-xs">{formatDateToJalali(row.dueDate)}</span>
                                                </div>
                                                <div className="text-left">
                                                    <span className="text-[9px] text-slate-400 font-sans block">مبلغ چک</span>
                                                    <span className="font-black text-blue-700 text-xs">{formatMoney(row.amount)} ریال</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 6. SAYAN SALES REMITTANCES TAB */}
                {activeTab === 'remittances' && (
                    <SayanRemittancesTab
                        settings={settings}
                        currentUser={currentUser}
                        defaultDateFrom={dateFrom}
                        defaultDateTo={dateTo}
                        runSayanQuery={runSayanQuery}
                    />
                )}

                {/* 7. WAREHOUSE OVERVIEW TAB */}
                {activeTab === 'warehouseOverview' && (
                    <WarehouseOverviewTab />
                )}
            </div>

            {/* Premium Statement Modal */}
            {isStatementModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 animate-fade-in rtl">
                    <div className="bg-white dark:bg-zinc-900 rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 dark:border-zinc-800 w-full h-full sm:h-auto max-w-6xl sm:max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-3.5 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950">
                            <div>
                                <h3 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                    ریز صورتحساب و دفاترحساب اشخاص
                                </h3>
                                <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-bold">
                                    نام شخص: <span className="text-slate-900 dark:text-zinc-100 text-xs sm:text-sm font-black">{modalTafsiliName}</span> (کد تفصیلی: <span className="text-slate-900 dark:text-zinc-100 font-mono font-bold">{modalTafsiliCode}</span>)
                                </div>
                                <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 font-bold">
                                    بازه زمانی: {dateFrom || '---'} تا {dateTo || '---'}
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    setIsStatementModalOpen(false);
                                    setStatementData([]);
                                    setGuaranteeCheques([]);
                                    setStatementSearch('');
                                }}
                                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Toolbar */}
                        <div className="p-2.5 sm:p-4 bg-slate-100/50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-2.5">
                            <div className="relative w-full sm:w-80">
                                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                                <input 
                                    type="text" 
                                    placeholder="جستجو در شرح تراکنش یا شماره سند..." 
                                    value={statementSearch} 
                                    onChange={e => setStatementSearch(e.target.value)} 
                                    className="w-full pl-3 pr-9 py-2 border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" 
                                />
                            </div>

                            <div className="flex gap-2 w-full sm:w-auto">
                                <button 
                                    onClick={() => fetchStatement(modalTafsiliCode)} 
                                    disabled={isLoading}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                    بروزرسانی داده‌ها
                                </button>
                                <button 
                                    onClick={handlePrintStatement}
                                    disabled={isLoading || filteredStatementData.length === 0}
                                    className="flex-1 sm:flex-none px-4 py-2 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                                    چاپ / PDF
                                </button>
                            </div>
                        </div>

                        {/* Modal Body (Table of Transactions) */}
                        <div className="p-2 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-zinc-950/50">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500 font-bold text-sm">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                    <span>در حال دریافت و تحلیل ریز گردش حساب سایان...</span>
                                </div>
                            ) : filteredStatementData.length > 0 ? (
                                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                    {/* Desktop View */}
                                    <table className="w-full text-right text-xs hidden md:table">
                                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3 font-bold text-slate-700 w-24">تاریخ سند</th>
                                                <th className="p-3 font-bold text-slate-700 w-24">شماره سند</th>
                                                <th className="p-3 font-bold text-slate-700 w-40">سرفصل معین</th>
                                                <th className="p-3 font-bold text-slate-700">شرح آرتیکل</th>
                                                <th className="p-3 font-bold text-slate-700 text-left w-36">بدهکار (ریال)</th>
                                                <th className="p-3 font-bold text-slate-700 text-left w-36">بستانکار (ریال)</th>
                                                <th className="p-3 font-bold text-slate-700 text-left w-40">مانده حساب (ریال)</th>
                                                <th className="p-3 font-bold text-slate-700 w-20 text-center">تشخیص</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredStatementData.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                                    <td className="p-3 font-medium text-slate-500 whitespace-nowrap">{formatDateToJalali(row.Date)}</td>
                                                    <td className="p-3 font-mono text-slate-600 font-semibold">{row.SanadNo}</td>
                                                    <td className="p-3 text-slate-600 font-medium whitespace-nowrap">
                                                        {row.MoeinGroup && row.MoeinParent && row.MoeinCode ? (
                                                            <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-[10px] font-extrabold">
                                                                {row.MoeinGroup}{row.MoeinParent}{row.MoeinCode} - {row.MoeinName || 'سایر'}
                                                            </span>
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </td>
                                                    <td className="p-3 font-medium text-slate-800 leading-relaxed">{row.Description || 'ثبت حسابداری'}</td>
                                                    <td className="p-3 text-left text-rose-600 font-mono font-medium">{row.bed > 0 ? formatMoney(row.bed) : '-'}</td>
                                                    <td className="p-3 text-left text-emerald-600 font-mono font-medium">{row.bes > 0 ? formatMoney(row.bes) : '-'}</td>
                                                    <td className={`p-3 text-left font-extrabold font-mono ${row.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                        {formatMoney(row.balance)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                                            row.balance > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                                                        }`}>
                                                            {row.balance > 0 ? 'بدهکار' : 'بستانکار'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}

                                            {/* Summary Sticky Foot */}
                                            <tr className="bg-slate-50 font-extrabold border-t-2 border-slate-200 shadow-[0_-2px_6px_rgba(0,0,0,0.03)] sticky bottom-0 z-10">
                                                <td colSpan={4} className="p-4 text-left font-extrabold text-slate-700">مجموع دوره تراکنش‌ها:</td>
                                                <td className="p-4 text-left text-rose-700 font-mono text-sm">
                                                    {formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bed, 0))}
                                                </td>
                                                <td className="p-4 text-left text-emerald-700 font-mono text-sm">
                                                    {formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bes, 0))}
                                                </td>
                                                <td colSpan={2} className={`p-4 text-left font-black font-mono text-sm ${
                                                    filteredStatementData[filteredStatementData.length - 1]?.balance > 0 ? 'text-rose-700' : 'text-emerald-700'
                                                }`}>
                                                    {formatMoney(filteredStatementData[filteredStatementData.length - 1]?.balance || 0)}
                                                    <span className="text-[10px] font-bold mr-1">
                                                        ({(filteredStatementData[filteredStatementData.length - 1]?.balance || 0) > 0 ? 'بدهکار' : 'بستانکار'})
                                                    </span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* Mobile View */}
                                    <div className="block md:hidden divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                        {filteredStatementData.map((row, idx) => (
                                            <div key={idx} className="p-2.5 sm:p-4 space-y-2 text-xs">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] text-slate-400 font-bold font-mono">سند: {row.SanadNo} | {formatDateToJalali(row.Date)}</span>
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                                                        row.balance > 0 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                    }`}>
                                                        {row.balance > 0 ? 'بدهکار' : 'بستانکار'}
                                                    </span>
                                                </div>
                                                
                                                {row.MoeinGroup && row.MoeinParent && row.MoeinCode && (
                                                    <div className="inline-block bg-slate-50 text-slate-700 px-2 py-1 rounded text-[10px] font-bold border border-slate-100">
                                                        معین: {row.MoeinGroup}{row.MoeinParent}{row.MoeinCode} - {row.MoeinName || 'سایر'}
                                                    </div>
                                                )}

                                                <div className="text-slate-800 font-medium leading-relaxed bg-slate-50/50 p-2.5 rounded-xl border border-dashed border-slate-150">
                                                    {row.Description || 'ثبت حسابداری'}
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px] bg-slate-50 p-2 rounded-lg">
                                                    <div>
                                                        <span className="text-[9px] text-slate-400 font-sans block">بدهکار</span>
                                                        <span className="font-bold text-rose-600">{row.bed > 0 ? formatMoney(row.bed) : '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] text-slate-400 font-sans block">بستانکار</span>
                                                        <span className="font-bold text-emerald-600">{row.bes > 0 ? formatMoney(row.bes) : '-'}</span>
                                                    </div>
                                                    <div className="text-left">
                                                        <span className="text-[9px] text-slate-400 font-sans block">مانده</span>
                                                        <span className={`font-black ${row.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatMoney(row.balance)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Mobile Sticky / Persistent summary */}
                                        <div className="p-4 bg-slate-50 border-t-2 border-slate-200 text-xs font-black space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">جمع گردش بدهکار دوره:</span>
                                                <span className="text-rose-700 font-mono font-bold text-sm">{formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bed, 0))} ریال</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">جمع گردش بستانکار دوره:</span>
                                                <span className="text-emerald-700 font-mono font-bold text-sm">{formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bes, 0))} ریال</span>
                                            </div>
                                            <div className="flex justify-between border-t border-slate-200/60 pt-1 mt-1 text-sm">
                                                <span className="text-slate-700">مانده نهایی دوره:</span>
                                                <span className={`font-mono text-base ${
                                                    filteredStatementData[filteredStatementData.length - 1]?.balance > 0 ? 'text-rose-700' : 'text-emerald-700'
                                                }`}>
                                                    {formatMoney(filteredStatementData[filteredStatementData.length - 1]?.balance || 0)} ریال
                                                    <span className="text-[10px] font-bold mr-1">
                                                        ({(filteredStatementData[filteredStatementData.length - 1]?.balance || 0) > 0 ? 'بدهکار' : 'بستانکار'})
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-24 text-slate-400 font-medium border-2 border-dashed border-slate-200 bg-white rounded-2xl shadow-sm">
                                    هیچ تراکنشی در بازه زمانی تعیین‌شده یافت نشد.
                                </div>
                            )}

                            {/* Guarantee Cheques Section */}
                            {!isLoading && guaranteeCheques.length > 0 && (
                                <div className="mt-6 space-y-3 bg-amber-50/40 p-3 sm:p-5 rounded-2xl border border-amber-200/60 shadow-sm animate-fadeIn">
                                    <div className="flex items-center gap-2 text-amber-900">
                                        <CheckSquare className="w-5 h-5 text-amber-600" />
                                        <h3 className="text-sm font-bold">چک‌های تضمینی و تعهدات مرتبط</h3>
                                    </div>
                                    <div className="rounded-xl border border-amber-200 overflow-hidden bg-white max-h-[300px] overflow-y-auto shadow-inner">
                                        {/* Desktop View */}
                                        <table className="w-full text-right text-xs hidden md:table">
                                            <thead className="bg-amber-50/80 sticky top-0 border-b border-amber-200 z-10">
                                                <tr>
                                                    <th className="p-3 font-bold text-amber-800 w-24">تاریخ سند</th>
                                                    <th className="p-3 font-bold text-amber-800 w-24">شماره سند</th>
                                                    <th className="p-3 font-bold text-amber-800 w-40">سرفصل معین</th>
                                                    <th className="p-3 font-bold text-amber-800">شرح آرتیکل</th>
                                                    <th className="p-3 font-bold text-amber-800 text-left w-36">مبلغ تضمین (ریال)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-amber-100/60">
                                                {guaranteeCheques.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                                                        <td className="p-3 font-medium text-slate-500 whitespace-nowrap">{formatDateToJalali(row.Date)}</td>
                                                        <td className="p-3 font-mono text-slate-600 font-semibold">{row.SanadNo}</td>
                                                        <td className="p-3 text-slate-600 font-medium whitespace-nowrap">
                                                            <span className="bg-amber-100/70 text-amber-800 px-2.5 py-0.5 rounded text-[10px] font-bold">
                                                                {row.MoeinGroup}{row.MoeinParent}{row.MoeinCode} - {row.MoeinName || 'سایر'}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 font-medium text-slate-800 leading-relaxed">{row.Description}</td>
                                                        <td className="p-3 text-left text-amber-700 font-mono font-bold">
                                                            {formatMoney(row.bed > 0 ? row.bed : row.bes)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Mobile View */}
                                        <div className="block md:hidden divide-y divide-amber-100/60 bg-white">
                                            {guaranteeCheques.map((row, idx) => (
                                                <div key={idx} className="p-4 space-y-2 text-xs">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] text-slate-400 font-bold font-mono">سند: {row.SanadNo} | {formatDateToJalali(row.Date)}</span>
                                                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[9px] font-bold">
                                                            {row.MoeinGroup}{row.MoeinParent}{row.MoeinCode} - {row.MoeinName || 'سایر'}
                                                        </span>
                                                    </div>
                                                    <div className="text-slate-800 font-medium leading-relaxed bg-amber-50/20 p-2.5 rounded-lg border border-dashed border-amber-200">
                                                        {row.Description}
                                                    </div>
                                                    <div className="flex justify-between items-center font-mono">
                                                        <span className="text-[9px] text-slate-400 font-sans">مبلغ تضمین</span>
                                                        <span className="font-extrabold text-amber-700 text-sm">{formatMoney(row.bed > 0 ? row.bed : row.bes)} ریال</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
                            <button 
                                onClick={() => {
                                    setIsStatementModalOpen(false);
                                    setStatementData([]);
                                    setGuaranteeCheques([]);
                                    setStatementSearch('');
                                }}
                                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                                بستن پنجره
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cheques Bot Dispatch Modal */}
            {isChequeBotModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in rtl">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/10 backdrop-blur-sm rounded-xl">
                                    <Share2 className="w-5 h-5 text-blue-300" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-black">
                                        ارسال هوشمند گزارش چک‌ها به پیام‌رسان‌ها (بات)
                                    </h3>
                                    <p className="text-xs text-blue-200 mt-0.5">
                                        ارسال متن تحلیلی به همراه فایل‌های پیوست PDF و اکسل
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsChequeBotModalOpen(false)}
                                className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
                            {(() => {
                                const todayShamsiStr = formatDateToJalali(new Date().toISOString());
                                return (
                                    <>
                                        {/* Target Scope Selection */}
                                        <div>
                                            <label className="font-black text-slate-800 text-xs block mb-2">نوع و دامنه گزارش ارسالی:</label>
                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setChequeBotTargetType('vault')}
                                                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                                                        chequeBotTargetType === 'vault'
                                                            ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-950 font-black shadow-xs'
                                                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[11px]">🏛️ چک‌های صندوق</span>
                                                        {chequeBotTargetType === 'vault' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 font-medium leading-relaxed">
                                                        فقط چک‌های نزد صندوق خزانه‌داری
                                                    </div>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setChequeBotTargetType('returned')}
                                                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                                                        chequeBotTargetType === 'returned'
                                                            ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 text-rose-950 font-black shadow-xs'
                                                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[11px]">🔴 چک‌های برگشتی</span>
                                                        {chequeBotTargetType === 'returned' && <Check className="w-3.5 h-3.5 text-rose-600" />}
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 font-medium leading-relaxed">
                                                        اسناد برگشتی و واخواست‌شده جهت پیگیری
                                                    </div>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setChequeBotTargetType('matured')}
                                                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                                                        chequeBotTargetType === 'matured'
                                                            ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 font-black shadow-xs'
                                                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[11px]">🔔 سررسید شده امروز</span>
                                                        {chequeBotTargetType === 'matured' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 font-medium leading-relaxed">
                                                        چک‌های صندوق سررسید امروز {todayShamsiStr}
                                                    </div>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setChequeBotTargetType('filtered')}
                                                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                                                        chequeBotTargetType === 'filtered'
                                                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 font-black shadow-xs'
                                                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[11px]">🎯 لیست فیلترشده فعلی</span>
                                                        {chequeBotTargetType === 'filtered' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 font-medium leading-relaxed">
                                                        دقیقاً {filteredCheques.length} فقره مطابق جدول و سورت جاری
                                                    </div>
                                                </button>
                                            </div>
                                        </div>

                            {/* Platforms Selection */}
                            <div>
                                <label className="font-black text-slate-800 text-xs block mb-2">پیام‌رسان‌های مقصد:</label>
                                <div className="grid grid-cols-3 gap-2.5">
                                    <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                        chequeBotSelectedPlatforms.includes('telegram') 
                                            ? 'bg-sky-50 border-sky-400 font-bold text-sky-900 shadow-xs' 
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox"
                                                className="w-4 h-4 text-sky-600 rounded"
                                                checked={chequeBotSelectedPlatforms.includes('telegram')}
                                                onChange={(e) => {
                                                    if (e.target.checked) setChequeBotSelectedPlatforms([...chequeBotSelectedPlatforms, 'telegram']);
                                                    else setChequeBotSelectedPlatforms(chequeBotSelectedPlatforms.filter(p => p !== 'telegram'));
                                                }}
                                            />
                                            <span>تلگرام (Telegram)</span>
                                        </div>
                                    </label>

                                    <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                        chequeBotSelectedPlatforms.includes('bale') 
                                            ? 'bg-emerald-50 border-emerald-400 font-bold text-emerald-900 shadow-xs' 
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox"
                                                className="w-4 h-4 text-emerald-600 rounded"
                                                checked={chequeBotSelectedPlatforms.includes('bale')}
                                                onChange={(e) => {
                                                    if (e.target.checked) setChequeBotSelectedPlatforms([...chequeBotSelectedPlatforms, 'bale']);
                                                    else setChequeBotSelectedPlatforms(chequeBotSelectedPlatforms.filter(p => p !== 'bale'));
                                                }}
                                            />
                                            <span>بله (Bale)</span>
                                        </div>
                                    </label>

                                    <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                        chequeBotSelectedPlatforms.includes('whatsapp') 
                                            ? 'bg-green-50 border-green-400 font-bold text-green-900 shadow-xs' 
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox"
                                                className="w-4 h-4 text-green-600 rounded"
                                                checked={chequeBotSelectedPlatforms.includes('whatsapp')}
                                                onChange={(e) => {
                                                    if (e.target.checked) setChequeBotSelectedPlatforms([...chequeBotSelectedPlatforms, 'whatsapp']);
                                                    else setChequeBotSelectedPlatforms(chequeBotSelectedPlatforms.filter(p => p !== 'whatsapp'));
                                                }}
                                            />
                                            <span>واتساپ (WhatsApp)</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Attachments Selection */}
                            <div>
                                <label className="font-black text-slate-800 text-xs block mb-2">فایل‌های پیوست:</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                        chequeBotAttachPdf ? 'bg-red-50 border-red-300 font-bold text-red-900 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600'
                                    }`}>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox"
                                                className="w-4 h-4 text-red-600 rounded"
                                                checked={chequeBotAttachPdf}
                                                onChange={(e) => setChequeBotAttachPdf(e.target.checked)}
                                            />
                                            <span>📄 پیوست فایل PDF رسمی خزانه‌داری</span>
                                        </div>
                                    </label>

                                    <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                        chequeBotAttachExcel ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600'
                                    }`}>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox"
                                                className="w-4 h-4 text-emerald-600 rounded"
                                                checked={chequeBotAttachExcel}
                                                onChange={(e) => setChequeBotAttachExcel(e.target.checked)}
                                            />
                                            <span>📊 پیوست فایل اکسل (Excel/CSV)</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Target Group IDs Override */}
                            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="font-black text-slate-700 text-xs flex items-center gap-1.5">
                                        <span>🎯 شناسه گروه/کانال مقصد (اختیاری جهت ارسال اختصاصی):</span>
                                    </label>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                        در صورت خالی بودن، از گروه‌های پیش‌فرض تنظیمات استفاده می‌شود
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {chequeBotSelectedPlatforms.includes('telegram') && (
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-600 block mb-1">شناسه تلگرام:</label>
                                            <input
                                                type="text"
                                                placeholder={settings?.chequeVaultTelegramGroupId || settings?.botAccountingGroupIdTele || settings?.telegramGroupId || "-100..."}
                                                value={chequeBotCustomGroupTele}
                                                onChange={(e) => setChequeBotCustomGroupTele(e.target.value)}
                                                className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white dir-ltr font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                                            />
                                        </div>
                                    )}
                                    {chequeBotSelectedPlatforms.includes('bale') && (
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-600 block mb-1">شناسه بله:</label>
                                            <input
                                                type="text"
                                                placeholder={settings?.chequeVaultBaleGroupId || settings?.botAccountingGroupIdBale || settings?.baleGroupId || "ID..."}
                                                value={chequeBotCustomGroupBale}
                                                onChange={(e) => setChequeBotCustomGroupBale(e.target.value)}
                                                className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white dir-ltr font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>
                                    )}
                                    {chequeBotSelectedPlatforms.includes('whatsapp') && (
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-600 block mb-1">شناسه واتساپ:</label>
                                            <input
                                                type="text"
                                                placeholder={settings?.chequeVaultWhatsappGroupId || settings?.botAccountingGroupIdWhatsApp || "...@g.us"}
                                                value={chequeBotCustomGroupWa}
                                                onChange={(e) => setChequeBotCustomGroupWa(e.target.value)}
                                                className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white dir-ltr font-mono focus:outline-none focus:ring-1 focus:ring-green-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Custom Title Input */}
                            <div>
                                <label className="font-black text-slate-700 text-xs block mb-1">
                                    عنوان سفارشی گزارش (اختیاری):
                                </label>
                                <input
                                    type="text"
                                    placeholder="مثلاً: گزارش ویژه چک‌های نزد صندوق خزانه‌داری - جلسه هیئت مدیره"
                                    value={chequeBotCustomTitle}
                                    onChange={(e) => setChequeBotCustomTitle(e.target.value)}
                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            {/* Summary Card */}
                            <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/60 flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] text-blue-900 font-bold block">
                                        تعداد اقلام انتخابی جهت ارسال:
                                    </span>
                                    <span className="text-sm font-black text-blue-950 font-mono">
                                        {chequeBotTargetType === 'filtered' 
                                            ? filteredCheques.length 
                                            : (chequeBotTargetType === 'returned' 
                                                ? chequesData.filter(c => c.statusGroup === 'returned').length 
                                                : (chequeBotTargetType === 'matured'
                                                    ? chequesData.filter(c => c.statusGroup === 'in_hand' && formatDateToJalali(c.dueDate) === todayShamsiStr).length
                                                    : chequesData.filter(c => c.statusGroup === 'in_hand').length))
                                        } فقره چک
                                    </span>
                                </div>
                                <div className="text-left font-mono">
                                    <span className="text-[10px] text-blue-800 block">مجموع مبلغ</span>
                                    <span className="text-sm font-black text-blue-900">
                                        {formatMoney(
                                            chequeBotTargetType === 'filtered'
                                                ? filteredCheques.reduce((s, c) => s + c.amount, 0)
                                                : (chequeBotTargetType === 'returned'
                                                    ? chequesData.filter(c => c.statusGroup === 'returned').reduce((s, c) => s + c.amount, 0)
                                                    : (chequeBotTargetType === 'matured'
                                                        ? chequesData.filter(c => c.statusGroup === 'in_hand' && formatDateToJalali(c.dueDate) === todayShamsiStr).reduce((s, c) => s + c.amount, 0)
                                                        : chequesData.filter(c => c.statusGroup === 'in_hand').reduce((s, c) => s + c.amount, 0)))
                                        )} ریال
                                    </span>
                                </div>
                            </div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setIsChequeBotModalOpen(false)}
                                disabled={isSendingChequesBot}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                انصراف
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSendChequesToBot()}
                                disabled={isSendingChequesBot || chequeBotSelectedPlatforms.length === 0}
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSendingChequesBot ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>در حال ساخت اسناد و ارسال به بات...</span>
                                    </>
                                ) : (
                                    <>
                                        <Share2 className="w-4 h-4" />
                                        <span>تایید و ارسال فوری به پیام‌رسان‌ها</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
