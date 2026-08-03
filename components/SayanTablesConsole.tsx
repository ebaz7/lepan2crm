import React, { useState, useMemo, useEffect } from 'react';
import { 
  Database, Search, Download, Code, Upload, RefreshCw, 
  AlertTriangle, Terminal, ClipboardCheck, Edit2, Check, X, 
  Calendar, Table as TableIcon, BarChart2, ChevronLeft, 
  ChevronRight, ArrowUpDown, Info, HelpCircle
} from 'lucide-react';
import { apiCall } from '../services/apiService';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { HARDCODED_TABLES } from './sayanTablesData';

// Table Display Names and helper functions
const TABLE_DICTIONARY: Record<string, string> = {
  'invoices': 'لیست فاکتورها (Invoices)',
  'ACT_TBL_001': 'کد حساب / سرفصل (Chart of Accounts)',
  'ACT_TBL_002': 'کدهای معین حسابداری (Moein)',
  'ACT_TBL_003': 'ریز گردش و آرتیکل‌های حسابداری (Journal)',
  'ACT_TBL_007': 'کدهای تفصیلی حسابداری (Tafsili)',
  'ACT_TBL_011': 'تراز آزمایشی / مانده واقعی حساب‌ها (Trial Balance)',
  'BUR_TBL_008': 'برگشت از فروش و تخفیفات (Sales Returns)',
  'BUR_TBL_015': 'لیست فاکتورهای فروش روزانه و ماهانه (Sales Invoices)',
  'STR_TBL_001': 'لیست انبارها و موجودی کالا (Warehouses)',
  'STR_TBL_010': 'حواله‌ها و اسناد خروج کالا (Exit Permits)',
  'STR_TBL_011': 'اقلام و ریز تراکنش‌های حواله انبار (Permit Items)',
  'IND_TBL_001': 'عملیات تولید و سالن‌های صنعتی (Production Lines)',
  'IND_TBL_022': 'لیست کد کالاها و محصولات سالن تولید (Product Codes)',
  'REPORT_TRIAL_BALANCE': 'تراز آزمایشی کل حساب‌ها (Sayan Trial Balance)',
  'REPORT_CUSTOMER_STATEMENT': 'صورتحساب مشتریان (Customer Statement)',
  'REPORT_SALES': 'گزارش و آنالیز فروش روزانه/ماهانه (Sales Analysis)',
  'REPORT_DEBTORS': 'گزارش مطالبات و بدهکاران (Accounts Receivable)',
  'REPORT_BANKS': 'مانده حساب‌های بانکی و چک‌های نزد صندوق (Cash & Banks)',
  'REPORT_INVENTORY': 'گزارش موجودی کالا و انبارها (Inventory Report)',
  'REPORT_PRODUCTION': 'گزارش تولید و عملیات صنعتی (Production Report)',
  'REPORT_ACT_TRANSACTIONS': 'ریز گردش و آرتیکل‌های حسابداری (Accounting Ledger)',
  'REPORT_DB_SCHEMA': 'استخراج ساختار کل دیتابیس (Sayan DB Schema)',
  'REPORT_DB_ROWCOUNTS': 'حجم و تعداد ردیف جداول دیتابیس (Sayan DB Stats)'
};

const getTableDisplayName = (tableName: string): string => {
  return TABLE_DICTIONARY[tableName] || tableName;
};

// A highly polished, Excel-like Report Visualizer
interface ReportVisualizerProps {
  activeTable: string;
  data: any[];
}

const ReportVisualizer: React.FC<ReportVisualizerProps> = ({ activeTable, data }) => {
  const [timeFilter, setTimeFilter] = useState<'daily' | 'monthly' | 'yearly'>('monthly');

  const summaryStats = useMemo(() => {
    return data.reduce((acc, row) => {
      const amount = parseFloat(row.TotalSales || row.Field_025 || row.Field_010 || row.Field_011 || row.Field_008 || row.Amount || 0);
      if (!isNaN(amount) && amount > 0) {
        acc.totalAmount += amount;
      }
      acc.totalCount++;
      return acc;
    }, { totalAmount: 0, totalCount: 0 });
  }, [data]);

  const chartData = useMemo(() => {
    const dateKey = Object.keys(data[0] || {}).find(k => 
      typeof data[0][k] === 'string' && 
      (data[0][k].includes('T00:00') || data[0][k].match(/^\d{4}[/-]\d{2}[/-]\d{2}/))
    ) || 'Field_008' || 'Date';

    if (!data.length || !data[0][dateKey]) return [];

    const aggs: Record<string, number> = {};
    data.forEach(r => {
      const amt = parseFloat(r.TotalSales || r.Field_025 || r.Field_010 || r.Field_011 || r.Field_008 || r.Amount || 0) || 0;
      const rawDate = String(r[dateKey]);
      let dKey = rawDate;

      if (timeFilter === 'daily') dKey = rawDate.substring(0, 10);
      else if (timeFilter === 'monthly') dKey = rawDate.substring(0, 7);
      else if (timeFilter === 'yearly') dKey = rawDate.substring(0, 4);
      
      aggs[dKey] = (aggs[dKey] || 0) + amt;
    });

    return Object.entries(aggs)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(-15);
  }, [data, timeFilter]);

  if (activeTable === 'REPORT_SALES') {
    return (
      <div className="space-y-4 mb-4 select-text">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-emerald-600/80 text-[11px] font-bold mb-1">جمع کل مبالغ فروش (ریال)</span>
            <span className="text-2xl font-black text-emerald-700 font-mono" dir="ltr">
              {summaryStats.totalAmount.toLocaleString('fa-IR')}
            </span>
          </div>
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-teal-600/80 text-[11px] font-bold mb-1">تعداد اسناد و ردیف‌ها</span>
            <span className="text-2xl font-black text-teal-700 font-mono" dir="ltr">
              {summaryStats.totalCount.toLocaleString('fa-IR')}
            </span>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <BarChart2 size={14} className="text-emerald-600" />
                نمودار تحلیلی رشد مبالغ فروش
              </span>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setTimeFilter('daily')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${timeFilter === 'daily' ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}>روزانه</button>
                <button onClick={() => setTimeFilter('monthly')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${timeFilter === 'monthly' ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}>ماهانه</button>
                <button onClick={() => setTimeFilter('yearly')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${timeFilter === 'yearly' ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}>سالانه</button>
              </div>
            </div>
            
            <div className="h-44 flex items-end gap-1 px-2 border-b border-gray-200 pb-1 font-mono text-[9px] text-gray-400">
              {chartData.map((d, i) => {
                const maxVal = Math.max(...chartData.map(x => x.value)) || 1;
                const pct = (d.value / maxVal) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                    <div 
                      style={{ height: `${Math.max(pct, 5)}%` }} 
                      className="w-full bg-emerald-500 group-hover:bg-emerald-600 rounded-t transition-all relative"
                    >
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-gray-900 text-white rounded p-1 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow z-20" dir="ltr">
                        {d.value.toLocaleString()} ریال
                      </div>
                    </div>
                    <span className="text-[8px] transform -rotate-45 origin-right whitespace-nowrap mt-1 select-none">{d.name}</span>
                  </div>
                );
              })}
            </div>
            <div className="h-4"></div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

const SayanTablesConsole: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<string>('REPORT_TRIAL_BALANCE');
  const [customMode, setCustomMode] = useState(false);
  const [reportMode, setReportMode] = useState(true);

  // Advanced developer test attributes
  const [customTableName, setCustomTableName] = useState('');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT'>('GET');
  const [customPath, setCustomPath] = useState('');
  const [reqBody, setReqBody] = useState('');
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Search & Sorting & Pagination & Column Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Dynamic discovery
  const [discoveredTables, setDiscoveredTables] = useState<any[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [isExtractingAll, setIsExtractingAll] = useState(false);

  // Copy states
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedTables, setCopiedTables] = useState(false);

  // Custom persistent/temporary renaming of columns/tables
  const [customTableNames, setCustomTableNames] = useState<Record<string, string>>({});
  const [editingTableName, setEditingTableName] = useState<string | null>(null);
  const [tempTableName, setTempTableName] = useState('');

  // Fetch standard data or custom query
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setRawResponse(null);
    setCurrentPage(1);

    try {
      let finalPath = '';
      let finalMethod = 'GET';
      let finalBody: any = null;

      if (customMode) {
        finalPath = customPath || 'invoices';
        finalMethod = method;
        if (reqBody && (method === 'POST' || method === 'PUT')) {
          try {
            finalBody = JSON.parse(reqBody);
          } catch (e: any) {
            throw new Error('فرمت بدنه درخواست (JSON) نامعتبر است: ' + e.message);
          }
        }
      } else {
        // Standard table / Report mode mapping
        if (activeTable.startsWith('REPORT_')) {
          finalPath = 'sayan-proxy'; // Proxy
          finalMethod = 'POST';
          
          let sqlQuery = '';
          if (activeTable === 'REPORT_TRIAL_BALANCE') {
            sqlQuery = 'SELECT TOP 1000 * FROM ACT_TBL_011';
          } else if (activeTable === 'REPORT_CUSTOMER_STATEMENT') {
            sqlQuery = 'SELECT TOP 1000 * FROM ACT_TBL_003 WHERE Field_003 = \'101001\'';
          } else if (activeTable === 'REPORT_DEBTORS') {
            sqlQuery = 'SELECT TOP 1000 * FROM ACT_TBL_001 WHERE Field_005 LIKE \'103%\'';
          } else if (activeTable === 'REPORT_BANKS') {
            sqlQuery = 'SELECT TOP 1000 * FROM ACT_TBL_001 WHERE Field_005 LIKE \'101%\'';
          } else if (activeTable === 'REPORT_SALES') {
            sqlQuery = 'SELECT TOP 1000 * FROM BUR_TBL_015';
          } else if (activeTable === 'REPORT_INVENTORY') {
            sqlQuery = 'SELECT TOP 1000 * FROM STR_TBL_001';
          } else if (activeTable === 'REPORT_PRODUCTION') {
            sqlQuery = 'SELECT TOP 1000 * FROM IND_TBL_001';
          } else if (activeTable === 'REPORT_ACT_TRANSACTIONS') {
            sqlQuery = 'SELECT TOP 1000 * FROM ACT_TBL_003';
          } else if (activeTable === 'REPORT_DB_SCHEMA') {
            sqlQuery = 'SELECT t.name AS TableName, c.name AS ColumnName, ty.name AS DataType FROM sys.tables t INNER JOIN sys.columns c ON t.object_id = c.object_id INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id ORDER BY t.name, c.column_id';
          } else if (activeTable === 'REPORT_DB_ROWCOUNTS') {
            sqlQuery = 'SELECT t.NAME AS TableName, p.rows AS RowCounts FROM sys.tables t INNER JOIN sys.indexes i ON t.OBJECT_ID = i.object_id INNER JOIN sys.partitions p ON i.object_id = p.OBJECT_ID AND i.index_id = p.index_id WHERE t.is_ms_shipped = 0 GROUP BY t.NAME, p.Rows ORDER BY p.rows DESC';
          }

          finalBody = {
            path: 'sql',
            method: 'POST',
            body: { query: sqlQuery }
          };
        } else {
          // Hardcoded raw table exploration
          finalPath = 'sayan-proxy';
          finalMethod = 'POST';
          finalBody = {
            path: activeTable,
            method: 'GET',
            body: null
          };
        }
      }

      const result: any = await apiCall(
        finalPath.startsWith('/') ? finalPath : `/${finalPath}`, 
        finalMethod, 
        finalBody
      );

      setRawResponse(result);

      // Check format of response
      let listData: any[] = [];
      if (Array.isArray(result)) {
        listData = result;
      } else if (result && Array.isArray(result.data)) {
        listData = result.data;
      } else if (result && result.data && Array.isArray(result.data.data)) {
        listData = result.data.data;
      } else if (result && typeof result === 'object') {
        // Try to find any array inside key values
        const possibleArray = Object.values(result).find(val => Array.isArray(val));
        if (possibleArray) {
          listData = possibleArray as any[];
        } else {
          listData = [result]; // Wrap object as single row
        }
      }

      setData(listData);

      if (listData.length === 0) {
        if (result && (result.message || result.error)) {
          setError(`⚠️ پاسخ سایان: ${result.message || result.error}`);
        }
      }
    } catch (err: any) {
      console.error('Sayan Fetch Error:', err);
      setError(err.message || 'خطا در ارتباط با وب‌سرویس یا دیتابیس سایان ERP');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTable, customMode]);

  // Discover Table Schemas dynamically via SQL Server system tables
  const discoverTablesFromSql = async () => {
    setDiscovering(true);
    setError(null);
    try {
      const sqlQuery = "SELECT SCHEMA_NAME(schema_id) AS schemaName, name AS tableName FROM sys.tables ORDER BY name ASC";
      const result: any = await apiCall('/sayan-proxy', 'POST', {
        path: 'sql',
        method: 'POST',
        body: { query: sqlQuery }
      });
      
      let tablesList: any[] = [];
      if (result && Array.isArray(result.data)) tablesList = result.data;
      else if (Array.isArray(result)) tablesList = result;

      if (tablesList.length > 0) {
        setDiscoveredTables(tablesList);
        toastNotify('لیست جداول سیستم با موفقیت واکشی شد.');
      } else {
        setError('لیست جداول دیتابیس خالی برگردانده شد. لطفا اتصال SQL سایان را بررسی کنید.');
      }
    } catch (e: any) {
      setError('خطا در واکشی جداول دیتابیس: ' + e.message);
    } finally {
      setDiscovering(false);
    }
  };

  // Run deep diagnostics
  const runDeepDiagnostic = async () => {
    setDiagnosing(true);
    setShowDebug(true);
    try {
      const sqlQuery = "SELECT @@VERSION as Version, DB_NAME() as CurrentDatabase, (SELECT COUNT(*) FROM sys.tables) as TotalTables";
      const result: any = await apiCall('/sayan-proxy', 'POST', {
        path: 'sql',
        method: 'POST',
        body: { query: sqlQuery }
      });
      setRawResponse(result);
      toastNotify('اطلاعات دیباگ و کانکشن SQL واکشی شد.');
    } catch (e: any) {
      setError('خطا در دیباگ اتصال: ' + e.message);
    } finally {
      setDiagnosing(false);
    }
  };

  // Extract all Sayan data to Excel
  const extractAllSayanDataToExcel = () => {
    if (!data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sayan_Data");
    XLSX.writeFile(wb, `Sayan_${activeTable}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const saveAllSayanDataToServer = async () => {
    setIsExtractingAll(true);
    try {
      await apiCall('/sayan/sales-report/save-sample', 'POST', { table: activeTable, data });
      toastNotify('داده‌های نمونه جهت پردازش هوشمند در سرور با موفقیت ذخیره شدند.');
    } catch (e: any) {
      setError('خطا در ذخیره داده‌ها در سرور: ' + e.message);
    } finally {
      setIsExtractingAll(false);
    }
  };

  const saveCustomTableName = (tableName: string) => {
    if (tempTableName.trim()) {
      setCustomTableNames(prev => ({ ...prev, [tableName]: tempTableName.trim() }));
    }
    setEditingTableName(null);
  };

  const toastNotify = (msg: string) => {
    alert(msg);
  };

  // Sorting Handler
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter & Search Logic (Excel-like filtering)
  const filteredData = useMemo(() => {
    if (!data.length) return [];
    
    return data.filter(row => {
      // 1. Global Search Term filter
      if (searchTerm) {
        const globalMatch = Object.values(row).some(val => 
          String(val ?? '').toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (!globalMatch) return false;
      }

      // 2. Column-specific filters (Excel Mode!)
      for (const [colKey, filterVal] of Object.entries(columnFilters)) {
        if (!filterVal) continue;
        const cellValue = String(row[colKey] ?? '').toLowerCase();
        
        // Advanced excel formula operators: support = (equals) or > or <
        if (filterVal.startsWith('=')) {
          const exactVal = filterVal.substring(1).trim().toLowerCase();
          if (cellValue !== exactVal) return false;
        } else {
          // Default: Contains search
          if (!cellValue.includes(filterVal.toLowerCase())) return false;
        }
      }

      return true;
    });
  }, [data, searchTerm, columnFilters]);

  // Sorted Data
  const sortedData = useMemo(() => {
    const list = [...filteredData];
    if (sortConfig !== null) {
      list.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        const isNumA = !isNaN(Number(aVal));
        const isNumB = !isNaN(Number(bVal));

        if (isNumA && isNumB) {
          return sortConfig.direction === 'asc' 
            ? Number(aVal) - Number(bVal)
            : Number(bVal) - Number(aVal);
        }

        return sortConfig.direction === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }
    return list;
  }, [filteredData, sortConfig]);

  // Paginated Data
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return sortedData.slice(startIdx, startIdx + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;

  // Clipboard Copiers
  const handleCopyResponse = () => {
    if (!rawResponse) return;
    navigator.clipboard.writeText(JSON.stringify(rawResponse, null, 2));
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const handleCopyTables = () => {
    if (!discoveredTables.length) return;
    navigator.clipboard.writeText(JSON.stringify(discoveredTables, null, 2));
    setCopiedTables(true);
    setTimeout(() => setCopiedTables(false), 2000);
  };

  return (
    <div className="flex bg-gray-50 dark:bg-gray-900 h-full min-h-0 select-text">
      {/* Sidebar - Sayan Tables List */}
      <div className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Database className="text-emerald-600" size={20} />
            <h2 className="font-bold text-sm text-gray-800 dark:text-gray-100">پنل جداول خام سایان</h2>
          </div>
          <span className="text-[10px] bg-emerald-50 text-emerald-800 p-2 rounded text-justify leading-relaxed">
            کوئری‌ها به طور زنده و از طریق کانکشن پروکسی سرور به دیتابیس SQL و سرور وب‌سرویس سایان ارسال می‌شوند.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-emerald-50/20 space-y-2">
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">فراخوانی جدول دلخواه:</label>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (customTableName.trim()) {
                setCustomMode(false);
                setActiveTable(customTableName.trim());
              }
            }} className="flex gap-1.5">
              <input 
                type="text" 
                className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-1.5 text-xs font-mono dir-ltr outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800 dark:text-white"
                placeholder="STR_TBL_011"
                value={customTableName}
                onChange={(e) => setCustomTableName(e.target.value)}
              />
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 text-xs font-bold transition-all shadow-sm">
                نمایش
              </button>
            </form>
          </div>

          <button 
            type="button"
            onClick={discoverTablesFromSql}
            disabled={discovering}
            className="w-full py-1.5 px-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
          >
            {discovering ? <RefreshCw size={12} className="animate-spin" /> : <TableIcon size={12} />}
            استخراج خودکار لیست جداول از SQL
          </button>
          <button 
            type="button"
            onClick={runDeepDiagnostic}
            disabled={diagnosing}
            className="w-full py-1.5 px-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
          >
            {diagnosing ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
            تست اتصال و عیب‌یابی دیتابیس
          </button>
        </div>

        {/* Dev Mode Trigger */}
        <div className="p-2 border-b bg-gray-50/50 space-y-2">
          <button 
            type="button"
            onClick={() => setCustomMode(!customMode)}
            className={`w-full p-2 rounded-lg flex items-center gap-2 justify-center text-xs font-bold transition-all border ${
              customMode 
                ? 'bg-amber-600 text-white border-amber-500 shadow' 
                : 'bg-white dark:bg-gray-700 text-amber-700 border-amber-200 hover:bg-amber-50'
            }`}
          >
            <Code size={14} />
            {customMode ? 'بازگشت به جداول استاندارد' : 'تست کوئری مستقیم / کنسول API'}
          </button>
        </div>

        {/* Tables Navigation Section */}
        {!customMode ? (
          <div className="p-2 space-y-1">
            {/* Discovered Tables */}
            {discoveredTables.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 px-2 py-1 bg-teal-50 dark:bg-teal-900/40 rounded mb-1.5">
                  <Database className="text-teal-600 dark:text-teal-400" size={12} />
                  <span className="text-[10px] font-black text-teal-800 dark:text-teal-300">جداول کشف شده دیتابیس ({discoveredTables.length}):</span>
                </div>
                <div className="max-h-48 overflow-y-auto border border-teal-100 rounded-lg p-1 space-y-1">
                  {discoveredTables.map((tbl, i) => {
                    const fullTableName = `${tbl.schemaName}.${tbl.tableName}`;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setCustomMode(false);
                          setActiveTable(fullTableName);
                        }}
                        className={`w-full text-right p-1.5 rounded transition-all flex flex-col ${
                          activeTable === fullTableName 
                            ? 'bg-teal-100 dark:bg-teal-900 text-teal-950 dark:text-teal-100 font-extrabold' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span className="text-[10px] font-bold leading-tight">{tbl.tableName}</span>
                        <span className="text-[8px] font-mono text-gray-400" dir="ltr">{fullTableName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reports List */}
            <div className="mb-4 space-y-1">
              <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/40 rounded mb-1.5">
                <BarChart2 className="text-blue-600 dark:text-blue-400" size={12} />
                <span className="text-[10px] font-black text-blue-800 dark:text-blue-300">گزارشات مبالغ و تحلیل‌ها:</span>
              </div>
              
              <button
                onClick={() => { setCustomMode(false); setReportMode(true); setActiveTable('REPORT_TRIAL_BALANCE'); }}
                className={`w-full text-right p-2.5 rounded-lg transition-all flex flex-col ${
                  !customMode && activeTable === 'REPORT_TRIAL_BALANCE' ? 'bg-blue-600 text-white shadow' : 'bg-white border border-blue-100 hover:bg-blue-50 text-gray-700'
                }`}
              >
                <span className="font-bold text-[11px]">تراز آزمایشی کل حساب‌ها</span>
                <span className="text-[8px] font-mono opacity-75" dir="ltr">ACT_TBL_011</span>
              </button>
              
              <button
                onClick={() => { setCustomMode(false); setReportMode(true); setActiveTable('REPORT_SALES'); }}
                className={`w-full text-right p-2.5 rounded-lg transition-all flex flex-col ${
                  !customMode && activeTable === 'REPORT_SALES' ? 'bg-emerald-600 text-white shadow' : 'bg-white border border-emerald-100 hover:bg-emerald-50 text-gray-700'
                }`}
              >
                <span className="font-bold text-[11px]">گزارش و آنالیز فروش روزانه/ماهانه</span>
                <span className="text-[8px] font-mono opacity-75" dir="ltr">BUR_TBL_015 / 008</span>
              </button>

              <button
                onClick={() => { setCustomMode(false); setReportMode(true); setActiveTable('REPORT_BANKS'); }}
                className={`w-full text-right p-2.5 rounded-lg transition-all flex flex-col ${
                  !customMode && activeTable === 'REPORT_BANKS' ? 'bg-amber-600 text-white shadow' : 'bg-white border border-amber-100 hover:bg-amber-50 text-gray-700'
                }`}
              >
                <span className="font-bold text-[11px]">مانده حساب‌های بانکی و صندوق</span>
                <span className="text-[8px] font-mono opacity-75" dir="ltr">ACT_TBL_001 / TRC_TBL</span>
              </button>
            </div>

            {/* Standard ERP Tables */}
            <div className="mb-4">
              <div className="flex items-center gap-2 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/40 rounded mb-1.5">
                <TableIcon className="text-indigo-600 dark:text-indigo-400" size={12} />
                <span className="text-[10px] font-black text-indigo-800 dark:text-indigo-300">جداول اصلی سایان ERP:</span>
              </div>
              <div className="max-h-72 overflow-y-auto border border-indigo-50 rounded-lg p-1 space-y-1">
                {HARDCODED_TABLES.map((tableName, i) => {
                  const displayName = customTableNames[tableName] || getTableDisplayName(tableName);
                  const isEditing = editingTableName === tableName;
                  return (
                    <div key={i} className={`rounded p-1 transition-all ${activeTable === tableName ? 'bg-indigo-100 dark:bg-indigo-950' : 'hover:bg-gray-50'} flex items-center justify-between`}>
                      <button
                        onClick={() => {
                          setCustomMode(false);
                          setReportMode(false);
                          setActiveTable(tableName);
                        }}
                        className="flex-1 text-right flex flex-col items-start min-w-0"
                      >
                        <span className="text-[10px] font-bold text-gray-800 truncate w-full">{displayName}</span>
                        <span className="text-[8px] font-mono text-gray-400 truncate w-full" dir="ltr">{tableName}</span>
                      </button>
                      <button onClick={() => { setEditingTableName(tableName); setTempTableName(customTableNames[tableName] || ''); }} className="p-1 text-gray-400 hover:text-indigo-600">
                        <Edit2 size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-xs space-y-4 text-gray-600 dark:text-gray-400">
            <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 p-3 rounded-lg leading-relaxed text-[11px]">
              👉 در این بخش امکان فراخوانی زنده هر مسیر دلخواه دیتابیسی با متد دلخواه جهت عیب‌یابی درگاه اتصال فراهم است.
            </div>
          </div>
        )}
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex gap-4 items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <span>{customMode ? 'کنسول مدیریت و عیب‌یابی کوئری مستقیم' : getTableDisplayName(activeTable)}</span>
              {customMode && <span className="bg-amber-100 text-amber-800 text-[9px] px-2 py-0.5 rounded font-black">حالت برنامه نویس</span>}
            </h1>
            <p className="text-[10px] text-gray-400 font-mono mt-0.5" dir="ltr">
              sayan_proxy::GET /{activeTable}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchData} 
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              بروزرسانی داده‌ها
            </button>
            <button 
              onClick={extractAllSayanDataToExcel} 
              disabled={!data.length} 
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm"
            >
              <Download size={12} />
              خروجی اکسل
            </button>
          </div>
        </header>

        {/* Developer Console Body if active */}
        {customMode && (
          <div className="bg-white dark:bg-gray-800 border-b p-4 grid grid-cols-1 md:grid-cols-12 gap-4 flex-shrink-0 animate-fade-in shadow-inner">
            <div className="md:col-span-5 space-y-2">
              <label className="text-[10px] font-bold text-gray-400 block">METHOD & PATH</label>
              <div className="flex gap-2">
                {['GET', 'POST', 'PUT'].map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMethod(m as any); if (m === 'GET') setReqBody(''); }}
                    className={`flex-1 p-1 text-center text-xs font-bold rounded border ${method === m ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-50'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <input 
                type="text" 
                value={customPath} 
                onChange={(e) => setCustomPath(e.target.value)} 
                className="w-full bg-gray-50 border rounded p-1.5 text-xs font-mono dir-ltr outline-none" 
                placeholder="sql"
              />
            </div>
            <div className="md:col-span-7">
              <label className="text-[10px] font-bold text-gray-400 block mb-1">بدنه درخواست (JSON) یا کوئری مستقیم SQL</label>
              <textarea 
                rows={3}
                value={reqBody}
                onChange={(e) => setReqBody(e.target.value)}
                disabled={method === 'GET'}
                className="w-full border rounded p-1.5 text-xs font-mono dir-ltr bg-gray-900 text-green-400 outline-none"
                placeholder={method === 'GET' ? '// متد GET بدنه نیاز ندارد' : '{"query": "SELECT TOP 10 * FROM ACT_TBL_011"}'}
              />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Sayan Connection Error Viewer */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 flex flex-col gap-3 animate-fade-in shadow-sm select-text">
              <div className="flex items-start gap-3">
                <AlertTriangle className="shrink-0 mt-0.5 text-red-600" size={18} />
                <div className="space-y-1 flex-1">
                  <div className="text-xs font-black">خطا در فرآیند ارتباط با درگاه وب‌سرویس سایان ERP:</div>
                  <div className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap font-semibold">{error}</div>
                </div>
              </div>
              
              <div className="bg-gray-950 text-emerald-400 p-3 rounded-lg border border-gray-800 font-mono text-[9px] relative overflow-hidden" dir="ltr">
                <div className="flex justify-between items-center mb-1.5 border-b border-gray-800 pb-1">
                  <span className="text-gray-400 font-bold flex items-center gap-1"><Terminal size={11}/> Diagnostics Stack</span>
                  <button onClick={handleCopyResponse} className="bg-gray-800 hover:bg-gray-700 text-white p-0.5 rounded text-[9px] px-1.5">
                    {copiedResponse ? 'کپی شد!' : 'کپی کل پاسخ'}
                  </button>
                </div>
                <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {rawResponse ? JSON.stringify(rawResponse, null, 2) : '// هیچ فیدبک دریافتی از سرور وجود ندارد. اتصال شبکه پروکسی سرور را بسنجید.'}
                </pre>
              </div>
            </div>
          )}

          {/* Report Visualizer (Graph stats if sales or reports) */}
          {reportMode && data.length > 0 && activeTable.startsWith('REPORT_') && (
            <ReportVisualizer activeTable={activeTable} data={data} />
          )}

          {/* Standard Excel-like Data Table Grid */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
            {/* Top Table Toolbar */}
            <div className="p-3 bg-gray-50 border-b flex flex-wrap gap-2 items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search size={14} className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="جستجوی همه‌جانبه کل ردیف‌ها..."
                    className="w-full bg-white border border-gray-300 rounded-lg pr-8 pl-3 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-gray-400 font-sans">
                  نمایش {sortedData.length.toLocaleString('fa-IR')} از {data.length.toLocaleString('fa-IR')} ردیف
                </span>
              </div>

              {/* Excel Mode Indicator Info */}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="bg-emerald-100 text-emerald-800 font-bold text-[9px] px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
                  <span className="font-mono">=</span> فیلترهای بالا ستونی اکسل فعال است
                </span>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <RefreshCw className="animate-spin text-emerald-600 mb-4" size={32} />
                <p className="text-gray-600 dark:text-gray-400 font-bold text-xs">در حال بارگذاری زنده اطلاعات از سایان...</p>
              </div>
            ) : data.length > 0 ? (
              <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
                <table className="w-full text-xs text-right border-collapse select-text">
                  <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
                    {/* Header sorting row */}
                    <tr>
                      {Object.keys(data[0])
                        .filter(key => data.some(row => row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== ''))
                        .map((key) => {
                          let displayName = key;
                          if (key === 'Field_001') displayName = 'شناسه فیزیکی';
                          else if (key === 'Field_002') displayName = 'کد عطف';
                          else if (key === 'Field_003') displayName = 'کد حساب / معین';
                          else if (key === 'Field_004') displayName = 'کد تفصیلی';
                          else if (key === 'Field_005') displayName = 'عنوان کد معین / تفصیلی';
                          else if (key === 'Field_006') displayName = 'نام حساب / شرح ردیف';
                          else if (key === 'Field_010') displayName = 'مبلغ بدهکار (Debit)';
                          else if (key === 'Field_011') displayName = 'مبلغ بستانکار (Credit)';
                          else if (key === 'Field_012') displayName = 'مانده نهایی (Balance)';

                          return (
                            <th 
                              key={key} 
                              onClick={() => handleSort(key)}
                              className="px-3 py-2 cursor-pointer hover:bg-gray-200 border-b font-extrabold text-[10px] text-gray-700 whitespace-nowrap"
                            >
                              <div className="flex items-center gap-1 justify-between">
                                <div className="flex flex-col text-right">
                                  <span>{displayName}</span>
                                  <span className="text-[8px] text-gray-400 font-mono">{key}</span>
                                </div>
                                <ArrowUpDown size={10} className="text-gray-400" />
                              </div>
                            </th>
                          );
                        })}
                    </tr>
                    {/* Excel column-specific filtering row */}
                    <tr className="bg-gray-50 border-b">
                      {Object.keys(data[0])
                        .filter(key => data.some(row => row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== ''))
                        .map((key) => (
                          <td key={`filter-${key}`} className="px-2 py-1">
                            <input 
                              type="text"
                              value={columnFilters[key] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setColumnFilters(prev => ({ ...prev, [key]: val }));
                                setCurrentPage(1);
                              }}
                              placeholder="مساوی یا حاوی..."
                              className="w-full p-1 bg-white border border-gray-300 rounded text-[9px] font-mono outline-none focus:border-emerald-500"
                              dir="rtl"
                            />
                          </td>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white font-mono text-[10px]">
                    {paginatedData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        {Object.keys(data[0])
                          .filter(key => data.some(row => row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== ''))
                          .map((key, vIdx) => {
                            const val = row[key];
                            const textVal = String(val ?? '');

                            // Auto formatting for monetary/numerical values
                            const isAmount = ['Field_010', 'Field_011', 'Field_012', 'Amount', 'TotalSales', 'Debit', 'Credit', 'Balance'].includes(key) || 
                                             (!isNaN(Number(textVal)) && textVal.length > 5 && !textVal.startsWith('0') && !textVal.includes('-') && !textVal.includes('/'));

                            let formattedVal = textVal;
                            if (isAmount && !isNaN(Number(textVal))) {
                              formattedVal = Number(textVal).toLocaleString('fa-IR');
                            }

                            return (
                              <td 
                                key={vIdx} 
                                className={`px-3 py-2 text-gray-700 whitespace-nowrap text-right ${isAmount ? 'font-black text-emerald-700' : ''}`}
                              >
                                {formattedVal}
                              </td>
                            );
                          })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <TableIcon size={40} className="mb-2 stroke-1" />
                <p className="text-xs font-bold">هیچ داده‌ای یافت نشد.</p>
              </div>
            )}

            {/* Pagination Controls */}
            {sortedData.length > pageSize && (
              <div className="p-3 bg-gray-50 border-t flex justify-between items-center select-none">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">اندازه صفحه:</span>
                  <select 
                    value={pageSize} 
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="border text-[10px] p-1 bg-white rounded"
                  >
                    {[15, 30, 50, 100, 200].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="p-1 rounded bg-white border hover:bg-gray-100 disabled:opacity-40 text-gray-600"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <span className="text-[10px] font-sans font-bold text-gray-600">
                    صفحه {currentPage.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
                  </span>
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="p-1 rounded bg-white border hover:bg-gray-100 disabled:opacity-40 text-gray-600"
                  >
                    <ChevronLeft size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Interactive SQL Guide */}
          <div className="bg-indigo-50 border border-indigo-150 p-4 rounded-xl flex items-start gap-3">
            <span className="text-lg">💡</span>
            <div className="text-[11px] text-indigo-900 leading-relaxed space-y-1 select-text">
              <span className="font-bold block text-xs">راهنمای فیلتر ستونی اکسل سایان:</span>
              <span>شما می‌توانید به صورت مستقیم در ردیف بالایی هر ستون مقدار مدنظر را فیلتر کنید. </span>
              <span>برای مثال تایپ کردن نام یک حساب فوراً تمام ردیف‌های مربوطه را استخراج می‌کند. </span>
              <span>برای تطابق دقیق و مساوی، علامت <strong className="font-mono text-xs">=</strong> را در ابتدای مقدار فیلتر وارد کنید (مثال: <strong className="font-mono bg-white px-1 rounded border">=101001</strong>).</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SayanTablesConsole;
