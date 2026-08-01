import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, Search, FileSpreadsheet, UserCheck, Trash2, Wallet, Plus, Loader2, Landmark, TrendingDown, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { downloadAndOpenFile } from '../services/fileService';
import { apiCall } from '../services/apiService';

interface CustomerBalance {
  id: string;
  accountCode: string;
  name: string;
  balance: number;
  type: 'بدهکار' | 'بستانکار';
  updatedAt: string;
}

interface ChatCodeMap {
  chatId: string;
  platform: 'telegram' | 'bale';
  accountCode: string;
  updatedAt?: number;
}

interface CustomerStatement {
  id: string;
  accountCode: string;
  fileName: string;
  fileType: string;
  uploadedAt: number;
}

export const CustomerBalanceModule: React.FC<{ currentUser?: any }> = ({ currentUser }) => {
  const [balances, setBalances] = useState<CustomerBalance[]>([]);
  const [chatCodes, setChatCodes] = useState<ChatCodeMap[]>([]);
  const [statements, setStatements] = useState<CustomerStatement[]>([]);
  const [lastUploadTime, setLastUploadTime] = useState<number | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'debit' | 'credit'>('all');
  const [activeSubTab, setActiveSubTab] = useState<'balances' | 'mappings'>('balances');
  const [hideZeroBalances, setHideZeroBalances] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pdfLoadingDebtors, setPdfLoadingDebtors] = useState(false);
  const [pdfLoadingCreditors, setPdfLoadingCreditors] = useState(false);

  // Excluded account codes from final report
  const [excludedCodes, setExcludedCodes] = useState<string[]>([]);
  const [selectedForBulk, setSelectedForBulk] = useState<string[]>([]);
  const [hideExcludedLocally, setHideExcludedLocally] = useState<boolean>(false);

  // Manual Mapping Form
  const [mapChatId, setMapChatId] = useState('');
  const [mapPlatform, setMapPlatform] = useState<'telegram' | 'bale'>('telegram');
  const [mapAccountCode, setMapAccountCode] = useState('');

  // Statement Upload Modals
  const [stmtModalCode, setStmtModalCode] = useState<string | null>(null);
  const [stmtUploadLoading, setStmtUploadLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const dataBal = await apiCall<any>('/customer-balances');
      setBalances(dataBal.balances || []);
      setLastUploadTime(dataBal.lastXlsxUploadAt || null);
      
      const dataMap = await apiCall<any>('/customer-balances/chat-codes');
      setChatCodes(dataMap);
      
      const dataStmts = await apiCall<any>('/customer-balances/statements/all');
      setStatements(dataStmts);
    } catch (error) {
      console.error('Error fetching customer balance data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const normalizeNumber = (val: any): number => {
      if (val === undefined || val === null || val === '') return 0;
      let str = String(val).trim();
      
      const PersianDigits = '۰۱۲۳۴۵۶۷۸۹';
      const ArabicDigits = '٠١٢٣٤٥٦٧٨٩';
      
      let cleanStr = '';
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const pIdx = PersianDigits.indexOf(char);
        if (pIdx !== -1) {
          cleanStr += pIdx.toString();
          continue;
        }
        const aIdx = ArabicDigits.indexOf(char);
        if (aIdx !== -1) {
          cleanStr += aIdx.toString();
          continue;
        }
        if ((char >= '0' && char <= '9') || char === '-' || char === '.') {
          cleanStr += char;
        }
      }
      
      const num = parseFloat(cleanStr);
      return isNaN(num) ? 0 : num;
    };

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const parsedRows = XLSX.utils.sheet_to_json(ws) as any[];

        if (parsedRows.length === 0) {
          alert('فایل اکسل تهی است یا خوانده نشد.');
          return;
        }

        const validRecords: any[] = [];
        for (const row of parsedRows) {
          const keys = Object.keys(row);
          if (keys.length === 0) continue;

          // ... (existing mapping)
          const accountCodeRow = 
            row['کد تفصیلی'] || 
            row['کد حساب'] || 
            row['کد حسابداری'] || 
            row['کد'] || 
            row['AccountCode'] || 
            row['کد کل'] || 
            row['کد معین'] ||
            row['کد حساب تفصیلی'] ||
            row['Code'] ||
            row['کد مشتری'];

          const accountCode = String(accountCodeRow || row[keys[0]] || '').trim();

          const nameRow = 
            row['عنوان'] || 
            row['نام شخص'] || 
            row['نام مشتری'] || 
            row['نام حساب'] || 
            row['CustomerName'] || 
            row['Name'] || 
            row['نام تفصیلی'] ||
            row['نام خانوادگی'] ||
            row['مشتری'];

          const name = String(nameRow || row[keys[1]] || '').trim();

          // Skipping header if mistakenly parsed as data
          if (name === 'عنوان' || accountCode === 'کد تفصیلی' || accountCode === 'کد') continue;

          // Standard distinct Debit vs Credit columns check
          const debitVal = normalizeNumber(row['بدهکار'] || row['Debit'] || row[keys[2]]);
          const creditVal = normalizeNumber(row['بستانکار'] || row['Credit'] || row[keys[3]]);
          const rawBalance = normalizeNumber(row['مانده'] || row['مانده حساب'] || row['Balance'] || row[keys[5]]);
          const typeStr = String(row['تشخیص'] || row['وضعیت'] || row['نوع'] || row[keys[4]] || '').trim();

          let balance = 0;
          let type: 'بدهکار' | 'بستانکار' = 'بدهکار';

          if (rawBalance > 0) {
            balance = rawBalance;
            if (typeStr.includes('بست') || typeStr.includes('بستانکار') || typeStr === 'بس' || typeStr.includes('CR') || typeStr.includes('Credit')) {
              type = 'بستانکار';
            } else {
              type = 'بدهکار';
            }
          } else if (debitVal > 0 && creditVal === 0) {
            balance = debitVal;
            type = 'بدهکار';
          } else if (creditVal > 0 && debitVal === 0) {
            balance = creditVal;
            type = 'بستانکار';
          } else if (debitVal > 0 || creditVal > 0) {
            // Net balance logic if both have values
            if (debitVal >= creditVal) {
              balance = debitVal - creditVal;
              type = 'بدهکار';
            } else {
              balance = creditVal - debitVal;
              type = 'بستانکار';
            }
          }

          if (accountCode && name && accountCode !== 'undefined' && name !== 'undefined') {
            validRecords.push({
              accountCode,
              name,
              balance,
              type
            });
          }
        }

        if (validRecords.length === 0) {
          alert('کد حسابداری یا نام مشتری معتبری در فایل یافت نشد. لطفاً عناوین ستون‌ها را بررسی کنید.');
          return;
        }

        if (!confirm(`آیا تمایل دارید مانده حساب تعداد ${validRecords.length} مشتری را بروزرسانی کنید؟`)) return;

        setLoading(true);
        const postRes = await apiCall<any>('/customer-balances/bulk', 'POST', { records: validRecords });
        alert('مانده حساب مشتریان با موفقیت بروزرسانی شد.');
        fetchData();
      } catch (err) {
        console.error(err);
        alert('خطا در پردازش فایل اکسل.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleManualMapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapChatId || !mapAccountCode) {
      alert('لطفاً شناسه چت و کد حسابداری را وارد کنید.');
      return;
    }

    setLoading(true);
    try {
      await apiCall<any>('/customer-balances/chat-code', 'POST', {
        chatId: mapChatId.trim(),
        platform: mapPlatform,
        accountCode: mapAccountCode.trim()
      });

      alert('پیوند چت با موفقیت ایجاد دگرگون شد.');
      setMapChatId('');
      setMapAccountCode('');
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMap = async (chatId: string, platform: 'telegram' | 'bale') => {
    if (!confirm('آیا از حذف این پیوند حساب اطمینان دارید؟')) return;

    setLoading(true);
    try {
      await apiCall<any>(`/customer-balances/chat-code/${chatId}/${platform}`, 'DELETE');
      alert('پیوند با موفقیت حذف شد.');
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>, accountCode: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStmtUploadLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const result = evt.target?.result as string;
        const base64Data = result.split(',')[1];
        const ext = file.name.split('.').pop() || '';

        await apiCall<any>('/customer-balances/statement', 'POST', {
          accountCode,
          fileName: file.name,
          fileType: ext,
          fileData: base64Data
        });

        alert('صورتحساب با موفقیت آپلود شد.');
        fetchData();
      } catch (err) {
        console.error(err);
        alert('خطا در خواندن فایل.');
      } finally {
        setStmtUploadLoading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteStatement = async (id: string) => {
    if (!confirm('آیا از حذف این صورتحساب اطمینان دارید؟')) return;
    try {
      await apiCall<any>(`/customer-balances/statement/${id}`, 'DELETE');
      alert('صورتحساب با موفقیت حذف شد.');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const downloadPDFReport = async (type: 'debtors' | 'creditors') => {
    if (type === 'debtors') setPdfLoadingDebtors(true);
    else setPdfLoadingCreditors(true);

    try {
      const url = `/api/customer-balances/reports/${type}/pdf?hideZero=${hideZeroBalances}&excludeCodes=${excludedCodes.join(',')}`;
      const fileName = type === 'debtors' 
        ? `Debtors_Balances_${lastUploadTime || 'latest'}.pdf` 
        : `Creditors_Balances_${lastUploadTime || 'latest'}.pdf`;
      await downloadAndOpenFile(url, fileName, undefined, true);
    } catch (error) {
      console.error(error);
      alert('خطا در تولید و دانلود فایل گزارش PDF.');
    } finally {
      if (type === 'debtors') setPdfLoadingDebtors(false);
      else setPdfLoadingCreditors(false);
    }
  };

  // Calculations
  const rawTotalDebtors = balances
    .filter(b => b.type === 'بدهکار')
    .reduce((sum, b) => sum + (Number(b.balance) || 0), 0);

  const rawTotalCreditors = balances
    .filter(b => b.type === 'بستانکار')
    .reduce((sum, b) => sum + (Number(b.balance) || 0), 0);

  const totalDebtors = balances
    .filter(b => b.type === 'بدهکار' && !excludedCodes.includes(b.accountCode))
    .reduce((sum, b) => sum + (Number(b.balance) || 0), 0);

  const totalCreditors = balances
    .filter(b => b.type === 'بستانکار' && !excludedCodes.includes(b.accountCode))
    .reduce((sum, b) => sum + (Number(b.balance) || 0), 0);

  const filteredBalances = balances.filter(b => {
    const matchesSearch = 
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.accountCode.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (hideZeroBalances && b.balance === 0) return false;
    if (hideExcludedLocally && excludedCodes.includes(b.accountCode)) return false;

    if (filterType === 'all') return true;
    if (filterType === 'debit') return b.type === 'بدهکار';
    if (filterType === 'credit') return b.type === 'بستانکار';
    return true;
  });

  const toggleBulkSelection = (code: string) => {
    if (selectedForBulk.includes(code)) {
      setSelectedForBulk(selectedForBulk.filter(c => c !== code));
    } else {
      setSelectedForBulk([...selectedForBulk, code]);
    }
  };

  const applyBulkExclusion = (exclude: boolean) => {
    if (exclude) {
      setExcludedCodes([...new Set([...excludedCodes, ...selectedForBulk])]);
    } else {
      setExcludedCodes(excludedCodes.filter(c => !selectedForBulk.includes(c)));
    }
    setSelectedForBulk([]);
  };

  const toggleAllExclusion = () => {
    const visibleCodes = filteredBalances.map(b => b.accountCode);
    const allVisibleExcluded = visibleCodes.every(code => excludedCodes.includes(code));

    if (allVisibleExcluded) {
      // If all visible are already excluded, remove them from exclusion list
      setExcludedCodes(excludedCodes.filter(c => !visibleCodes.includes(c)));
    } else {
      // Otherwise, exclude all visible
      if (visibleCodes.length > 50 && !confirm(`آیا از استثناء کردن ${visibleCodes.length} مورد از خروجی PDF اطمینان دارید؟`)) return;
      const newExcluded = [...new Set([...excludedCodes, ...visibleCodes])];
      setExcludedCodes(newExcluded);
    }
  };

  return (
    <div className="p-4 md:p-6 text-right max-w-7xl mx-auto" dir="rtl">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white dark:bg-zinc-900 duration-200 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Wallet className="text-emerald-500 w-7 h-7" />
            مانده حساب مشتریان
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            مدیریت کامل و دائم مانده حساب‌ها، ورود اطلاعات حسابداری و دانلود گزارشات بدهکاران و بستانکاران
          </p>
          {lastUploadTime && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-450 font-bold mt-2 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 inline-flex items-center gap-1">
              <span>📅 مبنای محاسبه گزارش مکتوب (آخرین آپلود اکسل):</span>
              <span className="font-mono">{new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }).format(new Date(lastUploadTime))}</span>
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          <button onClick={fetchData} className="p-2 border border-gray-100 dark:border-zinc-800 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-300 transition-all">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          {currentUser?.rolePermissions?.canImportCustomerBalances !== false && (
            <label className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-all font-bold text-sm cursor-pointer shadow-lg shadow-emerald-700/10">
              <Upload className="w-4 h-4" />
              واردات اکسل تفصیلی
              <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} className="hidden" />
            </label>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-bold text-gray-400 block mb-1">جمع مشتریان بدهکار (طلب شرکت)</span>
            <span className="text-2xl font-black text-emerald-600 leading-none">
              {totalDebtors.toLocaleString()} <span className="text-[10px] font-medium text-gray-500">ریال</span>
            </span>
            <div className="text-[11px] font-bold text-gray-500 mt-1">
              ≈ {(totalDebtors/10).toLocaleString()} <span className="opacity-50">تومان</span>
            </div>
            {excludedCodes.length > 0 && (
              <div className="text-[10px] text-rose-500 font-bold mt-1.5 border-t border-rose-50/50 pt-1">
                ⚠️ {balances.filter(b => b.type === 'بدهکار' && excludedCodes.includes(b.accountCode)).length} مورد مستثنی شده (مجموع: {rawTotalDebtors.toLocaleString()} ریال)
              </div>
            )}
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl text-emerald-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-bold text-gray-400 block mb-1">جمع مشتریان بستانکار (بدهی شرکت)</span>
            <span className="text-2xl font-black text-rose-600 leading-none">
              {totalCreditors.toLocaleString()} <span className="text-[10px] font-medium text-gray-500">ریال</span>
            </span>
            <div className="text-[11px] font-bold text-gray-500 mt-1">
              ≈ {(totalCreditors/10).toLocaleString()} <span className="opacity-50">تومان</span>
            </div>
            {excludedCodes.length > 0 && (
              <div className="text-[10px] text-rose-500 font-bold mt-1.5 border-t border-rose-50/50 pt-1">
                ⚠️ {balances.filter(b => b.type === 'بستانکار' && excludedCodes.includes(b.accountCode)).length} مورد مستثنی شده (مجموع: {rawTotalCreditors.toLocaleString()} ریال)
              </div>
            )}
          </div>
          <div className="bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl text-rose-600">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-bold text-gray-400 block mb-1">کل حساب‌های تفصیلی</span>
            <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 leading-none">
              {balances.length} <span className="text-xs font-medium text-gray-500">سرفصل</span>
            </span>
            {excludedCodes.length > 0 && (
              <div className="text-[10px] text-gray-500 font-bold mt-1.5 border-t border-gray-100 pt-1">
                🚫 {excludedCodes.length} مورد کاملاً استثناء شده از چاپ
              </div>
            )}
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl text-blue-600">
            <Landmark className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* PDF Generation Controls Panel */}
      <div className="bg-gradient-to-l from-emerald-50 to-teal-50 dark:from-zinc-900 dark:to-zinc-855 border border-emerald-100 dark:border-zinc-800 p-5 rounded-2xl mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-400 flex items-center gap-1.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            تولید و دریافت گزارشات تفکیکی
          </h4>
          <p className="text-xs text-emerald-800/80 dark:text-zinc-400 mt-1">
            صرفاً دریافت خروجی PDF تفکیک‌شده و مرتب شده بر اساس بیشترین به کمترین طلب یا بدهی
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => downloadPDFReport('debtors')}
            disabled={pdfLoadingDebtors}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-zinc-900 dark:bg-emerald-600 hover:bg-zinc-800 dark:hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm"
          >
            {pdfLoadingDebtors ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            گزارش بدهکاران (PDF)
          </button>
          
          <button
            onClick={() => downloadPDFReport('creditors')}
            disabled={pdfLoadingCreditors}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-zinc-900 dark:bg-emerald-600 hover:bg-zinc-800 dark:hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm"
          >
            {pdfLoadingCreditors ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            گزارش بستانکاران (PDF)
          </button>
        </div>
      </div>

      {/* Navigation Sub Tabs */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-zinc-800 mb-6">
        <button
          onClick={() => setActiveSubTab('balances')}
          className={`pb-3 font-bold text-sm border-b-2 px-3 transition-all ${
            activeSubTab === 'balances'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          لیست مانده حساب‌ها ({filteredBalances.length})
        </button>
        <button
          onClick={() => setActiveSubTab('mappings')}
          className={`pb-3 font-bold text-sm border-b-2 px-3 transition-all ${
            activeSubTab === 'mappings'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          پیوند کد حسابداری به چت ربات ({chatCodes.length})
        </button>
      </div>

      {activeSubTab === 'balances' && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900 flex flex-col lg:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-3 w-full lg:w-auto items-center">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute right-3 top-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="جستجو در نام تفصیلی یا کد..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs text-right pr-9 pl-3 py-2.5 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Hide zero balances switcher */}
              <div 
                onClick={() => setHideZeroBalances(!hideZeroBalances)}
                className="flex items-center gap-2 select-none bg-white dark:bg-zinc-950 p-2.5 px-4 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/40 duration-150 w-full sm:w-auto shrink-0 justify-center sm:justify-start"
              >
                <input
                  type="checkbox"
                  checked={hideZeroBalances}
                  onChange={() => {}} // Handled by parent div onClick
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">
                  عدم نمایش مانده‌های صفر
                </span>
              </div>

              {/* Hide excluded locally switcher */}
              <div 
                onClick={() => setHideExcludedLocally(!hideExcludedLocally)}
                className="flex items-center gap-2 select-none bg-white dark:bg-zinc-950 p-2.5 px-4 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/40 duration-150 w-full sm:w-auto shrink-0 justify-center sm:justify-start"
              >
                <input
                  type="checkbox"
                  checked={hideExcludedLocally}
                  onChange={() => {}} // Handled by parent div onClick
                  className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">
                  مخفی کردن استثناء شده‌ها از این لیست
                </span>
              </div>

              {excludedCodes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExcludedCodes([])}
                  className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 p-2.5 px-4 rounded-xl border border-rose-250 dark:border-rose-900 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  لغو {excludedCodes.length} استثناء
                </button>
              )}

              <button
                type="button"
                onClick={toggleAllExclusion}
                className="text-xs font-bold text-zinc-600 bg-white hover:bg-gray-50 dark:bg-zinc-900 dark:text-zinc-300 p-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" />
                انتخاب/لغو دسته‌جمعی
              </button>
            </div>

            <div className="flex gap-2 w-full lg:w-auto">
              {(['all', 'debit', 'credit'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`flex-1 lg:flex-initial text-xs font-bold px-4 py-2.5 rounded-xl border transition-all ${
                    filterType === t
                      ? 'bg-emerald-50 border-emerald-250 text-emerald-705 dark:bg-emerald-950/20 dark:border-emerald-905 dark:text-emerald-400 font-extrabold'
                      : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {t === 'all' ? 'همه' : t === 'debit' ? 'بدهکاران (طلب)' : 'بستانکاران'}
                </button>
              ))}
            </div>
          </div>

          {/* List Content - Mobile Optimized */}
          <div className="overflow-x-auto">
            <table className="hidden md:table w-full min-w-[700px] text-right border-collapse text-xs border border-zinc-350 dark:border-zinc-800 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-b border-zinc-300 dark:border-zinc-700">
                  <th className="py-3 px-2 font-black text-center border-l border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-850 w-10">
                    <input
                      type="checkbox"
                      checked={filteredBalances.length > 0 && filteredBalances.every(b => selectedForBulk.includes(b.accountCode))}
                      onChange={() => {
                        if (selectedForBulk.length >= filteredBalances.length) setSelectedForBulk([]);
                        else setSelectedForBulk(filteredBalances.map(b => b.accountCode));
                      }}
                      className="w-4 h-4 cursor-pointer accent-emerald-600"
                    />
                  </th>
                  <th className="py-3 px-4 font-black text-center border-l border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-850 w-24">
                    <div className="flex flex-col items-center gap-1">
                      <input
                        type="checkbox"
                        checked={filteredBalances.length > 0 && filteredBalances.every(b => excludedCodes.includes(b.accountCode))}
                        onChange={toggleAllExclusion}
                        className="w-4 h-4 cursor-pointer accent-rose-600"
                        title="انتخاب همه برای عدم چاپ"
                      />
                      <span className="text-[9px]">حذف از PDF</span>
                    </div>
                  </th>
                  <th className="py-3 px-4 font-black text-center border-l border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-850">کد حسابداری</th>
                  <th className="py-3 px-4 font-black text-right border-l border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-850">نام حساب حساب تفصیلی / مشتری</th>
                  <th className="py-3 px-4 font-black text-left border-l border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-850">مانده حساب (ریال)</th>
                  <th className="py-3 px-4 font-black text-center border-l border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-850">تشخیص</th>
                  <th className="py-3 px-4 font-black text-center border-l border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-850">صورتحساب‌ها (ملحق شده)</th>
                  <th className="py-3 px-4 font-black text-center bg-zinc-100 dark:bg-zinc-850">آخرین بروزرسانی</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400 hover:text-gray-500 border border-zinc-200 dark:border-zinc-800">
                      <Loader2 className="w-7 h-7 animate-spin mx-auto text-emerald-500" />
                      <span className="block mt-3 text-xs font-bold">در حال بارگذاری اطلاعات...</span>
                    </td>
                  </tr>
                ) : filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400 border border-zinc-200 dark:border-zinc-800">
                      <AlertCircle className="w-9 h-9 mx-auto text-zinc-400 mb-2" />
                      <span className="block text-xs font-black text-gray-500">موردی یافت نشد. اکسل را وارد کنید یا فیلترها را بررسی نمائید.</span>
                    </td>
                  </tr>
                ) : (
                  filteredBalances.map((item) => {
                    const isZero = item.balance === 0;
                    const isExcluded = excludedCodes.includes(item.accountCode);
                    return (
                      <tr 
                        key={item.id || item.accountCode} 
                        className={`border-b border-zinc-200 dark:border-zinc-800 even:bg-zinc-50/40 dark:even:bg-zinc-850/10 hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.04] transition-all font-medium ${
                          isExcluded ? 'opacity-40 italic line-through bg-rose-50/20 dark:bg-rose-950/10 text-rose-900 dark:text-rose-400' : 'text-gray-700 dark:text-gray-300'
                        } ${selectedForBulk.includes(item.accountCode) ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''}`}
                      >
                        <td className="py-3.5 px-2 text-center border-l border-zinc-200 dark:border-zinc-800">
                          <input
                            type="checkbox"
                            checked={selectedForBulk.includes(item.accountCode)}
                            onChange={() => toggleBulkSelection(item.accountCode)}
                            className="w-4 h-4 cursor-pointer accent-emerald-600"
                          />
                        </td>
                        <td className="py-3.5 px-4 text-center border-l border-zinc-200 dark:border-zinc-800">
                          <input
                            type="checkbox"
                            checked={isExcluded}
                            onChange={() => {
                              if (isExcluded) {
                                setExcludedCodes(excludedCodes.filter(c => c !== item.accountCode));
                              } else {
                                setExcludedCodes([...excludedCodes, item.accountCode]);
                              }
                            }}
                            className="w-4 h-4 cursor-pointer text-rose-600 rounded accent-rose-600"
                          />
                        </td>
                        <td className="py-3.5 px-4 text-center select-all font-mono font-bold border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/30">
                          <code>{item.accountCode}</code>
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-right border-l border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                          {item.name}
                        </td>
                        <td className={`py-3.5 px-4 font-mono font-black text-left border-l border-zinc-200 dark:border-zinc-800 text-sm ${
                          isExcluded
                            ? 'text-zinc-400 dark:text-zinc-500'
                            : isZero 
                            ? 'text-zinc-400 dark:text-zinc-500' 
                            : item.type === 'بدهکار' 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : 'text-rose-600 dark:text-rose-450'
                        }`}>
                          {item.balance.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-center border-l border-zinc-200 dark:border-zinc-800">
                          <span className={`inline-block px-3 py-1 rounded-full font-extrabold text-[10px] tracking-wide shadow-xs ${
                            isZero
                              ? 'bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                              : item.type === 'بدهکار' 
                              ? 'bg-emerald-50 text-emerald-850 border border-emerald-250 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40' 
                              : 'bg-rose-50 text-rose-850 border border-rose-250 dark:bg-rose-950/40 dark:text-rose-450 dark:border-rose-900/40'
                          }`}>
                            {isZero ? 'تسویه' : item.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center border-l border-zinc-200 dark:border-zinc-800">
                          <button
                            onClick={() => setStmtModalCode(item.accountCode)}
                            className="inline-flex items-center gap-1 bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 text-sky-850 dark:text-sky-400 border border-sky-200 dark:border-sky-900/40 px-3 py-1.5 rounded-xl transition-all font-black text-[10px]"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>{statements.filter(s => s.accountCode === item.accountCode).length} صورتحساب</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-500 dark:text-zinc-400 font-mono font-bold">
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('fa-IR') : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            
            {/* Mobile Cards - Enhanced UI */}
            <div className="md:hidden space-y-4 p-4">
              {loading ? (
                <div className="py-10 text-center text-gray-400 font-bold flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                  <span>در حال بارگذاری لیست...</span>
                </div>
              ) : filteredBalances.length === 0 ? (
                <div className="py-10 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed">
                  موردی با این مشخصات یافت نشد.
                </div>
              ) : (
                filteredBalances.map((item) => {
                  const isZero = item.balance === 0;
                  const isExcluded = excludedCodes.includes(item.accountCode);
                  return (
                    <div key={item.id || item.accountCode} className={`bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 text-right relative overflow-hidden group active:scale-[0.98] transition-transform ${isExcluded ? 'opacity-50 italic' : ''}`}>
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${
                        isExcluded ? 'bg-rose-400' : isZero ? 'bg-zinc-400' : item.type === 'بدهکار' ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}></div>
                      
                      <div className="flex justify-between items-start mb-3 gap-2">
                        <div className="flex flex-col">
                            <span className={`font-black text-gray-900 dark:text-zinc-100 text-lg leading-tight mb-1 ${isExcluded ? 'line-through text-rose-900 dark:text-rose-400' : ''}`}>{item.name}</span>
                            <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-zinc-700 px-2 py-0.5 rounded-md self-start">{item.accountCode}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black ${
                            isZero 
                              ? 'bg-zinc-100 text-zinc-650 dark:bg-zinc-700 dark:text-zinc-350' 
                              : item.type === 'بدهکار' 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' 
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30'
                          }`}>
                            {isZero ? 'تسویه' : item.type}
                          </span>
                          
                          <label className="flex items-center gap-1 cursor-pointer text-[10px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/20 border border-rose-250 dark:border-rose-900 px-2 py-1 rounded-lg">
                            <input
                              type="checkbox"
                              checked={isExcluded}
                              onChange={() => {
                                if (isExcluded) {
                                  setExcludedCodes(excludedCodes.filter(c => c !== item.accountCode));
                                } else {
                                  setExcludedCodes([...excludedCodes, item.accountCode]);
                                }
                              }}
                              className="accent-rose-600 rounded w-3 h-3 cursor-pointer"
                            />
                            <span>حذف از PDF</span>
                          </label>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-50 dark:border-zinc-700/50">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold mb-1">مانده حساب</span>
                            <span className={`text-xl font-black ${
                              isExcluded
                                ? 'text-rose-500 line-through'
                                : isZero 
                                ? 'text-zinc-400 dark:text-zinc-500' 
                                : item.type === 'بدهکار' 
                                ? 'text-emerald-600 dark:text-emerald-400' 
                                : 'text-rose-600 dark:text-rose-455'
                            }`}>
                                {item.balance.toLocaleString()} <span className="text-[10px] font-medium opacity-70">ریال</span>
                            </span>
                        </div>
                        
                        <button
                          onClick={() => setStmtModalCode(item.accountCode)}
                          className="bg-zinc-900 dark:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-zinc-900/10 active:opacity-80 animate-all"
                        >
                          <FileSpreadsheet size={16} />
                          صورتحساب
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'mappings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Mapping Form Card */}
          <div className="lg:col-span-1 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-5 rounded-2xl shadow-sm h-fit">
            <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-1.5">
              <Plus className="w-5 h-5 text-emerald-500" />
              ثبت دستی پیوند جدید
            </h3>
            
            <form onSubmit={handleManualMapSubmit} className="space-y-4 text-right">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5">پلتفرم رباتیک</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMapPlatform('telegram')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                      mapPlatform === 'telegram'
                        ? 'border-blue-500 bg-blue-50/50 text-blue-700 dark:bg-zinc-800'
                        : 'border-gray-200 dark:border-zinc-800 text-gray-500'
                    }`}
                  >
                    تلگرام
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapPlatform('bale')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                      mapPlatform === 'bale'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 dark:bg-zinc-800'
                        : 'border-gray-200 dark:border-zinc-800 text-gray-500'
                    }`}
                  >
                    بله
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5">شناسه چت چت (Chat ID)</label>
                <input
                  type="text"
                  placeholder="مثال: 12948194"
                  value={mapChatId}
                  onChange={(e) => setMapChatId(e.target.value)}
                  className="w-full text-xs text-left font-mono px-3 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5">کد حسابداری تفصیلی</label>
                <input
                  type="text"
                  placeholder="کد کامل تفصیلی مشتری در سیستم مالی"
                  value={mapAccountCode}
                  onChange={(e) => setMapAccountCode(e.target.value)}
                  className="w-full text-xs text-left font-mono px-3 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 bg-zinc-900 dark:bg-emerald-600 hover:bg-zinc-800 dark:hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm shadow-zinc-100"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                پیوند دهی چت به حساب تفصیلی
              </button>
            </form>
          </div>

          {/* List existing mapping */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
            <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 mb-4">
              پیوندهای فعال (شناسه چت ربات به کدهای مالی)
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full min-w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-zinc-900 text-gray-400 border-b border-gray-100 dark:border-zinc-800">
                    <th className="py-2.5 px-3 font-bold">پلتفرم</th>
                    <th className="py-2.5 px-3 font-bold">شناسه چت ربات (Chat ID)</th>
                    <th className="py-2.5 px-3 font-bold text-center">کد حساب تفصیلی</th>
                    <th className="py-2.5 px-3 font-bold text-center">عملیات ثبت شده</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && chatCodes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-emerald-500" />
                      </td>
                    </tr>
                  ) : chatCodes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-gray-400 font-bold">
                        هیچ پیوند ثبتی در پایگاه‌داده هنوز ایجاد نشده است.
                      </td>
                    </tr>
                  ) : (
                    chatCodes.map((map) => (
                      <tr key={`${map.chatId}-${map.platform}`} className="border-b border-gray-50 dark:border-zinc-800 font-medium text-gray-600 dark:text-gray-300">
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[9px] ${
                            map.platform === 'telegram'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                          }`}>
                            {map.platform === 'telegram' ? 'تلگرام' : 'پیام‌رسان بله'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{map.chatId}</td>
                        <td className="py-2.5 px-3 font-mono text-center font-bold text-gray-800 dark:text-white">{map.accountCode}</td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleDeleteMap(map.chatId, map.platform)}
                            className="p-1 px-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modern Statements Dialog Overlay */}
      {stmtModalCode && (() => {
        const customerName = balances.find(b => b.accountCode === stmtModalCode)?.name || 'سرفصل نامشخص';
        const customerStmts = statements.filter(s => s.accountCode === stmtModalCode);
        return (
          <div className="fixed inset-0 z-50 flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-zinc-900/80 backdrop-blur-xs duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-right" dir="rtl">
              <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-zinc-800 mb-4">
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-gray-100">
                    📂 صورتحساب‌های پیوست مالی
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">مشاهده و بارگذاری اسناد کمکی مربوط به {customerName}</p>
                </div>
                <button 
                  data-subtab-back="true"
                  onClick={() => setStmtModalCode(null)} 
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition-all text-xs font-bold"
                >
                  بستن (✕)
                </button>
              </div>

              {/* Upload statement section */}
              {currentUser?.rolePermissions?.canImportCustomerBalances !== false && (
                <div className="mb-4 bg-emerald-50/50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-emerald-100/50 dark:border-zinc-800 flex flex-col items-center justify-center gap-2">
                  <span className="text-xs text-slate-500 font-bold">می‌توانید فایل‌های سند (PDF, Excel) را آپلود کنید:</span>
                  <label className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition-all shadow-md">
                    {stmtUploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>آپلود سند پیوست</span>
                    <input type="file" accept=".pdf,.xlsx,.xls" onChange={(e) => handleStatementUpload(e, stmtModalCode)} className="hidden" disabled={stmtUploadLoading} />
                  </label>
                </div>
              )}

              {/* List Files */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                <span className="block text-xs font-bold text-gray-400 mb-2">لیست فایل‌های صادر شده برای این مشتری ({customerStmts.length})</span>
                {customerStmts.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 border border-dashed border-gray-100 dark:border-zinc-800 rounded-2xl">
                    <FileSpreadsheet className="w-8 h-8 mx-auto text-gray-300 mb-1" />
                    <span className="text-xs">هیچ صورتحسابی برای این مشتری آپلود نشده است.</span>
                  </div>
                ) : (
                  customerStmts.map((st) => (
                    <div key={st.id} className="flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-gray-100/30 dark:border-zinc-800/20 text-xs">
                      <div className="flex flex-col text-right">
                        <span className="font-bold text-gray-800 dark:text-zinc-200 line-clamp-1 select-all">{st.fileName}</span>
                        <span className="text-[10px] text-gray-400 mt-1 font-mono">
                          {new Date(st.uploadedAt).toLocaleDateString('fa-IR')} • پسوند {st.fileType.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => downloadAndOpenFile(`/api/customer-balances/statement-download/${st.id}`, st.fileName, undefined, true)}
                          className="p-1.5 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 rounded-lg transition-all font-bold cursor-pointer"
                          title="دانلود فایل"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {currentUser?.rolePermissions?.canImportCustomerBalances !== false && (
                          <button
                            onClick={() => handleDeleteStatement(st.id)}
                            className="p-1.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-700 dark:text-rose-450 rounded-lg transition-all font-bold"
                            title="حذف فایل"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}
      {/* Bulk Action Bar */}
      {selectedForBulk.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-zinc-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-[90vw] overflow-x-auto">
          <div className="flex items-center gap-2 border-l border-white/20 pl-4 whitespace-nowrap">
            <span className="bg-emerald-500 text-zinc-950 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black">
              {selectedForBulk.length}
            </span>
            <span className="text-xs font-bold">مورد انتخاب شده</span>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => applyBulkExclusion(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black rounded-xl transition-all whitespace-nowrap"
            >
              استثناء از PDF
            </button>
            <button
              onClick={() => applyBulkExclusion(false)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-xl transition-all whitespace-nowrap"
            >
              درج در PDF
            </button>
            <button
              onClick={() => setSelectedForBulk([])}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-[10px] font-black rounded-xl transition-all whitespace-nowrap"
            >
              لغو انتخاب
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
