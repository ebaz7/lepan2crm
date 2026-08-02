import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, FileText, Users, 
  Send, Printer, Download, Calendar, Filter, ChevronDown, ChevronRight, 
  Sparkles, RefreshCw, BarChart2, PieChart as PieChartIcon, LineChart as LineChartIcon,
  CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight, Layers, Award, ShieldAlert, X,
  Image as ImageIcon, FileSpreadsheet, Eye, Grid
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, 
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid 
} from 'recharts';
import * as jalaali from 'jalaali-js';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';

// ----------------------------------------------------------------------
// TYPES & INTERFACES
// ----------------------------------------------------------------------
export interface SayanSalesRow {
  DocId: string;
  InvoiceNum: string;
  Date: string; // ISO String
  Notes?: string;
  OpCode: string; // '3', '12', '23' = Sales; '13', '14' = Return
  ItemCode: string;
  ItemName: string;
  Quantity: string; // Weight / Qty
  ItemNotes?: string;
  Amount: string;
  GroupName?: string;
  CustomerName?: string;
  City?: string;
  SalesExpert?: string;
  PaymentStatus?: string;
}

interface SayanSalesDashboardProps {
  salesData: SayanSalesRow[];
  compareDataB?: SayanSalesRow[];
  dateFrom: string;
  dateTo: string;
  salesDateFromB?: string;
  salesDateToB?: string;
  compareMode: boolean;
  isLoading: boolean;
  settings?: any;
  onRefreshData?: () => void;
  onDateRangeChange?: (from: string, to: string) => void;
  onCompareDateRangeChange?: (fromB: string, toB: string) => void;
  onToggleCompareMode?: (enabled: boolean) => void;
  runSayanQuery?: (sql: string) => Promise<any>;
}

// ----------------------------------------------------------------------
// CONSTANTS & HELPERS
// ----------------------------------------------------------------------
export const MAJOR_CATEGORIES = [
  'اسپاندکس (کاور)',
  'کش',
  'اسپاندکس پوشش (ساپورت)',
  'پلی استر شواتیز',
  'نایلون',
  'نخ ملت',
  'لایکرا',
  'FDY',
  'چیپس',
  'POY',
  'نخ ۱۲۰ پلی استر',
  'لاستیک',
  'لاکرا',
  'نخ ۱۸۰ پلی استر اسپان',
  'مستربچ'
];

const CATEGORY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', 
  '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6',
  '#a855f7', '#e11d48', '#0284c7', '#059669', '#d97706', '#64748b'
];

export function classifyMajorCategory(groupName: string = '', itemName: string = ''): string {
  const text = `${groupName} ${itemName}`.toLowerCase();
  
  if (text.includes('کاور') || text.includes('کاورینگ') || (text.includes('اسپاندکس') && text.includes('کاور'))) return 'اسپاندکس (کاور)';
  if (text.includes('ساپورت') || text.includes('پوشش') || (text.includes('اسپاندکس') && text.includes('پوشش'))) return 'اسپاندکس پوشش (ساپورت)';
  if (text.includes('شواتیز') || (text.includes('پلی استر') && text.includes('شواتیز'))) return 'پلی استر شواتیز';
  if (text.includes('120') || text.includes('۱۲۰')) return 'نخ ۱۲۰ پلی استر';
  if (text.includes('180') || text.includes('۱۸۰') || text.includes('اسپان')) return 'نخ ۱۸۰ پلی استر اسپان';
  if (text.includes('fdy') || text.includes('اف دی ای')) return 'FDY';
  if (text.includes('poy') || text.includes('پی او وای')) return 'POY';
  if (text.includes('ملت') || text.includes('melt')) return 'نخ ملت';
  if (text.includes('نایلون') || text.includes('nylon')) return 'نایلون';
  if (text.includes('چیپس') || text.includes('chip')) return 'چیپس';
  if (text.includes('لایکرا') || text.includes('lycra')) return 'لایکرا';
  if (text.includes('لاکرا')) return 'لاکرا';
  if (text.includes('مستربچ') || text.includes('masterbatch')) return 'مستربچ';
  if (text.includes('لاستیک') || text.includes('rubber')) return 'لاستیک';
  if (text.includes('کش') || text.includes('elastic')) return 'کش';
  if (text.includes('اسپاندکس') || text.includes('spandex')) return 'اسپاندکس (کاور)';

  return groupName || 'سایر محصولات';
}

function formatMoney(amount: number): string {
  if (isNaN(amount)) return '۰';
  return Math.round(amount).toLocaleString('fa-IR');
}

function formatWeight(kg: number): string {
  if (isNaN(kg)) return '۰';
  return kg.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function toShamsiStr(dateIso: string): string {
  try {
    const d = new Date(dateIso);
    if (isNaN(d.getTime())) return '-';
    const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const m = String(j.jm).padStart(2, '0');
    const day = String(j.jd).padStart(2, '0');
    return `${j.jy}/${m}/${day}`;
  } catch (e) {
    return '-';
  }
}

// ----------------------------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------------------------
export const SayanSalesDashboard: React.FC<SayanSalesDashboardProps> = ({
  salesData = [],
  compareDataB = [],
  dateFrom,
  dateTo,
  salesDateFromB = '',
  salesDateToB = '',
  compareMode = false,
  isLoading = false,
  settings = {},
  onRefreshData,
  onDateRangeChange,
  onCompareDateRangeChange,
  onToggleCompareMode
}) => {

  // State
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'items' | 'invoices' | 'compare' | 'charts'>('hierarchy');
  const [compareModeType, setCompareModeType] = useState<'groups' | 'items'>('groups');
  const [isExportingImage, setIsExportingImage] = useState<boolean>(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');

  // Dashboard Image Export Handler (html2canvas)
  const handleExportImage = async () => {
    const el = document.getElementById('executive-sales-dashboard');
    if (!el) return;
    setIsExportingImage(true);
    const toastId = toast.loading('در حال پردازش و ساخت تصویر داشبورد مدیریتی...');
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        logging: false
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Sayan_Sales_Executive_Dashboard_${dateFrom.replace(/\//g, '-')}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('تصویر داشبورد با موفقیت تولید و دانلود شد.', { id: toastId });
    } catch (err: any) {
      toast.error('خطا در تولید تصویر داشبورد: ' + err.message, { id: toastId });
    } finally {
      setIsExportingImage(false);
    }
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    try {
      let csvContent = '\uFEFF';
      if (activeTab === 'hierarchy') {
        csvContent += 'ردیف,گروه اصلی کالا,وزن فروش (ک‌گ),وزن مرجوعی (ک‌گ),وزن خالص (ک‌گ),مبلغ فروش (ریال),مبلغ مرجوعی (ریال),فروش خالص (ریال),فی نهایی (ریال/ک‌گ),سهم %\n';
        processedMetrics.categoryList.forEach((c, idx) => {
          csvContent += `${idx + 1},"${c.name}",${c.salesWgt},${c.retWgt},${c.netWgt},${c.salesAmt},${c.retAmt},${c.netAmt},${Math.round(c.netFee)},${c.sharePct.toFixed(1)}%\n`;
        });
      } else if (activeTab === 'items') {
        csvContent += 'ردیف,کد کالا,نام کالا,گروه اصلی,وزن فروش (ک‌گ),وزن مرجوعی (ک‌گ),وزن خالص (ک‌گ),مبلغ فروش (ریال),مبلغ مرجوعی (ریال),فروش خالص (ریال),فی خالص نهایی (ریال/ک‌گ),سهم %\n';
        filteredItems.forEach((item, idx) => {
          csvContent += `${idx + 1},"${item.itemCode}","${item.itemName}","${item.majorCategory}",${item.salesQty},${item.returnQty},${item.netQty},${item.salesAmt},${item.returnAmt},${item.netAmt},${Math.round(item.netFee)},${item.sharePct.toFixed(1)}%\n`;
        });
      } else if (activeTab === 'invoices') {
        csvContent += 'ردیف,شماره فاکتور,تاریخ,نام خریدار,شهر,کارشناس فروش,مبلغ ناخالص (ریال),مرجوعی (ریال),فروش خالص (ریال),وزن خالص (ک‌گ),وضعیت تسویه\n';
        filteredInvoices.forEach((inv, idx) => {
          csvContent += `${idx + 1},"${inv.invoiceNum}","${inv.date}","${inv.customerName}","${inv.city}","${inv.salesExpert}",${inv.grossAmt},${inv.retAmt},${inv.netAmt},${inv.netWgt},"${inv.paymentStatus}"\n`;
        });
      } else if (activeTab === 'compare' && comparisonMetrics) {
        csvContent += 'عنوان کالا / گروه,فروش خالص A (ریال),فروش خالص B (ریال),وزن A (ک‌گ),وزن B (ک‌گ),فی A (ریال),فی B (ریال),اختلاف مبلغ,درصد رشد/افت\n';
        comparisonMetrics.compareRows.forEach(row => {
          csvContent += `"${row.catName}",${row.netAmtA},${row.netAmtB},${row.netWgtA},${row.netWgtB},${Math.round(row.netFeeA)},${Math.round(row.netFeeB)},${row.diffAmt},${row.growthPct.toFixed(1)}%\n`;
        });
      }
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Sayan_Sales_${activeTab}_${dateFrom.replace(/\//g, '-')}.csv`;
      link.click();
      toast.success('فایل CSV با موفقیت دانلود شد.');
    } catch (e: any) {
      toast.error('خطا در ساخت CSV: ' + e.message);
    }
  };

  // Preset generator for quick Period B selection
  const applyPreset = (preset: 'prev_year' | 'prev_month' | 'prev_quarter') => {
    if (!dateFrom || !dateTo || !onCompareDateRangeChange) return;
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

        let bFrom = '';
        let bTo = '';

        if (preset === 'prev_year') {
          bFrom = `${yFrom - 1}/${String(mFrom).padStart(2, '0')}/${String(dFrom).padStart(2, '0')}`;
          bTo = `${yTo - 1}/${String(mTo).padStart(2, '0')}/${String(dTo).padStart(2, '0')}`;
        } else if (preset === 'prev_month') {
          let prevMFrom = mFrom - 1;
          let prevYFrom = yFrom;
          if (prevMFrom < 1) { prevMFrom = 12; prevYFrom--; }
          
          let prevMTo = mTo - 1;
          let prevYTo = yTo;
          if (prevMTo < 1) { prevMTo = 12; prevYTo--; }

          bFrom = `${prevYFrom}/${String(prevMFrom).padStart(2, '0')}/${String(dFrom).padStart(2, '0')}`;
          bTo = `${prevYTo}/${String(prevMTo).padStart(2, '0')}/${String(dTo).padStart(2, '0')}`;
        } else if (preset === 'prev_quarter') {
          let prevMFrom = mFrom - 3;
          let prevYFrom = yFrom;
          if (prevMFrom < 1) { prevMFrom += 12; prevYFrom--; }

          let prevMTo = mTo - 3;
          let prevYTo = yTo;
          if (prevMTo < 1) { prevMTo += 12; prevYTo--; }

          bFrom = `${prevYFrom}/${String(prevMFrom).padStart(2, '0')}/${String(dFrom).padStart(2, '0')}`;
          bTo = `${prevYTo}/${String(prevMTo).padStart(2, '0')}/${String(dTo).padStart(2, '0')}`;
        }

        onCompareDateRangeChange(bFrom, bTo);
        if (onToggleCompareMode) onToggleCompareMode(true);
        toast.success(`بازه دوم مقایسه به همسان (${bFrom} تا ${bTo}) ست شد.`);
      }
    } catch (e: any) {
      toast.error('خطا در محاسبه تاریخ مقایسه');
    }
  };
  
  // Bot Modal State
  const [isBotModalOpen, setIsBotModalOpen] = useState<boolean>(false);
  const [isSendingBot, setIsSendingBot] = useState<boolean>(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['telegram', 'bale']);

  // Toggle Category Expand
  const toggleCategory = (catName: string) => {
    setExpandedCategories(prev => ({ ...prev, [catName]: !prev[catName] }));
  };

  // ----------------------------------------------------------------------
  // DATA COMPUTATIONS (Net Sales = Sales - Returns)
  // ----------------------------------------------------------------------
  const processedMetrics = useMemo(() => {
    let rangeSalesAmt = 0, rangeSalesWgt = 0;
    let rangeRetAmt = 0, rangeRetWgt = 0;
    
    let todayNetAmt = 0, todayNetWgt = 0, todayRetAmt = 0, todayRetWgt = 0;
    let yesterdayNetAmt = 0, yesterdayNetWgt = 0, yesterdayRetAmt = 0, yesterdayRetWgt = 0;
    let monthNetAmt = 0, monthNetWgt = 0;
    let quarterNetAmt = 0, quarterNetWgt = 0;
    let yearNetAmt = 0, yearNetWgt = 0;

    const invoicesSet = new Set<string>();
    const customersSet = new Set<string>();

    const now = new Date();
    const jNow = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const jYesterday = jalaali.toJalaali(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate());

    // Detailed Item Map
    const itemMap = new Map<string, {
      itemCode: string;
      itemName: string;
      groupName: string;
      majorCategory: string;
      salesQty: number;
      salesAmt: number;
      returnQty: number;
      returnAmt: number;
    }>();

    // Major Category Map
    const categoryMap = new Map<string, {
      name: string;
      salesWgt: number;
      salesAmt: number;
      retWgt: number;
      retAmt: number;
      itemsMap: Map<string, { itemName: string; salesWgt: number; salesAmt: number; retWgt: number; retAmt: number; }>;
    }>();

    // Initialize all 15 Major Categories to preserve order
    MAJOR_CATEGORIES.forEach(cat => {
      categoryMap.set(cat, {
        name: cat,
        salesWgt: 0,
        salesAmt: 0,
        retWgt: 0,
        retAmt: 0,
        itemsMap: new Map()
      });
    });

    // Invoices list
    const invoiceListMap = new Map<string, {
      invoiceNum: string;
      date: string;
      customerName: string;
      city: string;
      salesExpert: string;
      grossAmt: number;
      retAmt: number;
      netAmt: number;
      netWgt: number;
      paymentStatus: string;
    }>();

    salesData.forEach(row => {
      const amt = parseFloat(row.Amount || '0') || 0;
      const qty = parseFloat(row.Quantity || '0') || 0;
      // OpCode 13 is Sales Return (مرجوعی از فروش). OpCode 14 is Purchase (خرید) and must not be treated as return.
      const isReturn = row.OpCode === '13';
      const rowDate = new Date(row.Date);
      const invNum = row.InvoiceNum || row.DocId || 'بدون شماره';
      const custName = row.CustomerName || 'مشتری متفرقه';
      const majorCat = classifyMajorCategory(row.GroupName, row.ItemName);

      if (invNum) invoicesSet.add(invNum);
      if (custName) customersSet.add(custName);

      // Accumulate Selected Range
      if (isReturn) {
        rangeRetAmt += amt;
        rangeRetWgt += qty;
      } else {
        rangeSalesAmt += amt;
        rangeSalesWgt += qty;
      }

      // Check dates for Today / Month / Quarter / Year
      const jRow = jalaali.toJalaali(rowDate.getFullYear(), rowDate.getMonth() + 1, rowDate.getDate());
      
      // Today
      if (jRow.jy === jNow.jy && jRow.jm === jNow.jm && jRow.jd === jNow.jd) {
        if (isReturn) {
          todayRetAmt += amt; todayRetWgt += qty;
        } else {
          todayNetAmt += amt; todayNetWgt += qty;
        }
      }

      // Yesterday
      if (jRow.jy === jYesterday.jy && jRow.jm === jYesterday.jm && jRow.jd === jYesterday.jd) {
        if (isReturn) {
          yesterdayRetAmt += amt; yesterdayRetWgt += qty;
        } else {
          yesterdayNetAmt += amt; yesterdayNetWgt += qty;
        }
      }

      // Month
      if (jRow.jy === jNow.jy && jRow.jm === jNow.jm) {
        if (isReturn) monthNetAmt -= amt; else monthNetAmt += amt;
        if (isReturn) monthNetWgt -= qty; else monthNetWgt += qty;
      }

      // Quarter
      const currentQuarter = Math.ceil(jNow.jm / 3);
      const rowQuarter = Math.ceil(jRow.jm / 3);
      if (jRow.jy === jNow.jy && rowQuarter === currentQuarter) {
        if (isReturn) quarterNetAmt -= amt; else quarterNetAmt += amt;
        if (isReturn) quarterNetWgt -= qty; else quarterNetWgt += qty;
      }

      // Year
      if (jRow.jy === jNow.jy) {
        if (isReturn) yearNetAmt -= amt; else yearNetAmt += amt;
        if (isReturn) yearNetWgt -= qty; else yearNetWgt += qty;
      }

      // Item Accumulation
      const itemKey = row.ItemCode || row.ItemName || 'کالا';
      if (!itemMap.has(itemKey)) {
        itemMap.set(itemKey, {
          itemCode: row.ItemCode || '',
          itemName: row.ItemName || 'کالای بدون نام',
          groupName: row.GroupName || 'سایر',
          majorCategory: majorCat,
          salesQty: 0, salesAmt: 0, returnQty: 0, returnAmt: 0
        });
      }
      const itemRecord = itemMap.get(itemKey)!;
      if (isReturn) {
        itemRecord.returnQty += qty; itemRecord.returnAmt += amt;
      } else {
        itemRecord.salesQty += qty; itemRecord.salesAmt += amt;
      }

      // Major Category Accumulation
      if (!categoryMap.has(majorCat)) {
        categoryMap.set(majorCat, {
          name: majorCat, salesWgt: 0, salesAmt: 0, retWgt: 0, retAmt: 0, itemsMap: new Map()
        });
      }
      const catRecord = categoryMap.get(majorCat)!;
      if (isReturn) {
        catRecord.retWgt += qty; catRecord.retAmt += amt;
      } else {
        catRecord.salesWgt += qty; catRecord.salesAmt += amt;
      }

      // Sub-items inside category
      if (!catRecord.itemsMap.has(itemKey)) {
        catRecord.itemsMap.set(itemKey, { itemName: row.ItemName, salesWgt: 0, salesAmt: 0, retWgt: 0, retAmt: 0 });
      }
      const catSubItem = catRecord.itemsMap.get(itemKey)!;
      if (isReturn) {
        catSubItem.retWgt += qty; catSubItem.retAmt += amt;
      } else {
        catSubItem.salesWgt += qty; catSubItem.salesAmt += amt;
      }

      // Invoices List
      if (!invoiceListMap.has(invNum)) {
        invoiceListMap.set(invNum, {
          invoiceNum: invNum,
          date: toShamsiStr(row.Date),
          customerName: custName,
          city: row.City || 'نامشخص',
          salesExpert: row.SalesExpert || 'کارشناس فروش',
          grossAmt: 0, retAmt: 0, netAmt: 0, netWgt: 0,
          paymentStatus: row.PaymentStatus || 'تسویه شده'
        });
      }
      const invRecord = invoiceListMap.get(invNum)!;
      if (isReturn) {
        invRecord.retAmt += amt;
        invRecord.netAmt -= amt;
        invRecord.netWgt -= qty;
      } else {
        invRecord.grossAmt += amt;
        invRecord.netAmt += amt;
        invRecord.netWgt += qty;
      }
    });

    const rangeNetAmt = rangeSalesAmt - rangeRetAmt;
    const rangeNetWgt = rangeSalesWgt - rangeRetWgt;
    const rangeNetFee = rangeNetWgt > 0 ? (rangeNetAmt / rangeNetWgt) : 0;

    const todayNetCalculatedAmt = todayNetAmt - todayRetAmt;
    const todayNetCalculatedWgt = todayNetWgt - todayRetWgt;
    const todayNetFee = todayNetCalculatedWgt > 0 ? (todayNetCalculatedAmt / todayNetCalculatedWgt) : 0;

    const yesterdayNetCalculatedAmt = yesterdayNetAmt - yesterdayRetAmt;
    const yesterdayNetCalculatedWgt = yesterdayNetWgt - yesterdayRetWgt;
    const yesterdayNetFee = yesterdayNetCalculatedWgt > 0 ? (yesterdayNetCalculatedAmt / yesterdayNetCalculatedWgt) : 0;

    const monthNetFee = monthNetWgt > 0 ? (monthNetAmt / monthNetWgt) : 0;
    const quarterNetFee = quarterNetWgt > 0 ? (quarterNetAmt / quarterNetWgt) : 0;
    const yearNetFee = yearNetWgt > 0 ? (yearNetAmt / yearNetWgt) : 0;

    const invoiceCount = invoicesSet.size;
    const customerCount = customersSet.size;
    const avgInvoiceAmt = invoiceCount > 0 ? (rangeNetAmt / invoiceCount) : 0;
    const avgInvoiceWgt = invoiceCount > 0 ? (rangeNetWgt / invoiceCount) : 0;

    // Build Category Breakdown List
    const categoryList = Array.from(categoryMap.values()).map(c => {
      const netAmt = c.salesAmt - c.retAmt;
      const netWgt = c.salesWgt - c.retWgt;
      const netFee = netWgt > 0 ? (netAmt / netWgt) : 0;
      const sharePct = rangeNetAmt > 0 ? ((netAmt / rangeNetAmt) * 100) : 0;

      const itemsList = Array.from(c.itemsMap.values()).map(sub => {
        const sNetAmt = sub.salesAmt - sub.retAmt;
        const sNetWgt = sub.salesWgt - sub.retWgt;
        const sNetFee = sNetWgt > 0 ? (sNetAmt / sNetWgt) : 0;
        const sSharePct = netAmt > 0 ? ((sNetAmt / netAmt) * 100) : 0;
        return {
          itemName: sub.itemName,
          salesWgt: sub.salesWgt,
          retWgt: sub.retWgt,
          netWgt: sNetWgt,
          salesAmt: sub.salesAmt,
          retAmt: sub.retAmt,
          netAmt: sNetAmt,
          netFee: sNetFee,
          sharePct: sSharePct
        };
      }).filter(item => Math.abs(item.netAmt) > 0 || Math.abs(item.netWgt) > 0);

      return {
        name: c.name,
        salesWgt: c.salesWgt,
        retWgt: c.retWgt,
        netWgt,
        salesAmt: c.salesAmt,
        retAmt: c.retAmt,
        netAmt,
        netFee,
        sharePct,
        items: itemsList
      };
    }).filter(c => Math.abs(c.netAmt) > 0 || Math.abs(c.netWgt) > 0 || c.salesAmt > 0);

    // Build Detailed Items List
    const itemList = Array.from(itemMap.values()).map(i => {
      const netAmt = i.salesAmt - i.returnAmt;
      const netWgt = i.salesQty - i.returnQty;
      const netFee = netWgt > 0 ? (netAmt / netWgt) : 0;
      const sharePct = rangeNetAmt > 0 ? ((netAmt / rangeNetAmt) * 100) : 0;
      return {
        itemCode: i.itemCode,
        itemName: i.itemName,
        groupName: i.groupName,
        majorCategory: i.majorCategory,
        salesQty: i.salesQty,
        salesAmt: i.salesAmt,
        returnQty: i.returnQty,
        returnAmt: i.returnAmt,
        netQty: netWgt,
        netAmt,
        netFee,
        sharePct
      };
    }).filter(i => Math.abs(i.netAmt) > 0 || Math.abs(i.netQty) > 0);

    // Build Invoices Array
    const invoicesList = Array.from(invoiceListMap.values());

    // Compute Executive Automated Insights
    const sortedByAmt = [...itemList].sort((a, b) => b.netAmt - a.netAmt);
    const sortedByWgt = [...itemList].sort((a, b) => b.netQty - a.netQty);
    const sortedByFee = [...itemList].filter(i => i.netQty > 10).sort((a, b) => b.netFee - a.netFee);
    const sortedByReturn = [...itemList].sort((a, b) => b.returnAmt - a.returnAmt);
    const sortedCategories = [...categoryList].sort((a, b) => b.netAmt - a.netAmt);

    const topProductByAmt = sortedByAmt[0]?.itemName || 'ثبت نشده';
    const topProductByWgt = sortedByWgt[0]?.itemName || 'ثبت نشده';
    const topProductByFee = sortedByFee[0] ? `${sortedByFee[0].itemName} (${formatMoney(sortedByFee[0].netFee)} ریال/ک‌گ)` : 'ثبت نشده';
    const topReturnProduct = sortedByReturn[0] ? `${sortedByReturn[0].itemName} (${formatMoney(sortedByReturn[0].returnAmt)} ریال)` : 'بدون مرجوعی';
    const topGroup = sortedCategories[0]?.name || 'ثبت نشده';
    const lowestGroup = sortedCategories[sortedCategories.length - 1]?.name || 'ثبت نشده';
    const returnRatePct = rangeSalesAmt > 0 ? ((rangeRetAmt / rangeSalesAmt) * 100) : 0;

    return {
      todayNetAmt: todayNetCalculatedAmt,
      todayNetWgt: todayNetCalculatedWgt,
      todayNetFee,
      todayRetAmt,
      yesterdayNetAmt: yesterdayNetCalculatedAmt,
      yesterdayNetWgt: yesterdayNetCalculatedWgt,
      yesterdayNetFee,
      monthNetAmt,
      monthNetWgt,
      monthNetFee,
      quarterNetAmt,
      quarterNetWgt,
      quarterNetFee,
      yearNetAmt,
      yearNetWgt,
      yearNetFee,
      rangeNetAmt,
      rangeNetWgt,
      rangeNetFee,
      rangeSalesAmt,
      rangeRetAmt,
      rangeRetWgt,
      invoiceCount,
      customerCount,
      avgInvoiceAmt,
      avgInvoiceWgt,
      categoryList,
      itemList,
      invoicesList,
      insights: {
        topProductByAmt,
        topProductByWgt,
        topProductByFee,
        topReturnProduct,
        topGroup,
        lowestGroup,
        returnRatePct
      }
    };
  }, [salesData]);

  // ----------------------------------------------------------------------
  // COMPARISON COMPUTATIONS (Period A vs Period B)
  // ----------------------------------------------------------------------
  const comparisonMetrics = useMemo(() => {
    if (!compareMode || !compareDataB || compareDataB.length === 0) return null;

    let netAmtB = 0, netWgtB = 0, salesAmtB = 0, retAmtB = 0, salesWgtB = 0, retWgtB = 0;
    const catMapB = new Map<string, { salesWgt: number; salesAmt: number; retWgt: number; retAmt: number; }>();
    const itemMapB = new Map<string, { itemCode: string; itemName: string; groupName: string; majorCategory: string; salesQty: number; salesAmt: number; returnQty: number; returnAmt: number; }>();

    compareDataB.forEach(row => {
      const amt = parseFloat(row.Amount || '0') || 0;
      const qty = parseFloat(row.Quantity || '0') || 0;
      // OpCode 13 is Sales Return (مرجوعی از فروش). OpCode 14 is Purchase (خرید) and must not be treated as return.
      const isReturn = row.OpCode === '13';
      const cat = classifyMajorCategory(row.GroupName, row.ItemName);
      const itemKey = row.ItemCode || row.ItemName || 'کالا';

      if (isReturn) {
        retAmtB += amt;
        retWgtB += qty;
        netAmtB -= amt;
        netWgtB -= qty;
      } else {
        salesAmtB += amt;
        salesWgtB += qty;
        netAmtB += amt;
        netWgtB += qty;
      }

      // Group Map B
      if (!catMapB.has(cat)) {
        catMapB.set(cat, { salesWgt: 0, salesAmt: 0, retWgt: 0, retAmt: 0 });
      }
      const catRecord = catMapB.get(cat)!;
      if (isReturn) {
        catRecord.retWgt += qty; catRecord.retAmt += amt;
      } else {
        catRecord.salesWgt += qty; catRecord.salesAmt += amt;
      }

      // Item Map B
      if (!itemMapB.has(itemKey)) {
        itemMapB.set(itemKey, {
          itemCode: row.ItemCode || '',
          itemName: row.ItemName || 'کالای بدون نام',
          groupName: row.GroupName || 'سایر',
          majorCategory: cat,
          salesQty: 0, salesAmt: 0, returnQty: 0, returnAmt: 0
        });
      }
      const itemRecord = itemMapB.get(itemKey)!;
      if (isReturn) {
        itemRecord.returnQty += qty; itemRecord.returnAmt += amt;
      } else {
        itemRecord.salesQty += qty; itemRecord.salesAmt += amt;
      }
    });

    const avgFeeB = netWgtB > 0 ? (netAmtB / netWgtB) : 0;

    const netAmtA = processedMetrics.rangeNetAmt;
    const netWgtA = processedMetrics.rangeNetWgt;
    const avgFeeA = processedMetrics.rangeNetFee;

    const amtDiff = netAmtA - netAmtB;
    const amtGrowthPct = netAmtB ? ((amtDiff / netAmtB) * 100) : 0;

    const wgtDiff = netWgtA - netWgtB;
    const wgtGrowthPct = netWgtB ? ((wgtDiff / netWgtB) * 100) : 0;

    const feeDiff = avgFeeA - avgFeeB;
    const feeGrowthPct = avgFeeB ? ((feeDiff / avgFeeB) * 100) : 0;

    const getVariance = (dAmt: number, dWgt: number, dFee: number) => {
      if (dAmt > 0 && dWgt > 0 && dFee > 0) return { label: 'رشد متوازن (نرخ + حجم)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      if (dAmt > 0 && dWgt > 0 && dFee <= 0) return { label: 'رشد حجمی (قیمت رقابتی)', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      if (dAmt > 0 && dWgt <= 0 && dFee > 0) return { label: 'رشد مبلغمحور (افزایش نرخ)', color: 'bg-purple-100 text-purple-800 border-purple-300' };
      if (dAmt < 0 && dWgt < 0 && dFee < 0) return { label: 'افت شدید (نرخ + حجم)', color: 'bg-rose-100 text-rose-800 border-rose-300' };
      if (dAmt < 0 && dWgt < 0) return { label: 'افت حجمی فروش', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      if (dAmt < 0) return { label: 'انحراف کاهشی درآمد', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      return { label: 'ثبات نسبی عملکرد', color: 'bg-slate-100 text-slate-700 border-slate-300' };
    };

    // Mode 1: Group comparison rows (Level-2 15 Major Categories)
    const compareGroupRows = MAJOR_CATEGORIES.map(catName => {
      const catA = processedMetrics.categoryList.find(c => c.name === catName) || { salesAmt: 0, retAmt: 0, netAmt: 0, salesWgt: 0, retWgt: 0, netWgt: 0, netFee: 0 };
      const catBRecord = catMapB.get(catName);
      const grossAmtB = catBRecord ? catBRecord.salesAmt : 0;
      const retAmtB_row = catBRecord ? catBRecord.retAmt : 0;
      const grossWgtB = catBRecord ? catBRecord.salesWgt : 0;
      const retWgtB_row = catBRecord ? catBRecord.retWgt : 0;

      const catBNetAmt = grossAmtB - retAmtB_row;
      const catBNetWgt = grossWgtB - retWgtB_row;
      const catBNetFee = catBNetWgt > 0 ? (catBNetAmt / catBNetWgt) : 0;

      const diffAmt = catA.netAmt - catBNetAmt;
      const growthPct = catBNetAmt ? ((diffAmt / catBNetAmt) * 100) : 0;
      const diffWgt = catA.netWgt - catBNetWgt;
      const wgtGrowthPctRow = catBNetWgt ? ((diffWgt / catBNetWgt) * 100) : 0;
      const diffFee = catA.netFee - catBNetFee;

      const sharePctA = netAmtA > 0 ? ((catA.netAmt / netAmtA) * 100) : 0;
      const sharePctB = netAmtB > 0 ? ((catBNetAmt / netAmtB) * 100) : 0;

      return {
        catName,
        grossAmtA: catA.salesAmt,
        retAmtA: catA.retAmt,
        netAmtA: catA.netAmt,
        grossWgtA: catA.salesWgt,
        retWgtA: catA.retWgt,
        netWgtA: catA.netWgt,
        netFeeA: catA.netFee,
        sharePctA,
        grossAmtB,
        retAmtB: retAmtB_row,
        netAmtB: catBNetAmt,
        grossWgtB,
        retWgtB: retWgtB_row,
        netWgtB: catBNetWgt,
        netFeeB: catBNetFee,
        sharePctB,
        diffAmt,
        growthPct,
        diffWgt,
        wgtGrowthPctRow,
        diffFee,
        variance: getVariance(diffAmt, diffWgt, diffFee)
      };
    }).filter(r => Math.abs(r.netAmtA) > 0 || Math.abs(r.netAmtB) > 0);

    // Mode 2: Item Detail comparison rows (All individual products)
    const allItemKeys = new Set<string>([
      ...processedMetrics.itemList.map(i => i.itemCode || i.itemName),
      ...Array.from(itemMapB.keys())
    ]);

    const compareItemRows = Array.from(allItemKeys).map(itemKey => {
      const itemA = processedMetrics.itemList.find(i => (i.itemCode || i.itemName) === itemKey) || {
        itemCode: '', itemName: itemKey, groupName: '', majorCategory: '', salesAmt: 0, returnAmt: 0, netAmt: 0, salesQty: 0, returnQty: 0, netQty: 0, netFee: 0
      };
      const itemBRecord = itemMapB.get(itemKey);
      const grossAmtB = itemBRecord ? itemBRecord.salesAmt : 0;
      const retAmtB_row = itemBRecord ? itemBRecord.returnAmt : 0;
      const grossWgtB = itemBRecord ? itemBRecord.salesQty : 0;
      const retWgtB_row = itemBRecord ? itemBRecord.returnQty : 0;

      const netAmtB_row = grossAmtB - retAmtB_row;
      const netWgtB_row = grossWgtB - retWgtB_row;
      const netFeeB_row = netWgtB_row > 0 ? (netAmtB_row / netWgtB_row) : 0;

      const diffAmt = itemA.netAmt - netAmtB_row;
      const growthPct = netAmtB_row ? ((diffAmt / netAmtB_row) * 100) : 0;
      const diffWgt = itemA.netQty - netWgtB_row;
      const diffFee = itemA.netFee - netFeeB_row;

      return {
        itemCode: itemA.itemCode || (itemBRecord ? itemBRecord.itemCode : ''),
        itemName: itemA.itemName || (itemBRecord ? itemBRecord.itemName : itemKey),
        majorCategory: itemA.majorCategory || (itemBRecord ? itemBRecord.majorCategory : 'سایر'),
        grossAmtA: itemA.salesAmt,
        retAmtA: itemA.returnAmt,
        netAmtA: itemA.netAmt,
        netWgtA: itemA.netQty,
        netFeeA: itemA.netFee,
        grossAmtB,
        retAmtB: retAmtB_row,
        netAmtB: netAmtB_row,
        netWgtB: netWgtB_row,
        netFeeB: netFeeB_row,
        diffAmt,
        growthPct,
        diffWgt,
        diffFee,
        variance: getVariance(diffAmt, diffWgt, diffFee)
      };
    }).filter(r => Math.abs(r.netAmtA) > 0 || Math.abs(r.netAmtB) > 0);

    return {
      netAmtA, netAmtB, amtDiff, amtGrowthPct,
      netWgtA, netWgtB, wgtDiff, wgtGrowthPct,
      avgFeeA, avgFeeB, feeDiff, feeGrowthPct,
      compareRows: compareGroupRows,
      compareGroupRows,
      compareItemRows
    };
  }, [compareMode, compareDataB, processedMetrics]);

  // ----------------------------------------------------------------------
  // QUICK PRESET SELECTION
  // ----------------------------------------------------------------------
  const handleSelectPreset = (presetKey: string) => {
    setSelectedPreset(presetKey);
    const now = new Date();
    const jNow = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());

    let fromStr = '';
    let toStr = '';

    const pad = (n: number) => String(n).padStart(2, '0');

    if (presetKey === 'today') {
      fromStr = `${jNow.jy}/${pad(jNow.jm)}/${pad(jNow.jd)}`;
      toStr = fromStr;
    } else if (presetKey === 'yesterday') {
      const yDate = new Date(now);
      yDate.setDate(yDate.getDate() - 1);
      const jY = jalaali.toJalaali(yDate.getFullYear(), yDate.getMonth() + 1, yDate.getDate());
      fromStr = `${jY.jy}/${pad(jY.jm)}/${pad(jY.jd)}`;
      toStr = fromStr;
    } else if (presetKey === 'this_week') {
      // Current Saturday to Today
      const dayOfWeek = now.getDay(); // 0 is Sun, 6 is Sat
      const distSat = (dayOfWeek + 1) % 7;
      const satDate = new Date(now);
      satDate.setDate(satDate.getDate() - distSat);
      const jSat = jalaali.toJalaali(satDate.getFullYear(), satDate.getMonth() + 1, satDate.getDate());
      fromStr = `${jSat.jy}/${pad(jSat.jm)}/${pad(jSat.jd)}`;
      toStr = `${jNow.jy}/${pad(jNow.jm)}/${pad(jNow.jd)}`;
    } else if (presetKey === 'this_month') {
      fromStr = `${jNow.jy}/${pad(jNow.jm)}/01`;
      toStr = `${jNow.jy}/${pad(jNow.jm)}/${pad(jNow.jd)}`;
    } else if (presetKey === 'last_month') {
      let prevM = jNow.jm - 1;
      let prevY = jNow.jy;
      if (prevM < 1) { prevM = 12; prevY -= 1; }
      fromStr = `${prevY}/${pad(prevM)}/01`;
      const daysInPrev = jalaali.jalaaliMonthLength(prevY, prevM);
      toStr = `${prevY}/${pad(prevM)}/${pad(daysInPrev)}`;
    } else if (presetKey === 'this_year') {
      fromStr = `${jNow.jy}/01/01`;
      toStr = `${jNow.jy}/${pad(jNow.jm)}/${pad(jNow.jd)}`;
    } else if (presetKey === 'last_year') {
      const prevY = jNow.jy - 1;
      fromStr = `${prevY}/01/01`;
      toStr = `${prevY}/12/29`;
    }

    if (fromStr && toStr && onDateRangeChange) {
      onDateRangeChange(fromStr, toStr);
    }
  };

  // ----------------------------------------------------------------------
  // EXPORT TO EXCEL
  // ----------------------------------------------------------------------
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Major Categories
      const catData = processedMetrics.categoryList.map((c, i) => ({
        'ردیف': i + 1,
        'گروه اصلی کالا': c.name,
        'وزن فروش (ک‌گ)': c.salesWgt,
        'وزن مرجوعی (ک‌گ)': c.retWgt,
        'وزن خالص (ک‌گ)': c.netWgt,
        'مبلغ فروش (ریال)': c.salesAmt,
        'مبلغ مرجوعی (ریال)': c.retAmt,
        'فروش خالص (ریال)': c.netAmt,
        'فی نهایی (ریال/ک‌گ)': Math.round(c.netFee),
        'سهم از کل %': c.sharePct.toFixed(1) + '%'
      }));
      const wsCat = XLSX.utils.json_to_sheet(catData);
      XLSX.utils.book_append_sheet(wb, wsCat, 'گروههای اصلی');

      // Sheet 2: Detailed Items
      const itemData = processedMetrics.itemList.map((i, idx) => ({
        'ردیف': idx + 1,
        'کد کالا': i.itemCode,
        'نام کالا': i.itemName,
        'گروه اصلی': i.majorCategory,
        'وزن فروش (ک‌گ)': i.salesQty,
        'وزن مرجوعی (ک‌گ)': i.returnQty,
        'وزن خالص (ک‌گ)': i.netQty,
        'مبلغ فروش (ریال)': i.salesAmt,
        'مبلغ مرجوعی (ریال)': i.returnAmt,
        'فروش خالص (ریال)': i.netAmt,
        'فی نهایی (ریال/ک‌گ)': Math.round(i.netFee),
        'سهم %': i.sharePct.toFixed(1) + '%'
      }));
      const wsItem = XLSX.utils.json_to_sheet(itemData);
      XLSX.utils.book_append_sheet(wb, wsItem, 'ریز کالاها');

      // Sheet 3: Invoices
      const invData = processedMetrics.invoicesList.map((inv, idx) => ({
        'ردیف': idx + 1,
        'شماره فاکتور': inv.invoiceNum,
        'تاریخ': inv.date,
        'نام مشتری': inv.customerName,
        'شهر/استان': inv.city,
        'کارشناس فروش': inv.salesExpert,
        'مبلغ ناخالص (ریال)': inv.grossAmt,
        'مرجوعی (ریال)': inv.retAmt,
        'فروش خالص (ریال)': inv.netAmt,
        'وزن خالص (ک‌گ)': inv.netWgt,
        'وضعیت تسویه': inv.paymentStatus
      }));
      const wsInv = XLSX.utils.json_to_sheet(invData);
      XLSX.utils.book_append_sheet(wb, wsInv, 'لیست فاکتورها');

      XLSX.writeFile(wb, `Sayan_Sales_Executive_${dateFrom.replace(/\//g, '-')}_to_${dateTo.replace(/\//g, '-')}.xlsx`);
      toast.success('فایل اکسل با موفقیت تولید و دانلود شد.');
    } catch (e: any) {
      toast.error(`خطا در تولید فایل اکسل: ${e.message}`);
    }
  };

  // ----------------------------------------------------------------------
  // PRINT EXECUTIVE REPORT
  // ----------------------------------------------------------------------
  const handlePrint = () => {
    if (compareMode && comparisonMetrics) {
      // Comparative Print Report
      const docHtml = `
        <html dir="rtl" lang="fa">
        <head>
          <meta charset="utf-8">
          <title>گزارش تحلیلی و مقایسه‌ای فروش سایان ERP</title>
          <style>
            body { font-family: 'Tahoma', sans-serif; padding: 20px; background: #fff; color: #1e293b; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
            .header h1 { font-size: 18px; margin: 0; color: #0f172a; }
            .header p { font-size: 11px; color: #64748b; margin: 4px 0 0; }
            .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
            .kpi-card { border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #f8fafc; text-align: center; }
            .kpi-title { font-size: 10px; color: #64748b; font-weight: bold; }
            .kpi-val { font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: right; }
            th { background-color: #0f172a; color: #fff; font-weight: bold; }
            tr:nth-child(even) { background-color: #f1f5f9; }
            .total { font-weight: bold; background: #e2e8f0 !important; }
            .growth-pos { color: #15803d; font-weight: bold; }
            .growth-neg { color: #b91c1c; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>گزارش تحلیلی و مقایسه‌ای فروش سایان ERP (دوره A vs دوره B)</h1>
            <p>دوره A (پایه): از ${dateFrom} تا ${dateTo} | دوره B (تطبیقی): از ${salesDateFromB} تا ${salesDateToB}</p>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-title">فروش کل دوره A</div>
              <div class="kpi-val">${formatMoney(comparisonMetrics ? comparisonMetrics.netAmtA : 0)} ریال</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">فروش کل دوره B</div>
              <div class="kpi-val">${formatMoney(comparisonMetrics ? comparisonMetrics.netAmtB : 0)} ریال</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">نرخ رشد درآمد (A نسبت به B)</div>
              <div class="kpi-val ${comparisonMetrics && comparisonMetrics.amtGrowthPct >= 0 ? 'growth-pos' : 'growth-neg'}">
                ${comparisonMetrics ? (comparisonMetrics.amtGrowthPct >= 0 ? '+' : '') + comparisonMetrics.amtGrowthPct.toFixed(1) + '%' : '0%'}
              </div>
            </div>
          </div>

          <h2>مقایسه عملکرد به تفکیک گروههای کالا</h2>
          <table>
            <thead>
              <tr>
                <th>ردیف</th>
                <th>نام گروه کالا</th>
                <th>وزن خالص A (ک‌گ)</th>
                <th>فروش خالص A (ریال)</th>
                <th>فی A (ریال)</th>
                <th>وزن خالص B (ک‌گ)</th>
                <th>فروش خالص B (ریال)</th>
                <th>فی B (ریال)</th>
                <th>درصد رشد (%)</th>
              </tr>
            </thead>
            <tbody>
              ${comparisonMetrics.compareGroupRows.map((r, idx) => `
                <tr>
                  <td style="text-align:center;">${idx + 1}</td>
                  <td>${r.catName}</td>
                  <td style="text-align:center;">${formatWeight(r.netWgtA)}</td>
                  <td style="text-align:left;">${formatMoney(r.netAmtA)}</td>
                  <td style="text-align:left;">${formatMoney(r.netFeeA)}</td>
                  <td style="text-align:center;">${formatWeight(r.netWgtB)}</td>
                  <td style="text-align:left;">${formatMoney(r.netAmtB)}</td>
                  <td style="text-align:left;">${formatMoney(r.netFeeB)}</td>
                  <td style="text-align:center;" class="${r.growthPct >= 0 ? 'growth-pos' : 'growth-neg'}">
                    ${r.growthPct >= 0 ? '+' : ''}${r.growthPct.toFixed(1)}%
                  </td>
                </tr>
              `).join('')}
              <tr class="total">
                <td colspan="2">جمع کل</td>
                <td style="text-align:center;">${formatWeight(comparisonMetrics ? comparisonMetrics.netWgtA : 0)}</td>
                <td style="text-align:left;">${formatMoney(comparisonMetrics ? comparisonMetrics.netAmtA : 0)}</td>
                <td style="text-align:left;">-</td>
                <td style="text-align:center;">${formatWeight(comparisonMetrics ? comparisonMetrics.netWgtB : 0)}</td>
                <td style="text-align:left;">${formatMoney(comparisonMetrics ? comparisonMetrics.netAmtB : 0)}</td>
                <td style="text-align:left;">-</td>
                <td style="text-align:center;" class="${comparisonMetrics && comparisonMetrics.amtGrowthPct >= 0 ? 'growth-pos' : 'growth-neg'}">
                  ${comparisonMetrics ? (comparisonMetrics.amtGrowthPct >= 0 ? '+' : '') + comparisonMetrics.amtGrowthPct.toFixed(1) + '%' : '0%'}
                </td>
              </tr>
            </tbody>
          </table>
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
      return;
    }

    // Single Period Standard Report
    const docHtml = `
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="utf-8">
        <title>داشبورد مدیریتی فروش سایان ERP</title>
        <style>
          body { font-family: 'Tahoma', sans-serif; padding: 20px; background: #fff; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          .header h1 { font-size: 18px; margin: 0; color: #0f172a; }
          .header p { font-size: 11px; color: #64748b; margin: 4px 0 0; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .kpi-card { border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #f8fafc; text-align: center; }
          .kpi-title { font-size: 10px; color: #64748b; font-weight: bold; }
          .kpi-val { font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
          th { background-color: #0f172a; color: #fff; font-weight: bold; }
          tr:nth-child(even) { background-color: #f1f5f9; }
          .total { font-weight: bold; background: #e2e8f0 !important; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>داشبورد تصمیم‌گیری و گزارشات مدیریتی فروش سایان ERP</h1>
          <p>بازه گزارش: از ${dateFrom} تا ${dateTo} | تاریخ چاپ: ${toShamsiStr(new Date().toISOString())}</p>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-title">فروش خالص بازه</div><div class="kpi-val">${formatMoney(processedMetrics.rangeNetAmt)} ریال</div></div>
          <div class="kpi-card"><div class="kpi-title">وزن خالص بازه</div><div class="kpi-val">${formatWeight(processedMetrics.rangeNetWgt)} ک‌گ</div></div>
          <div class="kpi-card"><div class="kpi-title">فی نهایی میانگین</div><div class="kpi-val">${formatMoney(processedMetrics.rangeNetFee)} ریال/ک‌گ</div></div>
          <div class="kpi-card"><div class="kpi-title">تعداد فاکتورها</div><div class="kpi-val">${processedMetrics.invoiceCount} عدد</div></div>
        </div>

        <h2>جدول عملکرد گروههای اصلی کالا (15 گروه)</h2>
        <table>
          <thead>
            <tr>
              <th>ردیف</th>
              <th>نام گروه اصلی</th>
              <th>وزن خالص (ک‌گ)</th>
              <th>فروش خالص (ریال)</th>
              <th>فی نهایی (ریال/ک‌گ)</th>
              <th>سهم %</th>
            </tr>
          </thead>
          <tbody>
            ${processedMetrics.categoryList.map((cat, idx) => `
              <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td>${cat.name}</td>
                <td style="text-align:center;">${formatWeight(cat.netWgt)}</td>
                <td style="text-align:left;">${formatMoney(cat.netAmt)}</td>
                <td style="text-align:left;">${formatMoney(cat.netFee)}</td>
                <td style="text-align:center;">${cat.sharePct.toFixed(1)}%</td>
              </tr>
            `).join('')}
            <tr class="total">
              <td colspan="2">جمع کل</td>
              <td style="text-align:center;">${formatWeight(processedMetrics.rangeNetWgt)}</td>
              <td style="text-align:left;">${formatMoney(processedMetrics.rangeNetAmt)}</td>
              <td style="text-align:left;">${formatMoney(processedMetrics.rangeNetFee)}</td>
              <td style="text-align:center;">100%</td>
            </tr>
          </tbody>
        </table>
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

  // ----------------------------------------------------------------------
  // DOWNLOAD COMPARATIVE PDF
  // ----------------------------------------------------------------------
  const handleDownloadComparePdf = async () => {
    try {
      toast('در حال تولید و دانلود فایل PDF مقایسه‌ای...', { icon: '⏳' });
      const groupRows = comparisonMetrics ? comparisonMetrics.compareGroupRows : [];
      const response = await fetch('/api/sayan/sales-report/download-compare-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chartData: groupRows.map(r => ({
            name: r.catName,
            netWeightA: r.netWgtA,
            netAmountA: r.netAmtA,
            retWeightA: r.retWgtA,
            netWeightB: r.netWgtB,
            netAmountB: r.netAmtB,
            retWeightB: r.retWgtB,
            netFeeA: r.netFeeA,
            netFeeB: r.netFeeB
          })),
          dateFromA: dateFrom,
          dateToA: dateTo,
          dateFromB: salesDateFromB,
          dateToB: salesDateToB
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'خطا در دریافت فایل PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Compare_Sales_Report_${dateFrom.replace(/\//g, '-')}_vs_${(salesDateFromB || 'B').replace(/\//g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('فایل PDF مقایسه‌ای با موفقیت دانلود گردید.');
    } catch (e: any) {
      toast.error(`خطا در دریافت PDF: ${e.message}`);
    }
  };

  // ----------------------------------------------------------------------
  // BOT DISPATCH HANDLERS
  // ----------------------------------------------------------------------
  const handleSendCompareToBots = async () => {
    setIsSendingBot(true);
    try {
      const groupRows = comparisonMetrics ? comparisonMetrics.compareGroupRows : [];
      const response = await fetch('/api/sayan/sales-report/send-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chartData: groupRows.map(r => ({
            name: r.catName,
            netWeightA: r.netWgtA,
            netAmountA: r.netAmtA,
            retWeightA: r.retWgtA,
            netWeightB: r.netWgtB,
            netAmountB: r.netAmtB,
            retWeightB: r.retWgtB,
            netFeeA: r.netFeeA,
            netFeeB: r.netFeeB
          })),
          dateFromA: dateFrom,
          dateToA: dateTo,
          dateFromB: salesDateFromB,
          dateToB: salesDateToB,
          selectedPlatforms
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'خطا در ارسال گزارش مقایسه‌ای به پیام‌رسان‌ها');

      const failed = resData.sendDetails?.filter((d: any) => d.status === 'failed') || [];
      const successes = resData.sendDetails?.filter((d: any) => d.status === 'success') || [];

      if (failed.length > 0) {
        const successMsg = successes.map((s: any) => s.platform === 'telegram' ? 'تلگرام' : s.platform === 'bale' ? 'بله' : s.platform).join(' و ');
        const failMsg = failed.map((f: any) => `${f.platform === 'telegram' ? 'تلگرام' : f.platform === 'bale' ? 'بله' : f.platform} (خطا: ${f.error || 'نامشخص'})`).join('، ');
        if (successes.length > 0) {
          toast(`گزارش مقایسه‌ای به ${successMsg} ارسال شد، اما در ارسال به ${failMsg} خطا رخ داد.`, { icon: '⚠️', duration: 10000 });
        } else {
          toast.error(`ارسال گزارش مقایسه‌ای ناموفق بود: ${failMsg}`, { duration: 10000 });
        }
      } else {
        toast.success(resData.message || 'گزارش مقایسه‌ای با موفقیت به پیام‌رسان‌ها ارسال گردید.');
      }
      setIsBotModalOpen(false);
    } catch (e: any) {
      toast.error(`خطا در ارسال گزارش مقایسه‌ای: ${e.message}`);
    } finally {
      setIsSendingBot(false);
    }
  };

  const handleSendManualReport = async (targetDate: 'today' | 'yesterday' | 'custom') => {
    setIsSendingBot(true);
    try {
      let bodyData: any = { selectedPlatforms };
      if (targetDate === 'today') {
        bodyData.targetDate = 'today';
        bodyData.label = 'امروز';
      } else if (targetDate === 'yesterday') {
        bodyData.targetDate = 'yesterday';
        bodyData.label = 'دیروز';
      } else {
        bodyData.date = dateFrom;
        bodyData.label = `بازه ${dateFrom} تا ${dateTo}`;
      }

      const response = await fetch('/api/sayan/sales-report/send-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || resData.message || 'خطا در ارسال دستی گزارش');

      const failed = resData.result?.sendDetails?.filter((d: any) => d.status === 'failed') || [];
      const successes = resData.result?.sendDetails?.filter((d: any) => d.status === 'success') || [];

      if (failed.length > 0) {
        const successMsg = successes.map((s: any) => s.platform === 'telegram' ? 'تلگرام' : s.platform === 'bale' ? 'بله' : s.platform).join(' و ');
        const failMsg = failed.map((f: any) => `${f.platform === 'telegram' ? 'تلگرام' : f.platform === 'bale' ? 'بله' : f.platform} (خطا: ${f.error || 'نامشخص'})`).join('، ');
        if (successes.length > 0) {
          toast(`گزارش دستی به ${successMsg} ارسال شد، اما در ارسال به ${failMsg} خطا رخ داد.`, { icon: '⚠️', duration: 10000 });
        } else {
          toast.error(`ارسال گزارش دستی ناموفق بود: ${failMsg}`, { duration: 10000 });
        }
      } else {
        toast.success(resData.message || 'گزارش با موفقیت به پیام‌رسان‌ها ارسال شد.');
      }
      setIsBotModalOpen(false);
    } catch (e: any) {
      toast.error(`خطا در ارسال دستی گزارش: ${e.message}`);
    } finally {
      setIsSendingBot(false);
    }
  };

  const handleSendToBots = async () => {
    if (compareMode) {
      await handleSendCompareToBots();
      return;
    }

    setIsSendingBot(true);
    try {
      const response = await fetch('/api/sayan/sales-report/send-executive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom,
          dateTo,
          selectedPlatforms,
          summary: {
            netAmount: processedMetrics.rangeNetAmt,
            netWeight: processedMetrics.rangeNetWgt,
            avgFee: processedMetrics.rangeNetFee,
            invoiceCount: processedMetrics.invoiceCount,
            customerCount: processedMetrics.customerCount,
            avgInvoiceAmt: processedMetrics.avgInvoiceAmt,
            topGroup: processedMetrics.insights.topGroup,
            topProduct: processedMetrics.insights.topProductByAmt,
            returnAmount: processedMetrics.rangeRetAmt,
            returnWeight: processedMetrics.rangeRetWgt
          },
          groupData: processedMetrics.categoryList.map(c => ({
            name: c.name,
            netWgt: c.netWgt,
            netAmt: c.netAmt,
            netFee: c.netFee,
            sharePct: c.sharePct
          }))
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'خطا در ارسال به پیام‌رسان‌ها');

      const failed = resData.sendDetails?.filter((d: any) => d.status === 'failed') || [];
      const successes = resData.sendDetails?.filter((d: any) => d.status === 'success') || [];

      if (failed.length > 0) {
        const successMsg = successes.map((s: any) => s.platform === 'telegram' ? 'تلگرام' : s.platform === 'bale' ? 'بله' : s.platform).join(' و ');
        const failMsg = failed.map((f: any) => `${f.platform === 'telegram' ? 'تلگرام' : f.platform === 'bale' ? 'بله' : f.platform} (خطا: ${f.error || 'نامشخص'})`).join('، ');
        if (successes.length > 0) {
          toast(`گزارش به ${successMsg} ارسال شد، اما در ارسال به ${failMsg} خطا رخ داد.`, { icon: '⚠️', duration: 10000 });
        } else {
          toast.error(`ارسال گزارش ناموفق بود: ${failMsg}`, { duration: 10000 });
        }
      } else {
        toast.success(resData.message || 'گزارش با موفقیت به پیام‌رسان‌ها ارسال گردید.');
      }
      setIsBotModalOpen(false);
    } catch (e: any) {
      toast.error(`خطا در ارسال گزارش: ${e.message}`);
    } finally {
      setIsSendingBot(false);
    }
  };

  // Filtered Items for Search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return processedMetrics.itemList;
    const q = searchQuery.toLowerCase();
    return processedMetrics.itemList.filter(i => 
      i.itemName.toLowerCase().includes(q) || 
      i.majorCategory.toLowerCase().includes(q) ||
      i.itemCode.toLowerCase().includes(q)
    );
  }, [processedMetrics.itemList, searchQuery]);

  // Filtered Invoices for Search
  const filteredInvoices = useMemo(() => {
    if (!searchQuery) return processedMetrics.invoicesList;
    const q = searchQuery.toLowerCase();
    return processedMetrics.invoicesList.filter(inv => 
      inv.invoiceNum.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.city.toLowerCase().includes(q) ||
      inv.salesExpert.toLowerCase().includes(q)
    );
  }, [processedMetrics.invoicesList, searchQuery]);

  // ----------------------------------------------------------------------
  // RENDER UI
  // ----------------------------------------------------------------------
  return (
    <div id="executive-sales-dashboard" className="space-y-6 text-right dir-rtl font-sans pb-12 p-2 bg-slate-50/50 rounded-2xl">
      
      {/* 1. TOP HEADER & DASHBOARD CONTROLS */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 rounded-2xl p-5 text-white shadow-xl border border-blue-800/40 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-300">
                <BarChart2 className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>داشبورد ارشد مدیریتی و تصمیم‌گیری فروش سایان ERP</span>
                  <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">نسخه سازمانی</span>
                </h1>
                <p className="text-xs text-blue-200/80 mt-1">
                  پایش هومیوستاتیک فروش خالص، وزن، مرجوعی کد ۱۳، فی نهایی نوسانی، و پایش مقایسه‌ای دو بازه
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              onClick={() => handleSendManualReport('today')}
              disabled={isSendingBot}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
              title="ارسال دستی خلاصه فروش امروز به پیام‌رسان‌های بله و تلگرام"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingBot ? 'در حال ارسال...' : 'ارسال دستی امروز به بات'}</span>
            </button>

            <button
              onClick={() => handleSendManualReport('yesterday')}
              disabled={isSendingBot}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
              title="ارسال دستی خلاصه فروش دیروز به پیام‌رسان‌های بله و تلگرام"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingBot ? 'در حال ارسال...' : 'ارسال دستی دیروز به بات'}</span>
            </button>

            <button
              onClick={() => setIsBotModalOpen(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-lg hover:shadow-emerald-500/20 transition-all cursor-pointer"
              title="تنظیمات پیشرفته و ارسال سفارشی گزارش به بات‌ها"
            >
              <Send className="w-4 h-4" />
              <span>ارسال به پیام‌رسان‌ها (تنظیمات)</span>
            </button>

            {compareMode && (
              <>
                <button
                  onClick={handleDownloadComparePdf}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-rose-500/20 transition-all cursor-pointer"
                  title="دانلود فایل PDF گزارش مقایسه‌ای دوره A vs دوره B"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود PDF مقایسه‌ای</span>
                </button>

                <button
                  onClick={handleSendToBots}
                  disabled={isSendingBot}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
                  title="ارسال فوری گزارش مقایسه‌ای دوره A vs B به پیام‌رسان‌ها"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ارسال مقایسه‌ای به بات</span>
                </button>
              </>
            )}

            <button
              onClick={handleExportImage}
              disabled={isExportingImage}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 border border-white/20 backdrop-blur-md transition-all cursor-pointer disabled:opacity-50"
              title="دانلود تصویر کل داشبورد با کیفیت بالا"
            >
              <ImageIcon className="w-4 h-4 text-purple-300" />
              <span>{isExportingImage ? 'در حال تصویربرداری...' : 'خروجی تصویر'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 border border-white/20 backdrop-blur-md transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>خروجی Excel</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 border border-white/20 backdrop-blur-md transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-300" />
              <span>خروجی CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 border border-white/20 backdrop-blur-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-blue-300" />
              <span>چاپ / PDF</span>
            </button>

            {onRefreshData && (
              <button
                onClick={onRefreshData}
                disabled={isLoading}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-all cursor-pointer disabled:opacity-50"
                title="به‌روزرسانی داده‌ها"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* DATE RANGE PRESETS & PICKERS */}
        <div className="mt-6 pt-4 border-t border-white/10 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            
            {/* Presets */}
            <div className="md:col-span-7 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-blue-300 ml-1">بازه اصلی (دوره A):</span>
              {[
                { id: 'today', label: 'امروز' },
                { id: 'yesterday', label: 'دیروز' },
                { id: 'this_week', label: 'این هفته' },
                { id: 'this_month', label: 'این ماه' },
                { id: 'last_month', label: 'ماه قبل' },
                { id: 'this_year', label: 'امسال' },
                { id: 'last_year', label: 'سال قبل' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPreset(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedPreset === p.id 
                      ? 'bg-blue-500 text-white shadow-md font-extrabold' 
                      : 'bg-white/10 text-slate-200 hover:bg-white/20'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Inputs A & Compare Toggle */}
            <div className="md:col-span-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (onToggleCompareMode) onToggleCompareMode(!compareMode);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  compareMode
                    ? 'bg-purple-500 hover:bg-purple-400 text-white shadow-lg shadow-purple-500/20 ring-2 ring-purple-300/30'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20'
                }`}
                title="فعال‌سازی یا غیرفعال‌سازی حالت مقایسه‌ای دوره A vs دوره B"
              >
                <span>{compareMode ? '📊 مقایسه فعال (دوره B)' : '➕ افزودن بازه مقایسه‌ای'}</span>
              </button>

              <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-xl border border-white/10">
                <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-white/10">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <input
                    type="text"
                    value={dateFrom}
                    onChange={(e) => {
                      setSelectedPreset('custom');
                      if (onDateRangeChange) onDateRangeChange(e.target.value, dateTo);
                    }}
                    placeholder="از تاریخ"
                    className="w-20 text-center font-mono font-bold text-xs bg-transparent outline-none text-white"
                  />
                </div>
                <span className="text-xs text-slate-400">تا</span>
                <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-white/10">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <input
                    type="text"
                    value={dateTo}
                    onChange={(e) => {
                      setSelectedPreset('custom');
                      if (onDateRangeChange) onDateRangeChange(dateFrom, e.target.value);
                    }}
                    placeholder="تا تاریخ"
                    className="w-20 text-center font-mono font-bold text-xs bg-transparent outline-none text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECONDARY COMPARISON PERIOD (PERIOD B) - Appears when compareMode is ON */}
          {compareMode && (
            <div className="bg-purple-950/40 p-3 rounded-2xl border border-purple-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fadeIn">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-purple-200 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                  بازه مقایسه‌ای (دوره B):
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPreset('prev_year')}
                    className="bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/30 rounded-lg text-[11px] px-2.5 py-1 font-bold transition-all cursor-pointer"
                  >
                    همسان سال قبل (پارسال)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('prev_month')}
                    className="bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/30 rounded-lg text-[11px] px-2.5 py-1 font-bold transition-all cursor-pointer"
                  >
                    ماه قبل
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('prev_quarter')}
                    className="bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/30 rounded-lg text-[11px] px-2.5 py-1 font-bold transition-all cursor-pointer"
                  >
                    فصل قبل
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-purple-300 font-bold hidden sm:inline">تاریخ دوره B:</span>
                <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-purple-500/30">
                  <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-1 rounded-lg border border-purple-400/20">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <input
                      type="text"
                      value={salesDateFromB}
                      onChange={(e) => {
                        if (onCompareDateRangeChange) onCompareDateRangeChange(e.target.value, salesDateToB);
                      }}
                      placeholder="از تاریخ B"
                      className="w-20 text-center font-mono font-bold text-xs bg-transparent outline-none text-purple-100"
                    />
                  </div>
                  <span className="text-xs text-purple-300 font-bold">تا</span>
                  <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-1 rounded-lg border border-purple-400/20">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <input
                      type="text"
                      value={salesDateToB}
                      onChange={(e) => {
                        if (onCompareDateRangeChange) onCompareDateRangeChange(salesDateFromB, e.target.value);
                      }}
                      placeholder="تا تاریخ B"
                      className="w-20 text-center font-mono font-bold text-xs bg-transparent outline-none text-purple-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. TOP EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Card 1: Today Net Sales */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold text-slate-600">فروش خالص امروز</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <DollarSign className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-base font-black text-slate-900 font-mono">
            {formatMoney(processedMetrics.todayNetAmt)} <span className="text-[10px] text-slate-500">ریال</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1 flex items-center justify-between">
            <span>وزن: {formatWeight(processedMetrics.todayNetWgt)} ک‌گ</span>
            <span className="font-mono text-blue-700 font-bold">فی: {formatMoney(processedMetrics.todayNetFee)}</span>
          </div>
        </div>

        {/* Card 1.5: Yesterday Net Sales */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold text-slate-600">فروش خالص دیروز</span>
            <span className="p-1.5 bg-cyan-50 text-cyan-600 rounded-lg group-hover:bg-cyan-600 group-hover:text-white transition-colors">
              <Calendar className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-base font-black text-slate-900 font-mono">
            {formatMoney(processedMetrics.yesterdayNetAmt)} <span className="text-[10px] text-slate-500">ریال</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1 flex items-center justify-between">
            <span>وزن: {formatWeight(processedMetrics.yesterdayNetWgt)} ک‌گ</span>
            <span className="font-mono text-cyan-700 font-bold">فی: {formatMoney(processedMetrics.yesterdayNetFee)}</span>
          </div>
        </div>

        {/* Card 2: Current Month Net Sales */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold text-slate-600">فروش خالص ماه جاری</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-base font-black text-slate-900 font-mono">
            {formatMoney(processedMetrics.monthNetAmt)} <span className="text-[10px] text-slate-500">ریال</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1 flex items-center justify-between">
            <span>وزن: {formatWeight(processedMetrics.monthNetWgt)} ک‌گ</span>
            <span className="font-mono text-emerald-700 font-bold">فی: {formatMoney(processedMetrics.monthNetFee)}</span>
          </div>
        </div>

        {/* Card 3: Current Quarter Net Sales */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold text-slate-600">فروش خالص فصل جاری</span>
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Layers className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-base font-black text-slate-900 font-mono">
            {formatMoney(processedMetrics.quarterNetAmt)} <span className="text-[10px] text-slate-500">ریال</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1 flex items-center justify-between">
            <span>وزن: {formatWeight(processedMetrics.quarterNetWgt)} ک‌گ</span>
            <span className="font-mono text-indigo-700 font-bold">فی: {formatMoney(processedMetrics.quarterNetFee)}</span>
          </div>
        </div>

        {/* Card 4: Current Year Net Sales */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold text-slate-600">فروش خالص سال جاری</span>
            <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Award className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-base font-black text-slate-900 font-mono">
            {formatMoney(processedMetrics.yearNetAmt)} <span className="text-[10px] text-slate-500">ریال</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1 flex items-center justify-between">
            <span>وزن: {formatWeight(processedMetrics.yearNetWgt)} ک‌گ</span>
            <span className="font-mono text-purple-700 font-bold">فی: {formatMoney(processedMetrics.yearNetFee)}</span>
          </div>
        </div>

        {/* Card 5: Selected Range Net Sales */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-3.5 shadow-md">
          <div className="flex items-center justify-between mb-1 opacity-90">
            <span className="text-[11px] font-bold">فروش خالص بازه</span>
            <span className="p-1 bg-white/20 rounded-lg"><DollarSign className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-base font-black font-mono">
            {formatMoney(processedMetrics.rangeNetAmt)} <span className="text-[10px]">ریال</span>
          </div>
          <div className="text-[10px] font-medium mt-1 text-blue-100 flex items-center justify-between">
            <span>وزن: {formatWeight(processedMetrics.rangeNetWgt)} ک‌گ</span>
            <span className="font-mono font-bold bg-white/20 px-1.5 py-0.5 rounded">فی: {formatMoney(processedMetrics.rangeNetFee)}</span>
          </div>
        </div>

        {/* Card 6: Selected Range Net Weight */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold text-slate-600">وزن خالص بازه</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><Package className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-base font-black text-slate-900 font-mono">
            {formatWeight(processedMetrics.rangeNetWgt)} <span className="text-[10px] text-slate-500">کیلوگرم</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            ناخالص: {formatWeight(processedMetrics.rangeSalesAmt ? (processedMetrics.rangeNetWgt + processedMetrics.rangeRetWgt) : 0)} ک‌گ
          </div>
        </div>

        {/* Card 7: Invoice Count */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold text-slate-600">تعداد فاکتورها</span>
            <span className="p-1.5 bg-cyan-50 text-cyan-600 rounded-lg"><FileText className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-base font-black text-slate-900 font-mono">
            {processedMetrics.invoiceCount} <span className="text-[10px] text-slate-500">عدد</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            ثبت شده در سایان ERP
          </div>
        </div>

        {/* Card 8: Customer Count */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold text-slate-600">تعداد خریداران</span>
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><Users className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-base font-black text-slate-900 font-mono">
            {processedMetrics.customerCount} <span className="text-[10px] text-slate-500">نفر/شرکت</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            مشتریان فعال دوره
          </div>
        </div>

        {/* Card 9: Avg Invoice Amount */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold text-slate-600">میانگین مبلغ فاکتور</span>
            <span className="p-1.5 bg-teal-50 text-teal-600 rounded-lg"><DollarSign className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-base font-black text-slate-900 font-mono">
            {formatMoney(processedMetrics.avgInvoiceAmt)} <span className="text-[10px] text-slate-500">ریال</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            فروش خالص ÷ تعداد فاکتور
          </div>
        </div>

        {/* Card 10: Avg Invoice Weight */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold text-slate-600">میانگین وزن فاکتور</span>
            <span className="p-1.5 bg-slate-100 text-slate-600 rounded-lg"><Package className="w-3.5 h-3.5" /></span>
          </div>
          <div className="text-base font-black text-slate-900 font-mono">
            {formatWeight(processedMetrics.avgInvoiceWgt)} <span className="text-[10px] text-slate-500">ک‌گ</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            وزن خالص ÷ تعداد فاکتور
          </div>
        </div>

      </div>

      {/* 3. AUTOMATED AI EXECUTIVE INSIGHTS BOX */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-yellow-500/10 border border-amber-300/60 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-amber-200/60 pb-2.5 mb-3">
          <Sparkles className="w-5 h-5 text-amber-600" />
          <h3 className="text-sm font-black text-amber-950">تحلیل هوشمند و خلاصه مدیریتی عملکرد فروش</h3>
          <span className="bg-amber-200/70 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full mr-auto">پردازش سیستم</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          
          <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/50 flex items-start gap-2">
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 mt-0.5"><Award className="w-4 h-4" /></div>
            <div>
              <div className="text-[10px] font-bold text-slate-500">پرفروش‌ترین کالا (مبلغ)</div>
              <div className="font-extrabold text-slate-900 mt-0.5">{processedMetrics.insights.topProductByAmt}</div>
            </div>
          </div>

          <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/50 flex items-start gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0 mt-0.5"><Package className="w-4 h-4" /></div>
            <div>
              <div className="text-[10px] font-bold text-slate-500">پرفروش‌ترین کالا (وزن)</div>
              <div className="font-extrabold text-slate-900 mt-0.5">{processedMetrics.insights.topProductByWgt}</div>
            </div>
          </div>

          <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/50 flex items-start gap-2">
            <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg shrink-0 mt-0.5"><DollarSign className="w-4 h-4" /></div>
            <div>
              <div className="text-[10px] font-bold text-slate-500">بالاترین فی خالص فروش</div>
              <div className="font-extrabold text-slate-900 mt-0.5">{processedMetrics.insights.topProductByFee}</div>
            </div>
          </div>

          <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/50 flex items-start gap-2">
            <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg shrink-0 mt-0.5"><ShieldAlert className="w-4 h-4" /></div>
            <div>
              <div className="text-[10px] font-bold text-slate-500">بیشترین میزان مرجوعی</div>
              <div className="font-extrabold text-slate-900 mt-0.5">{processedMetrics.insights.topReturnProduct}</div>
            </div>
          </div>

        </div>
      </div>

      {/* 4. MAIN NAVIGATION TABS FOR REPORTS & CHARTS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1 flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('hierarchy')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'hierarchy' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>۱۵ گروه اصلی کالا (Drill-Down)</span>
        </button>

        <button
          onClick={() => setActiveTab('items')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'items' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>گزارش تفکیکی ریز کالاها</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'invoices' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>لیست فاکتورهای فروش</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('compare');
            if (onToggleCompareMode) onToggleCompareMode(true);
          }}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'compare' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>پایش مقایسه‌ای (Period A vs B)</span>
        </button>

        <button
          onClick={() => setActiveTab('charts')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'charts' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>نمودارهای تصمیم‌گیری</span>
        </button>
      </div>

      {/* SEARCH & FILTER BAR */}
      {(activeTab === 'items' || activeTab === 'invoices') && (
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 mr-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'items' ? "جستجو بر اساس نام کالا، گروه کالا یا کد..." : "جستجو بر اساس شماره فاکتور، خریدار، شهر یا کارشناس..."}
            className="w-full text-xs font-bold bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 1: 15 MAJOR PRODUCT GROUPS REPORT WITH DRILL-DOWN */}
      {/* ================================================================== */}
      {activeTab === 'hierarchy' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-extrabold">گزارش سرفصل‌های اصلی کالا (۱۵ گروه اصلی سایان) با قابلیت Drill-Down</h2>
            </div>
            <span className="text-[11px] bg-blue-500/20 border border-blue-400/30 text-blue-300 px-2.5 py-0.5 rounded-full font-mono">
              فروش خالص = فروش ناخالص - مرجوعی
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3 w-10 text-center"></th>
                  <th className="p-3">نام گروه اصلی کالا</th>
                  <th className="p-3 text-center">وزن فروش (ک‌گ)</th>
                  <th className="p-3 text-center text-rose-700 bg-rose-50/50">وزن مرجوعی (ک‌گ)</th>
                  <th className="p-3 text-center font-black text-blue-900 bg-blue-50/50">وزن خالص (ک‌گ)</th>
                  <th className="p-3 text-left">مبلغ فروش (ریال)</th>
                  <th className="p-3 text-left text-rose-700 bg-rose-50/50">مبلغ مرجوعی (ریال)</th>
                  <th className="p-3 text-left font-black text-blue-900 bg-blue-50/50">فروش خالص (ریال)</th>
                  <th className="p-3 text-left font-black text-emerald-900 bg-emerald-50/50">فی خالص نهایی (ریال/ک‌گ)</th>
                  <th className="p-3 text-center font-bold">سهم %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedMetrics.categoryList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400">
                      {isLoading ? 'در حال دریافت اطلاعات از سرور سایان ERP...' : 'هیچ رکوردی در این بازه یافت نشد'}
                    </td>
                  </tr>
                ) : (
                  processedMetrics.categoryList.map((cat, idx) => {
                    const isExpanded = !!expandedCategories[cat.name];
                    return (
                      <React.Fragment key={idx}>
                        {/* Parent Group Row */}
                        <tr 
                          onClick={() => toggleCategory(cat.name)}
                          className={`hover:bg-blue-50/40 transition-colors cursor-pointer font-bold ${
                            isExpanded ? 'bg-blue-50/60' : ''
                          }`}
                        >
                          <td className="p-3 text-center text-slate-400">
                            {cat.items.length > 0 ? (
                              isExpanded ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />
                            ) : null}
                          </td>
                          <td className="p-3 font-extrabold text-slate-900 flex items-center gap-2">
                            <span>{cat.name}</span>
                            {cat.items.length > 0 && (
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-md font-mono">
                                {cat.items.length} کالا
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center font-mono">{formatWeight(cat.salesWgt)}</td>
                          <td className="p-3 text-center font-mono text-rose-600 bg-rose-50/30">{formatWeight(cat.retWgt)}</td>
                          <td className="p-3 text-center font-mono font-black text-blue-900 bg-blue-50/30">{formatWeight(cat.netWgt)}</td>
                          <td className="p-3 text-left font-mono">{formatMoney(cat.salesAmt)}</td>
                          <td className="p-3 text-left font-mono text-rose-600 bg-rose-50/30">{formatMoney(cat.retAmt)}</td>
                          <td className="p-3 text-left font-mono font-black text-blue-900 bg-blue-50/30">{formatMoney(cat.netAmt)}</td>
                          <td className="p-3 text-left font-mono font-black text-emerald-800 bg-emerald-50/30">{formatMoney(cat.netFee)}</td>
                          <td className="p-3 text-center font-mono">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold text-[10px]">
                              {cat.sharePct.toFixed(1)}%
                            </span>
                          </td>
                        </tr>

                        {/* Nested Sub-items (Drill-Down) */}
                        {isExpanded && cat.items.map((sub, sIdx) => (
                          <tr key={`${idx}_sub_${sIdx}`} className="bg-slate-50/80 text-[11px] hover:bg-slate-100/80 transition-colors border-l-4 border-l-blue-500">
                            <td></td>
                            <td className="p-2.5 pr-8 text-slate-700 font-medium flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              <span>{sub.itemName}</span>
                            </td>
                            <td className="p-2.5 text-center font-mono text-slate-600">{formatWeight(sub.salesWgt)}</td>
                            <td className="p-2.5 text-center font-mono text-rose-600">{formatWeight(sub.retWgt)}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-blue-800">{formatWeight(sub.netWgt)}</td>
                            <td className="p-2.5 text-left font-mono text-slate-600">{formatMoney(sub.salesAmt)}</td>
                            <td className="p-2.5 text-left font-mono text-rose-600">{formatMoney(sub.retAmt)}</td>
                            <td className="p-2.5 text-left font-mono font-bold text-blue-800">{formatMoney(sub.netAmt)}</td>
                            <td className="p-2.5 text-left font-mono font-bold text-emerald-700">{formatMoney(sub.netFee)}</td>
                            <td className="p-2.5 text-center font-mono text-slate-500">{sub.sharePct.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-700">
                  <td colSpan={2} className="p-3.5">جمع کل عملکرد (۱۵ گروه اصلی):</td>
                  <td className="p-3.5 text-center font-mono">{formatWeight(processedMetrics.rangeSalesAmt ? (processedMetrics.rangeNetWgt + processedMetrics.rangeRetWgt) : 0)}</td>
                  <td className="p-3.5 text-center font-mono text-rose-300">{formatWeight(processedMetrics.rangeRetWgt)}</td>
                  <td className="p-3.5 text-center font-mono font-black text-blue-300">{formatWeight(processedMetrics.rangeNetWgt)}</td>
                  <td className="p-3.5 text-left font-mono">{formatMoney(processedMetrics.rangeSalesAmt)}</td>
                  <td className="p-3.5 text-left font-mono text-rose-300">{formatMoney(processedMetrics.rangeRetAmt)}</td>
                  <td className="p-3.5 text-left font-mono font-black text-blue-300">{formatMoney(processedMetrics.rangeNetAmt)}</td>
                  <td className="p-3.5 text-left font-mono font-black text-emerald-400">{formatMoney(processedMetrics.rangeNetFee)}</td>
                  <td className="p-3.5 text-center font-mono">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 2: DETAILED ITEMS SALES REPORT */}
      {/* ================================================================== */}
      {activeTab === 'items' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <h2 className="text-sm font-extrabold flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-400" />
              <span>گزارش تفکیکی و ریز تمام کالاهای فروخته شده</span>
            </h2>
            <span className="text-[11px] text-slate-300 font-mono">
              تعداد اقلام: {filteredItems.length} مورد
            </span>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-right text-xs">
              <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200">
                <tr className="font-bold text-slate-700">
                  <th className="p-3 w-12 text-center">ردیف</th>
                  <th className="p-3">نام کالا</th>
                  <th className="p-3">گروه اصلی</th>
                  <th className="p-3 text-center">وزن فروش (ک‌گ)</th>
                  <th className="p-3 text-center text-rose-700 bg-rose-50">وزن مرجوعی (ک‌گ)</th>
                  <th className="p-3 text-center font-black text-blue-900 bg-blue-50">وزن خالص (ک‌گ)</th>
                  <th className="p-3 text-left">مبلغ فروش (ریال)</th>
                  <th className="p-3 text-left text-rose-700 bg-rose-50">مبلغ مرجوعی (ریال)</th>
                  <th className="p-3 text-left font-black text-blue-900 bg-blue-50">فروش خالص (ریال)</th>
                  <th className="p-3 text-left font-black text-emerald-900 bg-emerald-50">فی خالص نهایی</th>
                  <th className="p-3 text-center">سهم %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-900">{item.itemName}</td>
                    <td className="p-3 text-slate-500">{item.majorCategory}</td>
                    <td className="p-3 text-center font-mono">{formatWeight(item.salesQty)}</td>
                    <td className="p-3 text-center font-mono text-rose-600 bg-rose-50/20">{formatWeight(item.returnQty)}</td>
                    <td className="p-3 text-center font-mono font-bold text-blue-900 bg-blue-50/20">{formatWeight(item.netQty)}</td>
                    <td className="p-3 text-left font-mono">{formatMoney(item.salesAmt)}</td>
                    <td className="p-3 text-left font-mono text-rose-600 bg-rose-50/20">{formatMoney(item.returnAmt)}</td>
                    <td className="p-3 text-left font-mono font-bold text-blue-900 bg-blue-50/20">{formatMoney(item.netAmt)}</td>
                    <td className="p-3 text-left font-mono font-bold text-emerald-700 bg-emerald-50/20">{formatMoney(item.netFee)}</td>
                    <td className="p-3 text-center font-mono text-slate-600">{item.sharePct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 3: INVOICES LIST REPORT */}
      {/* ================================================================== */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <h2 className="text-sm font-extrabold flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <span>لیست کامل فاکتورهای فروش صادر شده</span>
            </h2>
            <span className="text-[11px] text-slate-300 font-mono">
              تعداد فاکتورها: {filteredInvoices.length} عدد
            </span>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-right text-xs">
              <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="p-3 w-12 text-center">ردیف</th>
                  <th className="p-3 font-mono">شماره فاکتور</th>
                  <th className="p-3 font-mono">تاریخ</th>
                  <th className="p-3">نام خریدار / مشتری</th>
                  <th className="p-3">شهر / استان</th>
                  <th className="p-3">کارشناس فروش</th>
                  <th className="p-3 text-left">مبلغ ناخالص (ریال)</th>
                  <th className="p-3 text-left text-rose-600">مرجوعی (ریال)</th>
                  <th className="p-3 text-left font-black text-blue-900">فروش خالص (ریال)</th>
                  <th className="p-3 text-center font-black text-blue-900">وزن خالص (ک‌گ)</th>
                  <th className="p-3 text-center">وضعیت تسویه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-blue-700">#{inv.invoiceNum}</td>
                    <td className="p-3 font-mono text-slate-600">{inv.date}</td>
                    <td className="p-3 font-bold text-slate-900">{inv.customerName}</td>
                    <td className="p-3 text-slate-500">{inv.city}</td>
                    <td className="p-3 text-slate-500">{inv.salesExpert}</td>
                    <td className="p-3 text-left font-mono">{formatMoney(inv.grossAmt)}</td>
                    <td className="p-3 text-left font-mono text-rose-600">{formatMoney(inv.retAmt)}</td>
                    <td className="p-3 text-left font-mono font-bold text-blue-900">{formatMoney(inv.netAmt)}</td>
                    <td className="p-3 text-center font-mono font-bold text-blue-900">{formatWeight(inv.netWgt)}</td>
                    <td className="p-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {inv.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 4: TWO-PERIOD COMPARATIVE ANALYSIS (Period A vs Period B) */}
      {/* ================================================================== */}
      {activeTab === 'compare' && (
        <div className="space-y-4 animate-fadeIn">
          
          {/* COMPARATIVE CONTROL PANEL */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-indigo-500/30 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-blue-200">تنظیمات و پنل تخصصی پایش مقایسه‌ای فروش (Period A vs Period B)</h3>
                <p className="text-[11px] text-slate-300">مقایسه تراز فروش، مرجوعی کد ۱۳، وزن خالص و میانگین فی نهایی اقلام</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onToggleCompareMode) onToggleCompareMode(!compareMode);
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    compareMode 
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' 
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                >
                  {compareMode ? '✅ حالت مقایسه: فعال' : '❌ حالت مقایسه: غیرفعال'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-[11px] font-bold text-slate-400 mb-1 flex items-center justify-between">
                  <span>دوره A (بازه اصلی پایه): <strong className="text-blue-300 font-mono">{dateFrom || '---'} تا {dateTo || '---'}</strong></span>
                  <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold">دوره A</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 w-full">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <input 
                      type="text" 
                      placeholder="از تاریخ"
                      value={dateFrom}
                      onChange={(e) => {
                        if (onDateRangeChange) onDateRangeChange(e.target.value, dateTo);
                      }}
                      className="text-xs bg-transparent outline-none text-white font-bold font-mono w-full text-center"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-bold">تا</span>
                  <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 w-full">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <input 
                      type="text" 
                      placeholder="تا تاریخ"
                      value={dateTo}
                      onChange={(e) => {
                        if (onDateRangeChange) onDateRangeChange(dateFrom, e.target.value);
                      }}
                      className="text-xs bg-transparent outline-none text-white font-bold font-mono w-full text-center"
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 mb-1 flex items-center justify-between">
                  <span>دوره B (بازه تطبیقی مقایسه‌ای): <strong className="text-purple-300 font-mono">{salesDateFromB || '---'} تا {salesDateToB || '---'}</strong></span>
                  <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">دوره B</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 w-full">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <input 
                      type="text" 
                      placeholder="۱۴۰۳/۰۱/۰۱"
                      value={salesDateFromB}
                      onChange={(e) => {
                        if (onCompareDateRangeChange) onCompareDateRangeChange(e.target.value, salesDateToB);
                      }}
                      className="text-xs bg-transparent outline-none text-white font-bold font-mono w-full text-center"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-bold">تا</span>
                  <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 w-full">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <input 
                      type="text" 
                      placeholder="۱۴۰۳/۱۲/۲۹"
                      value={salesDateToB}
                      onChange={(e) => {
                        if (onCompareDateRangeChange) onCompareDateRangeChange(salesDateFromB, e.target.value);
                      }}
                      className="text-xs bg-transparent outline-none text-white font-bold font-mono w-full text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">میانبر بازه دوم:</span>
                <button
                  type="button"
                  onClick={() => applyPreset('prev_year')}
                  className="bg-white/10 hover:bg-white/25 border border-white/20 rounded text-[11px] px-2.5 py-1 font-bold transition-all cursor-pointer text-blue-200"
                >
                  همسان سال قبل (پارسال)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('prev_month')}
                  className="bg-white/10 hover:bg-white/25 border border-white/20 rounded text-[11px] px-2.5 py-1 font-bold transition-all cursor-pointer text-blue-200"
                >
                  ماه قبل
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('prev_quarter')}
                  className="bg-white/10 hover:bg-white/25 border border-white/20 rounded text-[11px] px-2.5 py-1 font-bold transition-all cursor-pointer text-blue-200"
                >
                  فصل قبل
                </button>
              </div>

              {compareMode && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadComparePdf}
                    className="bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs px-3 py-1.5 font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>دانلود PDF مقایسه‌ای</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBotModalOpen(true)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs px-3 py-1.5 font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>ارسال مقایسه‌ای به بات</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {!compareMode ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
              <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h4 className="text-sm font-extrabold text-slate-800">حالت مقایسه دو بازه غیرفعال است</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                برای فعال‌سازی مقایسه تراز فروش بازه اول با بازه دوم، لطفاً روی دکمه «حالت مقایسه: غیرفعال» در پنل بالا کلیک کنید تا به وضعیت فعال تغییر کند.
              </p>
            </div>
          ) : isLoading ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-600 font-bold">در حال دریافت و تحلیل آماری داده‌های بازه دوم از سیستم سایان ERP...</p>
            </div>
          ) : !compareDataB || compareDataB.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h4 className="text-sm font-extrabold text-slate-800">هیچ تراکنشی در بازه دوم یافت نشد</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                تراکنشی در تاریخ‌های مشخص شده برای بازه دوم در سیستم ERP یافت نشد. می‌توانید با دکمه‌های میانبر (مثلا همسان سال قبل) بازه دیگری انتخاب کنید.
              </p>
            </div>
          ) : (
            <>
              {/* COMPARISON METRICS SUMMARY CARDS */}
              {comparisonMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Card 1: Amount Growth */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
                      <span>تغییرات مبلغ خالص فروش</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                        comparisonMetrics.amtGrowthPct >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {comparisonMetrics.amtGrowthPct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {comparisonMetrics.amtGrowthPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-2 font-mono">
                      {formatMoney(comparisonMetrics.netAmtA)} <span className="text-xs text-slate-400">vs {formatMoney(comparisonMetrics.netAmtB)}</span>
                    </div>
                    <div className={`text-xs font-bold mt-1 ${comparisonMetrics.amtDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      اختلاف: {comparisonMetrics.amtDiff >= 0 ? '+' : ''}{formatMoney(comparisonMetrics.amtDiff)} ریال
                    </div>
                  </div>

                  {/* Card 2: Weight Growth */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
                      <span>تغییرات وزن خالص فروش</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                        comparisonMetrics.wgtGrowthPct >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {comparisonMetrics.wgtGrowthPct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {comparisonMetrics.wgtGrowthPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-2 font-mono">
                      {formatWeight(comparisonMetrics.netWgtA)} <span className="text-xs text-slate-400">vs {formatWeight(comparisonMetrics.netWgtB)}</span> ک‌گ
                    </div>
                    <div className={`text-xs font-bold mt-1 ${comparisonMetrics.wgtDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      اختلاف: {comparisonMetrics.wgtDiff >= 0 ? '+' : ''}{formatWeight(comparisonMetrics.wgtDiff)} ک‌گ
                    </div>
                  </div>

                  {/* Card 3: Fee Growth */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
                      <span>تغییرات فی نهایی میانگین</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                        comparisonMetrics.feeGrowthPct >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {comparisonMetrics.feeGrowthPct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {comparisonMetrics.feeGrowthPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-2 font-mono">
                      {formatMoney(comparisonMetrics.avgFeeA)} <span className="text-xs text-slate-400">vs {formatMoney(comparisonMetrics.avgFeeB)}</span> ریال
                    </div>
                    <div className={`text-xs font-bold mt-1 ${comparisonMetrics.feeDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      اختلاف: {comparisonMetrics.feeDiff >= 0 ? '+' : ''}{formatMoney(comparisonMetrics.feeDiff)} ریال/ک‌گ
                    </div>
                  </div>

                </div>
              )}

              {/* COMPARISON TABLE WITH DUAL MODES (Product Group Summary vs Product Detail) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <h2 className="text-sm font-extrabold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <span>جدول جامع مقایسه انحراف عملکرد و تحلیلی (Period A vs Period B)</span>
                  </h2>

                  {/* Mode Selector Buttons */}
                  <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setCompareModeType('groups')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        compareModeType === 'groups'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span>۱. خلاصه گروه‌های کالا (۱۵ گروه اصلی)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompareModeType('items')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        compareModeType === 'items'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>۲. ریز کالاهای منفرد ({comparisonMetrics?.compareItemRows.length || 0} کالا)</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[650px]">
                  {compareModeType === 'groups' ? (
                    <table className="w-full text-right text-xs">
                      <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-slate-700 font-bold">
                        <tr>
                          <th className="p-3">ردیف</th>
                          <th className="p-3">نام گروه اصلی کالا</th>
                          <th className="p-3 text-left bg-blue-50/70">فروش خالص A (ریال)</th>
                          <th className="p-3 text-left bg-indigo-50/70">فروش خالص B (ریال)</th>
                          <th className="p-3 text-center bg-blue-50/70">وزن خالص A (ک‌گ)</th>
                          <th className="p-3 text-center bg-indigo-50/70">وزن خالص B (ک‌گ)</th>
                          <th className="p-3 text-left bg-blue-50/70">فی A (ریال/ک‌گ)</th>
                          <th className="p-3 text-left bg-indigo-50/70">فی B (ریال/ک‌گ)</th>
                          <th className="p-3 text-left font-black">اختلاف مبلغ</th>
                          <th className="p-3 text-center font-black">درصد رشد/افت</th>
                          <th className="p-3 text-center">سهم A %</th>
                          <th className="p-3 text-center">تحلیل انحراف (Variance)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {comparisonMetrics?.compareGroupRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900">{row.catName}</td>
                            <td className="p-3 text-left font-mono font-bold text-blue-900 bg-blue-50/20">{formatMoney(row.netAmtA)}</td>
                            <td className="p-3 text-left font-mono font-bold text-indigo-900 bg-indigo-50/20">{formatMoney(row.netAmtB)}</td>
                            <td className="p-3 text-center font-mono text-blue-900 bg-blue-50/20">{formatWeight(row.netWgtA)}</td>
                            <td className="p-3 text-center font-mono text-indigo-900 bg-indigo-50/20">{formatWeight(row.netWgtB)}</td>
                            <td className="p-3 text-left font-mono text-blue-900 bg-blue-50/20">{formatMoney(row.netFeeA)}</td>
                            <td className="p-3 text-left font-mono text-indigo-900 bg-indigo-50/20">{formatMoney(row.netFeeB)}</td>
                            <td className={`p-3 text-left font-mono font-black ${row.diffAmt >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {row.diffAmt >= 0 ? '+' : ''}{formatMoney(row.diffAmt)}
                            </td>
                            <td className="p-3 text-center font-mono font-black">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                row.growthPct > 0 ? 'bg-emerald-100 text-emerald-800' : row.growthPct < 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {row.growthPct > 0 ? '+' : ''}{row.growthPct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono text-slate-600">{row.sharePctA.toFixed(1)}%</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.variance.color}`}>
                                {row.variance.label}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-right text-xs">
                      <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-slate-700 font-bold">
                        <tr>
                          <th className="p-3">ردیف</th>
                          <th className="p-3">نام کالا</th>
                          <th className="p-3">گروه اصلی</th>
                          <th className="p-3 text-left bg-blue-50/70">فروش خالص A</th>
                          <th className="p-3 text-left bg-indigo-50/70">فروش خالص B</th>
                          <th className="p-3 text-center bg-blue-50/70">وزن خالص A (ک‌گ)</th>
                          <th className="p-3 text-center bg-indigo-50/70">وزن خالص B (ک‌گ)</th>
                          <th className="p-3 text-left bg-blue-50/70">فی A</th>
                          <th className="p-3 text-left bg-indigo-50/70">فی B</th>
                          <th className="p-3 text-left font-black">اختلاف مبلغ</th>
                          <th className="p-3 text-center font-black">درصد تغییر</th>
                          <th className="p-3 text-center">تحلیل انحراف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {comparisonMetrics?.compareItemRows.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900">{item.itemName}</td>
                            <td className="p-3 text-slate-500">{item.majorCategory}</td>
                            <td className="p-3 text-left font-mono font-bold text-blue-900 bg-blue-50/20">{formatMoney(item.netAmtA)}</td>
                            <td className="p-3 text-left font-mono font-bold text-indigo-900 bg-indigo-50/20">{formatMoney(item.netAmtB)}</td>
                            <td className="p-3 text-center font-mono text-blue-900 bg-blue-50/20">{formatWeight(item.netWgtA)}</td>
                            <td className="p-3 text-center font-mono text-indigo-900 bg-indigo-50/20">{formatWeight(item.netWgtB)}</td>
                            <td className="p-3 text-left font-mono text-blue-900 bg-blue-50/20">{formatMoney(item.netFeeA)}</td>
                            <td className="p-3 text-left font-mono text-indigo-900 bg-indigo-50/20">{formatMoney(item.netFeeB)}</td>
                            <td className={`p-3 text-left font-mono font-black ${item.diffAmt >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {item.diffAmt >= 0 ? '+' : ''}{formatMoney(item.diffAmt)}
                            </td>
                            <td className="p-3 text-center font-mono font-black">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                item.growthPct > 0 ? 'bg-emerald-100 text-emerald-800' : item.growthPct < 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {item.growthPct > 0 ? '+' : ''}{item.growthPct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.variance.color}`}>
                                {item.variance.label}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 5: INTERACTIVE VISUAL CHARTS DASHBOARD */}
      {/* ================================================================== */}
      {activeTab === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
          
          {/* Chart 1: Bar Chart Major Categories Sales Amount */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-800 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              <span>فروش خالص به تفکیک ۱۵ گروه اصلی کالا (ریال)</span>
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processedMetrics.categoryList} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(val: any) => [`${formatMoney(val)} ریال`, 'فروش خالص']} />
                  <Bar dataKey="netAmt" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Share Donut Chart */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-800 mb-4 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-emerald-600" />
              <span>دیسپوزیشن سهم سرفصل‌های اصلی از کل فروش %</span>
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={processedMetrics.categoryList}
                    dataKey="netAmt"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {processedMetrics.categoryList.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => [`${formatMoney(val)} ریال`, 'سهم فروش']} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {/* ================================================================== */}
      {/* BOT DISPATCH INTERACTIVE MODAL */}
      {/* ================================================================== */}
      {isBotModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-scaleUp">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                <Send className="w-5 h-5 text-emerald-600" />
                <span>ارسال گزارش فروش به پیام‌رسان‌ها (بات‌ها)</span>
              </div>
              <button 
                onClick={() => setIsBotModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>نوع گزارش آماده ارسال:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${compareMode ? 'bg-indigo-100 text-indigo-900' : 'bg-emerald-100 text-emerald-900'}`}>
                  {compareMode ? '📊 گزارش مقایسه‌ای دوره A و B' : '📈 گزارش مدیریتی تک‌دوره‌ای'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {compareMode 
                  ? `بازه A (${dateFrom} تا ${dateTo}) در مقایسه با بازه B (${salesDateFromB} تا ${salesDateToB}) به صورت فایل PDF تحلیلی ارسال می‌شود.`
                  : `گزارش آمار و خلاصه فروش بازه ${dateFrom} تا ${dateTo} به گروه و چت‌های تنظیم شده ارسال خواهد شد.`}
              </p>
            </div>

            {/* Platform Selection Checkboxes */}
            <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-700 block mb-1">انتخاب پلتفرم‌های مقصد:</span>
              
              {[
                { id: 'telegram', label: 'تلگرام (Telegram)', color: 'text-blue-600' },
                { id: 'bale', label: 'بله (Bale)', color: 'text-emerald-600' },
                { id: 'whatsapp', label: 'واتساپ / ایتا (WhatsApp)', color: 'text-green-600' }
              ].map(p => (
                <label key={p.id} className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(p.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedPlatforms(prev => [...prev, p.id]);
                      else setSelectedPlatforms(prev => prev.filter(x => x !== p.id));
                    }}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className={p.color}>{p.label}</span>
                </label>
              ))}
            </div>

            {/* Manual Quick Action Options */}
            <div className="pt-2 space-y-1.5 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-600 block">ارسال‌های دستی فوری:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSendManualReport('today')}
                  disabled={isSendingBot || selectedPlatforms.length === 0}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold rounded-xl text-[11px] border border-blue-200 transition-all cursor-pointer disabled:opacity-50 text-center"
                >
                  ⚡ ارسال فروش امروز
                </button>
                <button
                  type="button"
                  onClick={() => handleSendManualReport('yesterday')}
                  disabled={isSendingBot || selectedPlatforms.length === 0}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-[11px] border border-slate-300 transition-all cursor-pointer disabled:opacity-50 text-center"
                >
                  🗓️ ارسال فروش دیروز
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBotModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSendToBots}
                disabled={isSendingBot || selectedPlatforms.length === 0}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {isSendingBot && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{compareMode ? 'ارسال PDF مقایسه‌ای' : 'ارسال گزارش بازه فعلی'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default SayanSalesDashboard;
