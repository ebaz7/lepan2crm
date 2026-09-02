import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, 
  Search, 
  Filter, 
  RefreshCw, 
  Download, 
  Printer, 
  Eye, 
  Calendar, 
  Truck, 
  Package, 
  Boxes, 
  User, 
  Users,
  ArrowUpDown, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Layers,
  Scale,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  fetchSayanSalesRemittances, 
  SayanSalesRemittanceResult, 
  SayanSalesRemittanceSummary,
  SayanSalesRemittanceItem
} from '../services/sayanExitService';
import SayanSalesRemittanceDoc, { SayanRemittanceData } from './SayanSalesRemittanceDoc';
import { AiSayanReportModal } from './AiSayanReportModal';
import * as jalaali from 'jalaali-js';

interface SayanRemittancesTabProps {
  settings?: any;
  currentUser?: any;
  defaultDateFrom?: string;
  defaultDateTo?: string;
  runSayanQuery?: (queryStr: string) => Promise<any[]>;
}

// Helpers for detail note parsing and code mappings
const mapGradeCode = (code: any) => {
  if (!code) return 'AA';
  const s = String(code).trim();
  if (s === '00011001') return 'AA';
  if (s === '00011002') return 'A';
  if (s === '00011003') return 'B';
  if (s === '00011004') return 'C';
  if (s.length < 5) return s;
  return 'AA';
};

const mapTwistCode = (code: any) => {
  if (!code) return 'Z';
  const s = String(code).trim();
  if (s === '00021001') return 'Z';
  if (s === '00021002') return 'S';
  if (s.length < 5) return s;
  return 'Z';
};

const parseDetailNote = (note: any) => {
  const result = {
    bobbinCount: 0,
    cartonCount: 0,
    grossWeight: 0,
    netWeight: 0,
    grade: 'AA',
    twistDirection: 'Z',
    description: ''
  };
  if (!note || typeof note !== 'string') return result;

  const parts = note.split('|').map(p => p.trim());
  for (const p of parts) {
    if (p.includes('تعداد بوبین:')) {
      result.bobbinCount = parseInt(p.replace('تعداد بوبین:', '').trim(), 10) || 0;
    } else if (p.includes('تعداد کارتن:')) {
      result.cartonCount = parseInt(p.replace('تعداد کارتن:', '').trim(), 10) || 0;
    } else if (p.includes('وزن ناخالص:')) {
      result.grossWeight = parseFloat(p.replace('وزن ناخالص:', '').trim()) || 0;
    } else if (p.includes('وزن خالص:')) {
      result.netWeight = parseFloat(p.replace('وزن خالص:', '').trim()) || 0;
    } else if (p.includes('گرید:')) {
      const rawG = p.replace('گرید:', '').trim();
      result.grade = mapGradeCode(rawG);
    } else if (p.includes('جهت تاب:')) {
      const rawT = p.replace('جهت تاب:', '').trim();
      result.twistDirection = mapTwistCode(rawT);
    } else if (p.includes('توضیحات:')) {
      const d = p.replace('توضیحات:', '').trim();
      if (d) result.description = d;
    }
  }
  return result;
};

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

const parseJalaliToGregorian = (jalaliStr: string) => {
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

export const SayanRemittancesTab: React.FC<SayanRemittancesTabProps> = ({
  settings,
  currentUser,
  defaultDateFrom,
  defaultDateTo,
  runSayanQuery
}) => {
  // Current Jalali Date Helper
  const getTodayJalaliStr = () => {
    const d = new Date();
    const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
  };

  const getMonthStartJalaliStr = () => {
    const d = new Date();
    const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return `${j.jy}/${String(j.jm).padStart(2, '0')}/01`;
  };

  const [dateFrom, setDateFrom] = useState<string>(defaultDateFrom || getMonthStartJalaliStr());
  const [dateTo, setDateTo] = useState<string>(defaultDateTo || getTodayJalaliStr());
  const [search, setSearch] = useState<string>('');
  const [docType, setDocType] = useState<string>('23');
  const [storeId, setStoreId] = useState<string>('all');
  
  const [remittances, setRemittances] = useState<SayanSalesRemittanceResult[]>([]);
  const [summary, setSummary] = useState<SayanSalesRemittanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<keyof SayanSalesRemittanceResult>('docDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [selectedRemittance, setSelectedRemittance] = useState<SayanSalesRemittanceResult | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);

  // Quick Date Selectors
  const setQuickDate = (type: 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all') => {
    const now = new Date();
    const jToday = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const todayStr = `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;

    if (type === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (type === 'yesterday') {
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const jYest = jalaali.toJalaali(yest.getFullYear(), yest.getMonth() + 1, yest.getDate());
      const yestStr = `${jYest.jy}/${String(jYest.jm).padStart(2, '0')}/${String(jYest.jd).padStart(2, '0')}`;
      setDateFrom(yestStr);
      setDateTo(yestStr);
    } else if (type === 'week') {
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const jWeek = jalaali.toJalaali(lastWeek.getFullYear(), lastWeek.getMonth() + 1, lastWeek.getDate());
      const weekStr = `${jWeek.jy}/${String(jWeek.jm).padStart(2, '0')}/${String(jWeek.jd).padStart(2, '0')}`;
      setDateFrom(weekStr);
      setDateTo(todayStr);
    } else if (type === 'month') {
      setDateFrom(`${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/01`);
      setDateTo(todayStr);
    } else if (type === 'year') {
      setDateFrom(`${jToday.jy}/01/01`);
      setDateTo(todayStr);
    } else if (type === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  };

  // Convert raw DB query rows to structured remittance objects
  const processRawRows = (rows: any[]): { remittances: SayanSalesRemittanceResult[], summary: SayanSalesRemittanceSummary } => {
    const remittancesMap = new Map<string, SayanSalesRemittanceResult>();
    const persianDays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];

    for (const row of rows) {
      const docKey = `${String(row.DocNo || row.ArchiveCode)}_${String(row.StoreId || '')}_${String(row.DocType || '')}`;
      if (!remittancesMap.has(docKey)) {
        let shamsiDateStr = '';
        let dayOfWeek = '';
        if (row.DocDate) {
          try {
            const d = new Date(row.DocDate);
            if (!isNaN(d.getTime())) {
              const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
              shamsiDateStr = `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
              dayOfWeek = persianDays[d.getDay()];
            }
          } catch (e) {}
        }

        const docTypeStr = String(row.DocType || '').trim();
        let docTypeLabel = 'حواله فروش';
        if (docTypeStr === '23') docTypeLabel = 'حواله فروش';
        else if (docTypeStr === '12') docTypeLabel = 'سایر حواله‌ها (۱۲)';
        else if (docTypeStr === '3') docTypeLabel = 'حواله انبار';
        else if (docTypeStr === '13') docTypeLabel = 'برگشت از فروش';
        else if (docTypeStr === '10') docTypeLabel = 'رسید انبار';

        remittancesMap.set(docKey, {
          archiveCode: String(row.ArchiveCode || ''),
          subSystem: String(row.SubSystem || ''),
          docNo: String(row.DocNo || ''),
          remittanceNumber: String(row.RemittanceNumber || row.DocNo || ''),
          subCode: String(row.SubCode || ''),
          docDate: row.DocDate || '',
          shamsiDate: shamsiDateStr,
          dayOfWeek,
          docType: docTypeStr,
          docTypeLabel,
          personCode: String(row.PersonCode || ''),
          personFullName: String(row.PersonFullName || '').trim() || 'طرف‌حساب نامشخص',
          personAddress: '',
          personPhone: '',
          storeId: String(row.StoreId || ''),
          note: String(row.Note || '').trim(),
          headerPayable: 0,
          items: [],
          totalNetWeight: 0,
          totalGrossWeight: 0,
          totalCartons: 0,
          totalBobbins: 0,
          totalAmount: 0
        });
      }

      const rem = remittancesMap.get(docKey)!;
      const detailNoteStr = row.DetailNote || row.ItemNotes || '';
      const parsed = parseDetailNote(detailNoteStr);
      const netVal = parseFloat(row.NetQty || row.Quantity || 0);
      const grossVal = parsed.grossWeight > 0 ? parsed.grossWeight : netVal;
      const unitPrice = 0;
      const totalPrice = 0;

      rem.totalNetWeight += netVal;
      rem.totalGrossWeight += grossVal;
      rem.totalCartons += parsed.cartonCount;
      rem.totalBobbins += parsed.bobbinCount;
      rem.totalAmount += totalPrice;

      rem.items.push({
        lineId: String(row.LineId || ''),
        docNo: String(row.DocNo || ''),
        itemCode: String(row.ItemCode || ''),
        goodsName: String(row.ItemName || row.ItemCode || `کالا ${rem.items.length + 1}`),
        netQty: parseFloat(netVal.toFixed(3)),
        grossQty: parseFloat(grossVal.toFixed(3)),
        unitPrice,
        totalPrice,
        cartonCount: parsed.cartonCount,
        bobbinCount: parsed.bobbinCount,
        grade: parsed.grade,
        twistDirection: parsed.twistDirection,
        description: parsed.description,
        detailNote: detailNoteStr,
        rowNo: parseInt(row.RowNo || (rem.items.length + 1), 10)
      });
    }

    const remittancesList = Array.from(remittancesMap.values()).map(r => {
      r.totalNetWeight = parseFloat(r.totalNetWeight.toFixed(3));
      r.totalGrossWeight = parseFloat(r.totalGrossWeight.toFixed(3));
      r.itemsCount = r.items.length;
      return r;
    });

    const summaryData: SayanSalesRemittanceSummary = {
      totalRemittances: remittancesList.length,
      totalNetWeight: parseFloat(remittancesList.reduce((s, r) => s + r.totalNetWeight, 0).toFixed(3)),
      totalGrossWeight: parseFloat(remittancesList.reduce((s, r) => s + r.totalGrossWeight, 0).toFixed(3)),
      totalCartons: remittancesList.reduce((s, r) => s + r.totalCartons, 0),
      totalBobbins: remittancesList.reduce((s, r) => s + r.totalBobbins, 0),
      totalAmount: 0,
      uniqueCustomersCount: new Set(remittancesList.map(r => r.personCode || r.personFullName)).size
    };

    return { remittances: remittancesList, summary: summaryData };
  };

  // Load Data with runSayanQuery or backend fallback
  const loadRemittances = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (runSayanQuery) {
        // Direct Query via Sayan Proxy
        const whereClauses: string[] = [];

        // DocType Filter
        if (docType && docType !== 'all') {
          whereClauses.push(`RTRIM(LTRIM(t10.Field_009)) = '${docType.replace(/'/g, "''")}'`);
        } else {
          whereClauses.push(`RTRIM(LTRIM(t10.Field_009)) IN ('12', '23', '3', '13')`);
        }

        // Date Filter
        const gFrom = parseJalaliToGregorian(dateFrom);
        const gTo = parseJalaliToGregorian(dateTo);
        if (gFrom && gTo) {
          whereClauses.push(`t10.Field_008 >= '${gFrom}T00:00:00.000Z' AND t10.Field_008 <= '${gTo}T23:59:59.000Z'`);
        } else if (gFrom) {
          whereClauses.push(`t10.Field_008 >= '${gFrom}T00:00:00.000Z'`);
        }

        // Store ID Filter
        if (storeId && storeId !== 'all') {
          whereClauses.push(`RTRIM(LTRIM(t10.Field_018)) = '${storeId.replace(/'/g, "''")}'`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const sql = `
          SELECT TOP 1000
              t10.Field_001 as ArchiveCode,
              t10.Field_004 as SubSystem,
              t10.Field_005 as DocNo,
              t10.Field_006 as RemittanceNumber,
              t10.Field_007 as SubCode,
              t10.Field_008 as DocDate,
              RTRIM(LTRIM(t10.Field_009)) as DocType,
              RTRIM(LTRIM(t10.Field_010)) as PersonCode,
              RTRIM(LTRIM(t10.Field_018)) as StoreId,
              t10.Field_029 as Note,
              COALESCE(
                  NULLIF(RTRIM(LTRIM(t07.Field_006)), ''),
                  t10.Field_010,
                  N'طرف‌حساب نامشخص'
              ) as PersonFullName,
              t11.Field_001 as LineId,
              RTRIM(LTRIM(t11.Field_005)) as ItemCode,
              COALESCE(
                  NULLIF(RTRIM(LTRIM(t22.Field_004)), ''),
                  NULLIF(RTRIM(LTRIM(t_name.ItemName)), ''),
                  RTRIM(LTRIM(t11.Field_005)),
                  N'کالای بدون نام'
              ) as ItemName,
              t11.Field_006 as NetQty,
              t11.Field_031 as DetailNote,
              t11.Field_034 as RowNo
          FROM STR_TBL_010 t10
          INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                    AND t11.Field_003 = t10.Field_004 
                                    AND t11.Field_012 = t10.Field_018
          LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
          LEFT JOIN (
              SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
              FROM IND_TBL_021 t21_sub
              LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
              GROUP BY t21_sub.Field_004
          ) t_name ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_name.ItemCode))
          LEFT JOIN ACT_TBL_007 t07 ON RTRIM(LTRIM(t10.Field_010)) = RTRIM(LTRIM(t07.Field_005)) AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
          ${whereSql}
          ORDER BY t10.Field_008 DESC, t10.Field_005 DESC
        `;

        const rawRows = await runSayanQuery(sql);
        const { remittances: processedList, summary: summaryObj } = processRawRows(rawRows || []);
        setRemittances(processedList);
        setSummary(summaryObj);
      } else {
        // Fallback to backend API endpoint
        const res = await fetchSayanSalesRemittances({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          search: search || undefined,
          docType: docType || undefined,
          storeId: storeId !== 'all' ? storeId : undefined,
          limit: 1000
        });

        if (res.success) {
          setRemittances(res.remittances || []);
          setSummary(res.summary || null);
        } else {
          setError(res.message || 'خطا در دریافت حواله‌های فروش سایان');
        }
      }
    } catch (err: any) {
      console.error('Error loading remittances:', err);
      setError(err.message || 'خطا در برقراری ارتباط با دیتابیس سایان');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRemittances();
  }, [docType, storeId]);

  // Unique stores list from remittances
  const availableStores = useMemo(() => {
    const s = new Set<string>();
    remittances.forEach(r => {
      if (r.storeId) s.add(r.storeId);
    });
    return Array.from(s).sort();
  }, [remittances]);

  // Filtered & Sorted Remittances
  const filteredRemittances = useMemo(() => {
    let list = [...remittances];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r => 
        (r.remittanceNumber && r.remittanceNumber.toLowerCase().includes(q)) ||
        (r.docNo && r.docNo.toLowerCase().includes(q)) ||
        (r.personFullName && r.personFullName.toLowerCase().includes(q)) ||
        (r.personCode && r.personCode.toLowerCase().includes(q)) ||
        (r.note && r.note.toLowerCase().includes(q)) ||
        (r.items && r.items.some(i => i.goodsName.toLowerCase().includes(q) || i.itemCode.toLowerCase().includes(q)))
      );
    }

    list.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });

    return list;
  }, [remittances, search, sortField, sortDirection]);

  // Handle Sort Change
  const handleSort = (field: keyof SayanSalesRemittanceResult) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredRemittances.length === 0) return;

    // Sheet 1: Headers
    const headersData = filteredRemittances.map((r, idx) => ({
      'ردیف': idx + 1,
      'شماره حواله': r.remittanceNumber || r.docNo,
      'شماره سند سایان': r.docNo,
      'تاریخ شمسی': r.shamsiDate,
      'روز هفته': r.dayOfWeek || '',
      'نوع سند': r.docTypeLabel || r.docType,
      'کد شخص': r.personCode,
      'نام خریدار / طرف حساب': r.personFullName,
      'کد انبار': r.storeId || '',
      'تعداد ردیف کالا': r.itemsCount || r.items.length,
      'وزن خالص (kg)': r.totalNetWeight,
      'وزن ناخالص (kg)': r.totalGrossWeight,
      'تعداد کارتن': r.totalCartons,
      'تعداد بوبین': r.totalBobbins,
      'توضیحات': r.note || ''
    }));

    // Sheet 2: Line Items
    const itemsData: any[] = [];
    filteredRemittances.forEach(r => {
      r.items.forEach(i => {
        itemsData.push({
          'شماره حواله': r.remittanceNumber || r.docNo,
          'تاریخ': r.shamsiDate,
          'خریدار': r.personFullName,
          'ردیف در سند': i.rowNo || 1,
          'کد کالا': i.itemCode,
          'نام و شرح کالا': i.goodsName,
          'مقدار خالص (kg)': i.netQty,
          'مقدار ناخالص (kg)': i.grossQty,
          'تعداد کارتن': i.cartonCount || 0,
          'تعداد بوبین': i.bobbinCount || 0,
          'گرید': i.grade || 'AA',
          'جهت تاب': i.twistDirection || 'Z',
          'شرح ردیف': i.description || i.detailNote || ''
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const wsHeaders = XLSX.utils.json_to_sheet(headersData);
    const wsItems = XLSX.utils.json_to_sheet(itemsData);

    XLSX.utils.book_append_sheet(wb, wsHeaders, 'لیست حواله‌ها');
    XLSX.utils.book_append_sheet(wb, wsItems, 'ریز اقلام حواله‌ها');

    const fileName = `Sayan_Sales_Remittances_${dateFrom ? dateFrom.replace(/\//g, '-') : 'all'}_to_${dateTo ? dateTo.replace(/\//g, '-') : 'now'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Convert Sayan Result to Document Format
  const getDocData = (r: SayanSalesRemittanceResult): SayanRemittanceData => {
    return {
      companyTitle: 'شرکت لپان بافت',
      remittanceNumber: r.remittanceNumber || r.docNo || '---',
      subCode: r.subCode || '---',
      archiveCode: r.archiveCode || '---',
      shamsiDate: r.shamsiDate || '',
      recipientName: r.personFullName || 'نامشخص',
      recipientCode: r.personCode || '',
      recipientAddress: r.personAddress || '',
      recipientPhone: r.personPhone || '',
      notes: r.note || '',
      items: r.items.map(i => ({
        rowNo: i.rowNo,
        goodsName: i.goodsName,
        netQty: i.netQty,
        grossQty: i.grossQty || i.netQty,
        cartonCount: i.cartonCount || 0,
        bobbinCount: i.bobbinCount || 0,
        grade: i.grade || 'AA',
        twistDirection: i.twistDirection || 'Z',
        description: i.description || ''
      }))
    };
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      
      {/* Top Filter & Action Bar */}
      <div className="bg-slate-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-zinc-700/80 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Title & Status */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
              <Truck size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>استخراج و گزارش حواله‌های فروش سایان</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-mono">
                  STR_TBL_010 / STR_TBL_011
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                مشاهده مستقیم اسناد خروج و حواله‌های ثبت‌شده در پایگاه داده سایان
              </p>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-zinc-900 p-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs">
            <button
              onClick={() => setQuickDate('today')}
              className="px-2.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              امروز
            </button>
            <button
              onClick={() => setQuickDate('yesterday')}
              className="px-2.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              دیروز
            </button>
            <button
              onClick={() => setQuickDate('week')}
              className="px-2.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              ۷ روز اخیر
            </button>
            <button
              onClick={() => setQuickDate('month')}
              className="px-2.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              ماه جاری
            </button>
            <button
              onClick={() => setQuickDate('year')}
              className="px-2.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              کل سال
            </button>
            <button
              onClick={() => setQuickDate('all')}
              className="px-2.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              همه زمان‌ها
            </button>
          </div>
        </div>

        {/* Date Inputs & Search Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-zinc-700/60">
          
          {/* Date From */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              از تاریخ (شمسی):
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="1403/11/01"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <Calendar size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Date To */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              تا تاریخ (شمسی):
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="1403/11/30"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <Calendar size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* DocType Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              نوع سند انبار:
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="23">فقط حواله فروش (۲۳)</option>
              <option value="all">همه اسناد خروج (12, 23, 3, 13)</option>
              <option value="12">سایر حواله‌ها (12)</option>
              <option value="3">حواله انبار / مصرف (3)</option>
              <option value="13">برگشت از فروش (13)</option>
            </select>
          </div>

          {/* Store Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              انبار مبدأ:
            </label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">همه انبارها</option>
              {availableStores.map(st => (
                <option key={st} value={st}>انبار {st}</option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              جستجو در خریدار، شماره حواله یا کالا:
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="شماره حواله، نام خریدار، کد تفصیلی، نام کالا..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={loadRemittances}
              disabled={isLoading}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              <span>{isLoading ? 'در حال دریافت از سایان...' : 'اعمال فیلتر و بارگذاری مجدد'}</span>
            </button>

            {search && (
              <button
                onClick={() => setSearch('')}
                className="px-2.5 py-1.5 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-300 transition-colors"
              >
                پاک‌کردن جستجو
              </button>
            )}
          </div>

          <button
            onClick={() => setIsAiModalOpen(true)}
            disabled={filteredRemittances.length === 0}
            className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-purple-500/20 cursor-pointer"
            title="تحلیل هوشمند و مدیریتی حواله‌های فروش و خروج انبار"
          >
            <Sparkles size={14} className="text-amber-300 animate-pulse" />
            <span>تحلیل هوش مصنوعی حواله‌ها</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredRemittances.length === 0}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Download size={14} />
            <span>خروجی کامل اکسل (شامل ریز اقلام)</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 p-3.5 rounded-xl border border-blue-200/80 dark:border-blue-800/60 shadow-sm">
            <div className="flex items-center justify-between text-blue-700 dark:text-blue-300 mb-1">
              <span className="text-xs font-bold">تعداد حواله‌ها</span>
              <FileText size={16} />
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">
              {filteredRemittances.length.toLocaleString('fa-IR')}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              تعداد {summary.uniqueCustomersCount} مشتری یکتا
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 shadow-sm">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 mb-1">
              <span className="text-xs font-bold">وزن خالص خروج</span>
              <Scale size={16} />
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">
              {summary.totalNetWeight.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-500">kg</span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              مجموع تناژ خالص حواله‌ها
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-800/60 shadow-sm">
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 mb-1">
              <span className="text-xs font-bold">وزن ناخالص خروج</span>
              <Truck size={16} />
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">
              {summary.totalGrossWeight.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-500">kg</span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              با احتساب وزن بسته‌بندی
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/40 dark:to-purple-900/20 p-3.5 rounded-xl border border-purple-200/80 dark:border-purple-800/60 shadow-sm">
            <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 mb-1">
              <span className="text-xs font-bold">کارتن / بوبین</span>
              <Boxes size={16} />
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">
              {summary.totalCartons.toLocaleString('fa-IR')} / {summary.totalBobbins.toLocaleString('fa-IR')}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              تعداد بسته‌بندی‌های ارسال‌شده
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/40 dark:to-indigo-900/20 p-3.5 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300 mb-1">
              <span className="text-xs font-bold">تعداد خریداران متمایز</span>
              <Users size={16} />
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">
              {summary.uniqueCustomersCount.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-500">شخص</span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              تعداد اشخاص و مشتریان طرف‌حساب
            </div>
          </div>

        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadRemittances}
            className="px-3 py-1 bg-rose-600 text-white rounded font-bold hover:bg-rose-700 transition-colors"
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {/* Remittances Data Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        
        <div className="p-3.5 bg-slate-50/70 dark:bg-zinc-800/40 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <Layers size={15} />
            <span>فهرست اسناد و حواله‌های استخراج‌شده ({filteredRemittances.length} مورد)</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            مرتب‌سازی: {sortField === 'docDate' ? 'تاریخ' : sortField === 'remittanceNumber' ? 'شماره حواله' : 'وزن'} ({sortDirection === 'desc' ? 'نزولی' : 'صعودی'})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100/80 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-700 select-none">
              <tr>
                <th className="p-3 w-12 text-center">#</th>
                <th 
                  onClick={() => handleSort('remittanceNumber')}
                  className="p-3 cursor-pointer hover:bg-slate-200/60 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>شماره حواله / سند</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('docDate')}
                  className="p-3 cursor-pointer hover:bg-slate-200/60 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>تاریخ صدور</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('personFullName')}
                  className="p-3 cursor-pointer hover:bg-slate-200/60 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>خریدار / طرف حساب</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="p-3">نوع سند / انبار</th>
                <th className="p-3">اقلام شاخص</th>
                <th 
                  onClick={() => handleSort('totalNetWeight')}
                  className="p-3 text-center cursor-pointer hover:bg-slate-200/60 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>وزن خالص (kg)</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="p-3 text-center">ناخالص (kg)</th>
                <th className="p-3 text-center">کارتن / بوبین</th>
                <th className="p-3 text-center w-36">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-blue-600" />
                      <span className="text-xs font-semibold">در حال استخراج حواله‌ها از سایان ERP...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRemittances.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package size={32} className="text-slate-300" />
                      <span className="text-xs font-semibold">هیچ حواله فروشی در بازه یا فیلتر انتخابی یافت نشد.</span>
                      <span className="text-[11px] text-slate-400">بازه تاریخی را تغییر دهید یا دکمه «همه زمان‌ها» را بزنید.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRemittances.map((r, idx) => (
                  <tr 
                    key={r.docNo || idx} 
                    className="hover:bg-blue-50/40 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="p-3 text-center font-mono text-slate-400 text-[11px]">
                      {idx + 1}
                    </td>

                    <td className="p-3 font-mono font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="text-blue-700 dark:text-blue-400 font-extrabold text-sm">
                          {r.remittanceNumber || r.docNo}
                        </span>
                        {r.docNo && r.docNo !== r.remittanceNumber && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            (سند: {r.docNo})
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-100">
                        {r.shamsiDate}
                      </div>
                      {r.dayOfWeek && (
                        <div className="text-[10px] text-slate-400">
                          {r.dayOfWeek}
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {r.personFullName || 'نامشخص'}
                      </div>
                      {r.personCode && (
                        <div className="text-[10px] font-mono text-slate-400">
                          کد: {r.personCode}
                        </div>
                      )}
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.docType === '12' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                        r.docType === '23' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                        r.docType === '13' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                        'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-slate-300'
                      }`}>
                        {r.docTypeLabel || `کد ${r.docType}`}
                      </span>
                      {r.storeId && (
                        <span className="text-[10px] text-slate-400 mr-1 font-mono">
                          انبار {r.storeId}
                        </span>
                      )}
                    </td>

                    <td className="p-3 max-w-xs truncate text-[11px] text-slate-600 dark:text-slate-300" title={r.items.map(i => i.goodsName).join(' | ')}>
                      {r.items.length > 0 ? (
                        <div className="truncate">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {r.items[0].goodsName}
                          </span>
                          {r.items.length > 1 && (
                            <span className="text-[10px] text-blue-600 mr-1">
                              (+{r.items.length - 1} قلم دیگر)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">بدون ریز اقلام</span>
                      )}
                    </td>

                    <td className="p-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {r.totalNetWeight.toLocaleString('fa-IR')}
                    </td>

                    <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-300">
                      {r.totalGrossWeight > 0 ? r.totalGrossWeight.toLocaleString('fa-IR') : '---'}
                    </td>

                    <td className="p-3 text-center font-mono text-xs">
                      {r.totalCartons > 0 || r.totalBobbins > 0 ? (
                        <span>{r.totalCartons} / {r.totalBobbins}</span>
                      ) : (
                        <span className="text-slate-300 dark:text-zinc-600">-</span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        
                        {/* Detail View Button */}
                        <button
                          onClick={() => {
                            setSelectedRemittance(r);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 rounded-lg transition-colors cursor-pointer"
                          title="مشاهده ریز اقلام"
                        >
                          <Eye size={15} />
                        </button>

                        {/* Print Sayan Remittance Document */}
                        <button
                          onClick={() => {
                            setSelectedRemittance(r);
                            setIsPrintModalOpen(true);
                          }}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 rounded-lg transition-colors cursor-pointer"
                          title="چاپ سند استاندارد حواله سایان"
                        >
                          <Printer size={15} />
                        </button>

                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 1. LINE ITEMS DETAIL MODAL                                                */}
      {/* ========================================================================= */}
      {isDetailModalOpen && selectedRemittance && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[999999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-4xl w-full max-h-[90vh] my-auto flex flex-col shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    ریز اقلام حواله شماره {selectedRemittance.remittanceNumber || selectedRemittance.docNo}
                  </h3>
                  <p className="text-xs text-blue-100">
                    خریدار: {selectedRemittance.personFullName} | تاریخ: {selectedRemittance.shamsiDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setIsPrintModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={14} />
                  <span>چاپ سند رسمی</span>
                </button>
                
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Info Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-700 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">کد شخص / تفصیلی:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                  {selectedRemittance.personCode || '---'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">مجموع وزن خالص:</span>
                <span className="font-black text-emerald-600 font-mono text-sm">
                  {selectedRemittance.totalNetWeight.toLocaleString('fa-IR')} kg
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">مجموع کارتن / بوبین:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                  {selectedRemittance.totalCartons} کارتن / {selectedRemittance.totalBobbins} بوبین
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">انبار مبدأ:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                  انبار {selectedRemittance.storeId || '---'}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-700 sticky top-0">
                  <tr>
                    <th className="p-2.5 text-center w-10">ردیف</th>
                    <th className="p-2.5">کد کالا</th>
                    <th className="p-2.5">نام و شرح کالا</th>
                    <th className="p-2.5 text-center">وزن خالص (kg)</th>
                    <th className="p-2.5 text-center">وزن ناخالص (kg)</th>
                    <th className="p-2.5 text-center">کارتن</th>
                    <th className="p-2.5 text-center">بوبین</th>
                    <th className="p-2.5 text-center">گرید</th>
                    <th className="p-2.5 text-center">جهت تاب</th>
                    <th className="p-2.5">توضیحات ردیف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {selectedRemittance.items.map((item, idx) => (
                    <tr key={item.lineId || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                      <td className="p-2.5 text-center font-mono text-slate-400">
                        {item.rowNo || idx + 1}
                      </td>
                      <td className="p-2.5 font-mono text-slate-500 text-[11px]">
                        {item.itemCode}
                      </td>
                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-100">
                        {item.goodsName}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-emerald-600">
                        {item.netQty.toLocaleString('fa-IR')}
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-600 dark:text-slate-300">
                        {item.grossQty ? item.grossQty.toLocaleString('fa-IR') : item.netQty.toLocaleString('fa-IR')}
                      </td>
                      <td className="p-2.5 text-center font-mono">
                        {item.cartonCount || '-'}
                      </td>
                      <td className="p-2.5 text-center font-mono">
                        {item.bobbinCount || '-'}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-blue-600">
                        {item.grade || 'AA'}
                      </td>
                      <td className="p-2.5 text-center font-mono">
                        {item.twistDirection || 'Z'}
                      </td>
                      <td className="p-2.5 text-slate-500 text-[11px]">
                        {item.description || item.detailNote || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedRemittance.note && (
                <div className="mt-4 p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-bold">یادداشت سربرگ حواله: </span>
                  <span>{selectedRemittance.note}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 dark:bg-zinc-800 border-t border-slate-200 dark:border-zinc-700 flex justify-end gap-2">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                بستن
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* 2. PRINT STANDARD SAYAN REMITTANCE MODAL                                 */}
      {/* ========================================================================= */}
      {isPrintModalOpen && selectedRemittance && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-4xl w-full max-h-[95vh] my-auto flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Controls Bar */}
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Printer size={18} className="text-emerald-400" />
                <span>پیش‌نمایش چاپ سند رسمی حواله فروش سایان ({selectedRemittance.remittanceNumber || selectedRemittance.docNo})</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const printContent = document.getElementById('sayan-sales-remittance-doc');
                    if (!printContent) return;
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) return;
                    printWindow.document.write(`
                      <html dir="rtl">
                        <head>
                          <title>حواله فروش ${selectedRemittance.remittanceNumber || selectedRemittance.docNo}</title>
                          <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
                          <style>
                            @page { size: A4; margin: 8mm; }
                            body { font-family: Vazirmatn, Tahoma, sans-serif; margin: 0; padding: 0; background: #fff; }
                          </style>
                        </head>
                        <body>
                          ${printContent.outerHTML}
                          <script>
                            window.onload = function() { window.print(); window.close(); }
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow"
                >
                  <Printer size={14} />
                  <span>پرینت سند (چاپگر / PDF)</span>
                </button>

                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Document Body Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200 dark:bg-zinc-950 flex justify-center custom-scrollbar">
              <SayanSalesRemittanceDoc
                data={getDocData(selectedRemittance)}
                id="sayan-sales-remittance-doc"
                showStamps={true}
              />
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* AI Strategic Analysis & Engineering Report Modal */}
      <AiSayanReportModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        reportSection="sayanRemittances"
        sectionTitle="گزارش جامع حواله‌های فروش و خروج سایان"
        reportPayload={{
          totalCount: filteredRemittances.length,
          totalNetWeight: summary?.totalNetWeight || 0,
          totalGrossWeight: summary?.totalGrossWeight || 0,
          totalCartons: summary?.totalCartons || 0,
          totalBobbins: summary?.totalBobbins || 0,
          uniqueCustomers: summary?.uniqueCustomersCount || 0,
          topCustomers: ((summary as any)?.topCustomers || []).slice(0, 10),
          topProducts: ((summary as any)?.topGoods || []).slice(0, 10),
          recentRemittances: filteredRemittances.slice(0, 15).map(r => ({
            number: r.remittanceNumber || r.docNo,
            date: r.shamsiDate,
            customer: r.personFullName,
            netWeight: r.totalNetWeight,
            cartons: r.totalCartons,
            bobbins: r.totalBobbins
          }))
        }}
        dateRange={{ from: dateFrom, to: dateTo }}
        settings={settings}
      />

    </div>
  );
};

export default SayanRemittancesTab;
