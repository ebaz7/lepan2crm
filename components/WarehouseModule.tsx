
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, SystemSettings, WarehouseItem, WarehouseTransaction, WarehouseTransactionItem, UserRole } from '../types';
import { getWarehouseItems, saveWarehouseItem, deleteWarehouseItem, getWarehouseTransactions, saveWarehouseTransaction, deleteWarehouseTransaction, updateWarehouseTransaction, getNextBijakNumber, updateWarehouseItem } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatNumberString, deformatNumberString, formatDate, parsePersianDate, getShamsiDateFromIso } from '../constants';
import { Package, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, FileText, BarChart3, Eye, Loader2, AlertTriangle, Settings, ArrowLeftRight, Search, FileClock, Printer, FileDown, Share2, LayoutGrid, Archive, Edit, Save, X, Container, CheckCircle, XCircle, RefreshCcw, FileSpreadsheet, WifiOff, Filter, Calendar, ShieldCheck, Users, Home, List, Navigation, Send, RefreshCw, Barcode, Download, Upload } from 'lucide-react';
import PrintBijak from './PrintBijak';
import PrintStockReport from './print/PrintStockReport'; 
import WarehouseKardexReport from './reports/WarehouseKardexReport';
import WarehouseDispatchReport from './reports/WarehouseDispatchReport';
import { apiCall } from '../services/apiService';
import { getUsers, getRolePermissions } from '../services/authService';
import html2canvas from 'html2canvas';
import useIsMobile from '../hooks/useIsMobile';
import * as XLSX from 'xlsx';
import { saveBlobAndOpenFile } from '../services/fileService';

import { isInFinancialYear } from '../utils/dateUtils';

interface Props { 
    currentUser: User; 
    settings?: SystemSettings; 
    initialTab?: 'dashboard' | 'items' | 'entry' | 'exit' | 'reports' | 'stock_report' | 'archive' | 'entry_archive' | 'approvals' | 'dispatch_report' | 'stocktake';
    financialYear?: string;
}

// Internal Edit Modal Component
const TransactionEditModal = ({ tx, onClose, onSave, items }: { tx: WarehouseTransaction, onClose: () => void, onSave: (tx: WarehouseTransaction) => void, items: WarehouseItem[] }) => {
    const [formData, setFormData] = useState({ ...tx });
    const [txItems, setTxItems] = useState<WarehouseTransactionItem[]>(tx.items || []);

    const handleItemChange = (idx: number, field: keyof WarehouseTransactionItem, value: any) => {
        const newItems = [...txItems];
        newItems[idx] = { ...newItems[idx], [field]: value };
        if (field === 'itemId') {
            const selected = items.find(i => i.id === value);
            if (selected) newItems[idx].itemName = selected.name;
        }
        setTxItems(newItems);
    };

    const addItem = () => setTxItems([...txItems, { itemId: '', itemName: '', quantity: 0, weight: 0, unitPrice: 0 }]);
    const removeItem = (idx: number) => setTxItems(txItems.filter((_, i) => i !== idx));

    const handleSave = () => {
        onSave({ ...formData, items: txItems });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-0 md:p-4 animate-fade-in backdrop-blur-sm">
            <div className="glass-panel rounded-none md:rounded-3xl shadow-2xl w-full max-w-4xl h-full md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden border-0 md:border md:border-white/20">
                <div className="p-4 md:p-6 border-b flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/60 backdrop-blur-md text-gray-800 dark:text-gray-200">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${tx.type === 'IN' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {tx.type === 'IN' ? <ArrowDownCircle size={20}/> : <ArrowUpCircle size={20}/>}
                        </div>
                        <h3 className="font-black text-gray-800 dark:text-white text-base md:text-lg">ویرایش {tx.type === 'IN' ? 'رسید انبار' : 'بیجک خروج'}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-white dark:bg-black/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {tx.type === 'OUT' && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">شماره بیجک</label>
                                    <input type="number" className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-3 font-bold bg-gray-50 dark:bg-gray-800 outline-none focus:border-red-400 transition-all" value={formData.number} onChange={e => setFormData({...formData, number: Number(e.target.value)})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">گیرنده نهایی</label>
                                    <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-3 font-bold bg-gray-50 dark:bg-gray-800 outline-none focus:border-red-400 transition-all" value={formData.recipientName || ''} onChange={e => setFormData({...formData, recipientName: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">راننده</label>
                                    <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-3 font-bold bg-gray-50 dark:bg-gray-800 outline-none focus:border-red-400 transition-all" value={formData.driverName || ''} onChange={e => setFormData({...formData, driverName: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">پلاک خودرو</label>
                                    <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-3 font-bold bg-gray-50 dark:bg-gray-800 outline-none focus:border-red-400 transition-all text-center dir-ltr" value={formData.plateNumber || ''} onChange={e => setFormData({...formData, plateNumber: e.target.value})} />
                                </div>
                            </>
                        )}
                        {tx.type === 'IN' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">شماره پروفرما / سند</label>
                                <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-3 font-bold bg-gray-50 dark:bg-gray-800 outline-none focus:border-green-400 transition-all" value={formData.proformaNumber || ''} onChange={e => setFormData({...formData, proformaNumber: e.target.value})} />
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">تاریخ سند (غیرقابل ویرایش)</label>
                            <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-3 font-bold bg-gray-50/50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-600 outline-none cursor-not-allowed text-center dir-ltr" value={formData.date.split('T')[0]} readOnly />
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/30 p-4 md:p-6 rounded-3xl border border-gray-200 dark:border-white/5">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xs font-black text-gray-400 flex items-center gap-2 uppercase tracking-widest"><List size={16} className="text-blue-500"/> جزییات اقلام سند</h4>
                            <button onClick={addItem} className="text-blue-600 text-xs font-black flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 transition-colors"><Plus size={14}/> افزودن ردیف</button>
                        </div>
                        <div className="space-y-4">
                            {txItems.map((item, idx) => (
                                <div key={idx} className="flex flex-col md:flex-row gap-3 bg-white dark:bg-gray-900/40 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm relative group">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 mr-2">انتخاب کالا</label>
                                        <select className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-2.5 text-sm font-bold bg-gray-50 dark:bg-gray-800" value={item.itemId} onChange={e => handleItemChange(idx, 'itemId', e.target.value)}>
                                            <option value="">انتخاب از انبار...</option>
                                            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:w-48">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 text-center block">تعداد</label>
                                            <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-2.5 text-sm font-bold text-center bg-gray-50 dark:bg-gray-800" placeholder="0" type="number" value={item.quantity === 0 ? '' : item.quantity} onFocus={e => e.target.select()} onChange={e => handleItemChange(idx, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 text-center block">وزن (KG)</label>
                                            <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-2.5 text-sm font-bold text-center bg-gray-50 dark:bg-gray-800" placeholder="0" type="number" value={item.weight === 0 ? '' : item.weight} onFocus={e => e.target.select()} onChange={e => handleItemChange(idx, 'weight', e.target.value === '' ? 0 : Number(e.target.value))} />
                                        </div>
                                    </div>
                                    <div className="flex items-end justify-center">
                                        <button onClick={() => removeItem(idx)} className="text-red-500 p-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 md:p-6 border-t flex gap-3 bg-gray-50/50 dark:bg-gray-900/40 backdrop-blur-md">
                    <button onClick={onClose} className="flex-1 py-3.5 border-2 border-gray-200 dark:border-white/10 rounded-2xl text-gray-500 font-black text-sm hover:bg-gray-100 active:scale-[0.98] transition-all">انصراف</button>
                    <button onClick={handleSave} className="flex-[2] py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <Save size={20}/> ذخیره نهایی تغییرات
                    </button>
                </div>
            </div>
        </div>
    );
};

const WarehouseModule: React.FC<Props> = ({ currentUser, settings, initialTab = 'dashboard', financialYear }) => {
    const isMobile = useIsMobile();
    const [loadingData, setLoadingData] = useState(true);
    const permissions = useMemo(() => {
        return settings ? getRolePermissions(currentUser.role, settings, currentUser) : null;
    }, [currentUser, settings]);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [items, setItems] = useState<WarehouseItem[]>([]);
    const [transactions, setTransactions] = useState<WarehouseTransaction[]>([]);
    const [allTransactions, setAllTransactions] = useState<WarehouseTransaction[]>([]);
    
    // New Item State
    const [newItemName, setNewItemName] = useState('');
    const [newItemCode, setNewItemCode] = useState('');
    const [newItemUnit, setNewItemUnit] = useState('عدد');
    const [newItemContainerCapacity, setNewItemContainerCapacity] = useState('');

    // Editing Item State
    const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);

    // Transaction State
    const currentShamsi = getCurrentShamsiDate();
    const [txDate, setTxDate] = useState({ year: financialYear ? parseInt(financialYear) : currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });

    useEffect(() => {
        if (financialYear) {
            setTxDate(prev => ({ ...prev, year: parseInt(financialYear) }));
        }
    }, [financialYear]);
    const [selectedCompany, setSelectedCompany] = useState('');
    const [txItems, setTxItems] = useState<Partial<WarehouseTransactionItem>[]>([{ itemId: '', quantity: 0, weight: 0, unitPrice: 0 }]);
    const [proformaNumber, setProformaNumber] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [driverName, setDriverName] = useState('');
    const [plateNumber, setPlateNumber] = useState('');
    const [destination, setDestination] = useState('');
    const [nextBijakNum, setNextBijakNum] = useState<number>(0);
    const [loadingBijakNum, setLoadingBijakNum] = useState(false);
    
    // View/Edit State
    const [viewBijak, setViewBijak] = useState<WarehouseTransaction | null>(null);
    const [editingBijak, setEditingBijak] = useState<WarehouseTransaction | null>(null); 
    const [editingReceipt, setEditingReceipt] = useState<WarehouseTransaction | null>(null); 
    
    useEffect(() => {
        if (viewBijak || editingBijak || editingReceipt) {
            const handleBack = () => {
                if (viewBijak) setViewBijak(null);
                if (editingBijak) setEditingBijak(null);
                if (editingReceipt) setEditingReceipt(null);
            };
            window.dispatchEvent(new CustomEvent('REGISTER_BACK_ACTION', { detail: handleBack }));
        } else if (activeTab !== 'dashboard') {
            const handleBack = () => {
                setActiveTab('dashboard');
            };
            window.dispatchEvent(new CustomEvent('REGISTER_BACK_ACTION', { detail: handleBack }));
        } else {
            window.dispatchEvent(new CustomEvent('UNREGISTER_BACK_ACTION'));
        }
        return () => { window.dispatchEvent(new CustomEvent('UNREGISTER_BACK_ACTION')); };
    }, [viewBijak, editingBijak, editingReceipt, activeTab]);
    
    // Reports State
    const [archiveFilterCompany, setArchiveFilterCompany] = useState('');
    const [reportSearch, setReportSearch] = useState('');

    // Barcode scanner & Excel Import/Export States
    const [barcodeScanInput, setBarcodeScanInput] = useState('');
    const [barcodeScanFeedback, setBarcodeScanFeedback] = useState<{ message: string; isError: boolean } | null>(null);

    // Stocktake States
    const [stocktakeCompany, setStocktakeCompany] = useState('');
    const [stocktakeCounted, setStocktakeCounted] = useState<Record<string, number>>({});
    const [stocktakeSearch, setStocktakeSearch] = useState('');
    const [stocktakeScanCode, setStocktakeScanCode] = useState('');
    const [stocktakeFeedback, setStocktakeFeedback] = useState<{ message: string; isError: boolean } | null>(null);

    const handleBarcodeScan = (scannedCode: string, type: 'IN' | 'OUT') => {
        if (!scannedCode) return;
        const cleanCode = scannedCode.trim();
        const foundItem = items.find(i => (i.code && i.code === cleanCode) || i.id === cleanCode || i.name === cleanCode);
        if (!foundItem) {
            setBarcodeScanFeedback({ message: `کالایی با بارکد یا کد "${cleanCode}" یافت نشد!`, isError: true });
            setTimeout(() => setBarcodeScanFeedback(null), 4000);
            return;
        }

        // Check if already in txItems
        const existingIdx = txItems.findIndex(i => i.itemId === foundItem.id);
        if (existingIdx > -1) {
            const newItems = [...txItems];
            newItems[existingIdx].quantity = (Number(newItems[existingIdx].quantity) || 0) + 1;
            setTxItems(newItems);
            setBarcodeScanFeedback({ message: `تعداد کالای "${foundItem.name}" افزایش یافت (تعداد جدید: ${newItems[existingIdx].quantity})`, isError: false });
        } else {
            // Check if the first row is empty
            if (txItems.length === 1 && !txItems[0].itemId) {
                const newItems = [...txItems];
                newItems[0] = { itemId: foundItem.id, itemName: foundItem.name, quantity: 1, weight: 0, unitPrice: 0 };
                setTxItems(newItems);
            } else {
                setTxItems([...txItems, { itemId: foundItem.id, itemName: foundItem.name, quantity: 1, weight: 0, unitPrice: 0 }]);
            }
            setBarcodeScanFeedback({ message: `کالای "${foundItem.name}" با موفقیت اضافه شد.`, isError: false });
        }
        setTimeout(() => setBarcodeScanFeedback(null), 4000);
    };

    const handleImportItemsExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const parsedRows = XLSX.utils.sheet_to_json(ws) as any[];

                if (!parsedRows || parsedRows.length === 0) {
                    alert('فایل اکسل خالی است یا قالب آن معتبر نیست.');
                    return;
                }

                const newTxItems: Partial<WarehouseTransactionItem>[] = [];
                for (const row of parsedRows) {
                    const rowCode = String(row['کد کالا'] || row['بارکد'] || row['code'] || row['barcode'] || '').trim();
                    const rowName = String(row['نام کالا'] || row['نام'] || row['name'] || '').trim();
                    const rowQty = Number(row['تعداد'] || row['مقدار'] || row['quantity'] || row['qty'] || 1);
                    const rowWeight = Number(row['وزن'] || row['weight'] || 0);
                    const rowPrice = Number(row['قیمت'] || row['فی'] || row['unitPrice'] || row['price'] || 0);

                    const item = items.find(i => (rowCode && i.code === rowCode) || (rowName && i.name === rowName));
                    if (item) {
                        newTxItems.push({
                            itemId: item.id,
                            itemName: item.name,
                            quantity: rowQty,
                            weight: rowWeight,
                            unitPrice: rowPrice
                        });
                    }
                }

                if (newTxItems.length === 0) {
                    alert('هیچ کالایی متناظر با اطلاعات اکسل در سیستم پیدا نشد. لطفاً مطمئن شوید کد کالا یا نام کالا با سیستم همخوانی دارد.');
                } else {
                    setTxItems(newTxItems);
                    alert(`${newTxItems.length} ردیف کالا با موفقیت از فایل اکسل بارگذاری شد.`);
                }
            } catch (err) {
                console.error(err);
                alert('خطا در پردازش فایل اکسل.');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadTemplateExcel = () => {
        const sampleData = [
            { 'کد کالا': '101', 'نام کالا': 'کارتن سایز ۱', 'تعداد': 100, 'وزن': 10, 'قیمت': 150000 },
            { 'کد کالا': '102', 'نام کالا': 'رول نایلون حبابدار', 'تعداد': 5, 'وزن': 50, 'قیمت': 2400000 },
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "اقلام انبار");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveBlobAndOpenFile(blob, "Sample_Warehouse_Items.xlsx");
    };

    const getSystemStockForCompany = (company: string, itemId: string) => {
        let qty = 0;
        allTransactions
            .filter(tx => tx.company === company && tx.status !== 'REJECTED')
            .forEach(tx => {
                tx.items.forEach(txItem => {
                    if (txItem.itemId === itemId) {
                        if (tx.type === 'IN') qty += txItem.quantity;
                        else qty -= txItem.quantity;
                    }
                });
            });
        return qty;
    };

    const handleStocktakeBarcodeScan = (scannedCode: string) => {
        if (!scannedCode) return;
        const cleanCode = scannedCode.trim();
        const foundItem = items.find(i => (i.code && i.code === cleanCode) || i.id === cleanCode || i.name === cleanCode);
        if (!foundItem) {
            setStocktakeFeedback({ message: `کالایی با بارکد یا کد "${cleanCode}" یافت نشد!`, isError: true });
            setTimeout(() => setStocktakeFeedback(null), 4000);
            return;
        }
        setStocktakeCounted(prev => {
            const current = prev[foundItem.id] || 0;
            return { ...prev, [foundItem.id]: current + 1 };
        });
        setStocktakeFeedback({ message: `کالای "${foundItem.name}" اسکن شد (شمارش فعلی: ${(stocktakeCounted[foundItem.id] || 0) + 1})`, isError: false });
        setTimeout(() => setStocktakeFeedback(null), 4000);
    };

    const handleImportStocktakeExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const parsedRows = XLSX.utils.sheet_to_json(ws) as any[];

                if (!parsedRows || parsedRows.length === 0) {
                    alert('فایل اکسل خالی است یا قالب آن معتبر نیست.');
                    return;
                }

                const newCounted = { ...stocktakeCounted };
                let count = 0;
                for (const row of parsedRows) {
                    const rowCode = String(row['کد کالا'] || row['بارکد'] || row['code'] || row['barcode'] || '').trim();
                    const rowName = String(row['نام کالا'] || row['نام'] || row['name'] || '').trim();
                    const rowQty = Number(row['تعداد شمارش شده'] || row['تعداد'] || row['مقدار'] || row['counted_qty'] || row['quantity'] || 0);

                    const item = items.find(i => (rowCode && i.code === rowCode) || (rowName && i.name === rowName));
                    if (item) {
                        newCounted[item.id] = rowQty;
                        count++;
                    }
                }

                setStocktakeCounted(newCounted);
                alert(`${count} قلم کالا با موفقیت از فایل شمارش انبارگردانی اکسل بارگذاری شد.`);
            } catch (err) {
                console.error(err);
                alert('خطا در پردازش فایل اکسل.');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleExportStocktakeExcel = () => {
        if (!stocktakeCompany) return;
        const reportData = items.map(i => {
            const systemQty = getSystemStockForCompany(stocktakeCompany, i.id);
            const countedQty = stocktakeCounted[i.id] || 0;
            const diff = countedQty - systemQty;
            return {
                'کد کالا': i.code || '',
                'نام کالا': i.name,
                'واحد سنجش': i.unit,
                'موجودی سیستم': systemQty,
                'موجودی شمارش شده': countedQty,
                'مغایرت': diff,
                'وضعیت': diff === 0 ? 'منطبق' : (diff > 0 ? 'سرک (اضافی)' : 'کسری')
            };
        });

        const ws = XLSX.utils.json_to_sheet(reportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "گزارش انبارگردانی");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveBlobAndOpenFile(blob, `Stocktake_${stocktakeCompany}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleApplyStocktake = async () => {
        if (!stocktakeCompany) { alert('لطفاً ابتدا شرکت مورد نظر را انتخاب کنید.'); return; }
        if (!confirm(`آیا از اعمال مغایرت‌ها و به‌روزرسانی موجودی سیستم برای شرکت "${stocktakeCompany}" اطمینان دارید؟`)) return;

        let surplusItems: WarehouseTransactionItem[] = [];
        let deficitItems: WarehouseTransactionItem[] = [];

        items.forEach(i => {
            const systemQty = getSystemStockForCompany(stocktakeCompany, i.id);
            const countedQty = stocktakeCounted[i.id] || 0;
            const diff = countedQty - systemQty;

            if (diff > 0) {
                surplusItems.push({ itemId: i.id, itemName: i.name, quantity: diff, weight: 0, unitPrice: 0 });
            } else if (diff < 0) {
                deficitItems.push({ itemId: i.id, itemName: i.name, quantity: Math.abs(diff), weight: 0, unitPrice: 0 });
            }
        });

        if (surplusItems.length === 0 && deficitItems.length === 0) {
            alert('هیچ مغایرتی بین موجودی سیستمی و موجودی شمارش شده وجود ندارد. نیاز به ثبت سند اصلاحی نیست.');
            return;
        }

        try {
            if (surplusItems.length > 0) {
                const txSurplus: WarehouseTransaction = {
                    id: generateUUID(),
                    type: 'IN',
                    date: getIsoDate(),
                    company: stocktakeCompany,
                    number: 0,
                    items: surplusItems,
                    createdAt: Date.now(),
                    createdBy: currentUser.fullName,
                    proformaNumber: 'اصلاحیه انبارگردانی - سرک (اضافی)'
                };
                await saveWarehouseTransaction(txSurplus);
            }

            if (deficitItems.length > 0) {
                let nextNum = 0;
                try {
                    const res = await apiCall<{ nextNumber: number }>(`/next-bijak-number?company=${encodeURIComponent(stocktakeCompany)}`);
                    if (res && res.nextNumber) nextNum = res.nextNumber;
                } catch (e) {}

                const txDeficit: WarehouseTransaction = {
                    id: generateUUID(),
                    type: 'OUT',
                    date: getIsoDate(),
                    company: stocktakeCompany,
                    number: nextNum,
                    items: deficitItems,
                    createdAt: Date.now(),
                    createdBy: currentUser.fullName,
                    destination: 'اصلاحیه انبارگردانی - کسری',
                    status: 'APPROVED'
                };
                await saveWarehouseTransaction(txDeficit);
            }

            await loadData();
            alert('عملیات انبارگردانی با موفقیت نهایی و اسناد تعدیل موجودی ثبت گردید.');
            setStocktakeCompany('');
            setStocktakeCounted({});
            setActiveTab('stock_report');
        } catch (e) {
            console.error(e);
            alert('خطا در ثبت اسناد اصلاحی انبارگردانی.');
        }
    };

    // Print Report State
    const [showPrintStockReport, setShowPrintStockReport] = useState(false); 

    // Auto Send on Approval/Edit/Delete
    const [activeAutoSends, setActiveAutoSends] = useState<{tx: WarehouseTransaction, type: 'CREATED' | 'APPROVED' | 'EDITED' | 'DELETED'}[]>([]);
    const [createdTxForAutoSend, setCreatedTxForAutoSend] = useState<WarehouseTransaction | null>(null);
    const [approvedTxForAutoSend, setApprovedTxForAutoSend] = useState<WarehouseTransaction | null>(null);
    const [editedBijakForAutoSend, setEditedBijakForAutoSend] = useState<WarehouseTransaction | null>(null);
    const [deletedTxForAutoSend, setDeletedTxForAutoSend] = useState<WarehouseTransaction | null>(null);

    // Effect to process the queue
    useEffect(() => {
        const processQueue = async () => {
            if (activeAutoSends.length === 0) return;
            
            const next = activeAutoSends[0];
            const { tx, type } = next;

            // Set the appropriate state for the hidden printer to render
            if (type === 'CREATED') setCreatedTxForAutoSend(tx);
            if (type === 'APPROVED') setApprovedTxForAutoSend(tx);
            if (type === 'EDITED') setEditedBijakForAutoSend(tx);
            if (type === 'DELETED') setDeletedTxForAutoSend(tx);

            // Wait for DOM to render the hidden printer
            await new Promise(resolve => setTimeout(resolve, 3000));

            try {
                const users = await getUsers();
                const companyConfig = settings?.companyNotifications?.[tx.company];
                
                if (type === 'CREATED') {
                    const element = document.getElementById(`print-bijak-created-${tx.id}-price`);
                    if (element) {
                        const ceos = users.filter((u: any) => u.role === UserRole.CEO && (u.phoneNumber || u.telegramId));
                        if (ceos.length > 0) {
                            const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200, useCORS: true });
                            const base64 = canvas.toDataURL('image/png').split(',')[1];
                            const mediaData = { data: base64, mimeType: 'image/png', filename: `Bijak_Pending_${tx.number}.png` };
                            
                            let caption = `🔔 *درخواست بیجک جدید (در انتظار تایید)*\n`;
                            caption += `شماره: ${tx.number}\n`;
                            caption += `شرکت: ${tx.company}\n`;
                            caption += `گیرنده: ${tx.recipientName}\n`;
                            caption += `توسط: ${tx.createdBy}\n\n`;
                            caption += `لطفا جهت تایید بررسی نمایید.`;

                            for (const ceo of ceos) {
                                if (ceo.phoneNumber) await apiCall('/send-whatsapp', 'POST', { number: ceo.phoneNumber, message: caption, mediaData });
                                const chatId = (ceo as any).telegramId || (ceo as any).telegramChatId;
                                if (chatId) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId, caption, mediaData });
                            }
                        }
                    }
                } else if (type === 'APPROVED') {
                    const managerElement = document.getElementById(`print-bijak-${tx.id}-price`);
                    const warehouseElement = document.getElementById(`print-bijak-${tx.id}-noprice`);
                    
                    const managerNumber = companyConfig?.salesManager;
                    const groupNumber = companyConfig?.warehouseGroup;

                    let caption = `✅ *بیجک تایید شد*\n`;
                    caption += `🔢 شماره: ${tx.number}\n`;
                    caption += `👤 گیرنده: ${tx.recipientName}\n`;
                    caption += `📑 شرکت: ${tx.company}\n`;
                    caption += `🚛 راننده: ${tx.driverName || '---'}\n`;
                    caption += `🏁 مقصد: ${tx.destination || '---'}\n`;
                    caption += `👤 تایید توسط: ${tx.approvedBy}\n`;

                    if (managerElement) {
                        const canvas = await html2canvas(managerElement, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200, useCORS: true });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        const mediaData = { data: base64, mimeType: 'image/png', filename: `Bijak_${tx.number}.png` };
                        if (managerNumber) {
                           await apiCall('/send-whatsapp', 'POST', { number: managerNumber, message: caption, mediaData });
                        }
                        
                        const managers = users.filter((u: any) => (u.role === UserRole.CEO || u.role === UserRole.SALES_MANAGER || u.role === UserRole.ADMIN) && (u.telegramId || u.baleId));
                        for (const m of managers) {
                            const tgId = (m as any).telegramId || (m as any).telegramChatId;
                            const blId = (m as any).baleId || (m as any).baleChatId;
                            if (tgId) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: tgId, caption, mediaData });
                            if (blId) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: blId, caption, mediaData });
                        }
                    }

                    if (warehouseElement) {
                        const canvas = await html2canvas(warehouseElement, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200, useCORS: true });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        const mediaData = { data: base64, filename: `Bijak_${tx.number}.png` };
                        
                        if (groupNumber) await apiCall('/send-whatsapp', 'POST', { number: groupNumber, message: caption, mediaData: { ...mediaData, mimeType: 'image/png' } });
                        if (companyConfig?.telegramChannelId) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: companyConfig.telegramChannelId, caption, mediaData });
                        if (companyConfig?.baleChannelId) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: companyConfig.baleChannelId, caption, mediaData });
                    }
                }
            } catch (e) {
                console.error("AutoSend Error:", e);
            }

            // Cleanup and move to next
            setCreatedTxForAutoSend(null);
            setApprovedTxForAutoSend(null);
            setEditedBijakForAutoSend(null);
            setDeletedTxForAutoSend(null);
            setActiveAutoSends(prev => prev.slice(1));
        };

        processQueue();
    }, [activeAutoSends, settings]);

    useEffect(() => { loadData(); }, [financialYear]);
    useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
    
    // Trigger update on company change
    useEffect(() => { 
        if(selectedCompany && activeTab === 'exit') { 
            updateNextBijak(); 
        } 
    }, [selectedCompany, activeTab]);

    const loadData = async () => { 
        setLoadingData(true); 
        try { 
            const [i, t] = await Promise.all([getWarehouseItems(), getWarehouseTransactions()]); 
            setItems(Array.isArray(i) ? i : []); 
            let rawTxs = Array.isArray(t) ? t : [];
            setAllTransactions(rawTxs);
            let safeTxs = rawTxs;
            if (financialYear && financialYear !== 'all') {
                safeTxs = safeTxs.filter(tx => isInFinancialYear(tx.date, financialYear));
            }
            setTransactions(safeTxs); 
        } catch (e) { 
            console.error(e); 
            setItems([]);
            setTransactions([]);
            setAllTransactions([]);
        } finally { 
            setLoadingData(false); 
        } 
    };
    
    const updateNextBijak = async () => { 
        if(selectedCompany) { 
            setLoadingBijakNum(true);
            try {
                // FORCE REFRESH: Use apiCall with company param
                const response = await apiCall<{ nextNumber: number }>(`/next-bijak-number?company=${encodeURIComponent(selectedCompany)}&t=${Date.now()}`);
                if (response && response.nextNumber) {
                    setNextBijakNum(response.nextNumber);
                }
            } catch(e) {
                console.error("Bijak Num Error", e);
            } finally {
                setLoadingBijakNum(false);
            }
        } 
    };
    
    const getIsoDate = () => { 
        try { 
            const date = jalaliToGregorian(txDate.year, txDate.month, txDate.day); 
            date.setHours(12, 0, 0, 0); 
            return date.toISOString(); 
        } catch { 
            const d = new Date();
            d.setHours(12, 0, 0, 0);
            return d.toISOString(); 
        } 
    };
    
    // --- ITEM MANAGEMENT ---
    const handleAddItem = async () => { 
        if(!newItemName) return; 
        await saveWarehouseItem({ 
            id: generateUUID(), 
            name: newItemName, 
            code: newItemCode, 
            unit: newItemUnit, 
            containerCapacity: Number(newItemContainerCapacity) || 0 
        }); 
        setNewItemName(''); 
        setNewItemCode(''); 
        setNewItemContainerCapacity('');
        loadData(); 
    };
    
    const handleEditItem = async () => {
        if (!editingItem) return;
        await updateWarehouseItem(editingItem);
        setEditingItem(null);
        loadData();
    };

    const handleDeleteItem = async (id: string) => { if(confirm('حذف شود؟')) { await deleteWarehouseItem(id); loadData(); } };
    
    const handleAddTxItemRow = () => setTxItems([...txItems, { itemId: '', quantity: 0, weight: 0, unitPrice: 0 }]);
    const handleRemoveTxItemRow = (idx: number) => setTxItems(txItems.filter((_, i) => i !== idx));
    const updateTxItem = (idx: number, field: keyof WarehouseTransactionItem, val: any) => { const newItems = [...txItems]; newItems[idx] = { ...newItems[idx], [field]: val }; if(field === 'itemId') { const item = items.find(i => i.id === val); if(item) newItems[idx].itemName = item.name; } setTxItems(newItems); };

    const handleSubmitTx = async (type: 'IN' | 'OUT') => {
        if(!selectedCompany) { alert('شرکت را انتخاب کنید'); return; }
        if(txItems.some(i => !i.itemId || !i.quantity)) { alert('اقلام را کامل کنید'); return; }

        const validItems = txItems.map(i => ({ itemId: i.itemId!, itemName: i.itemName!, quantity: Number(i.quantity), weight: Number(i.weight), unitPrice: Number(i.unitPrice)||0 }));
        const tx: WarehouseTransaction = { 
            id: generateUUID(), 
            type, 
            date: getIsoDate(), 
            company: selectedCompany, 
            number: type === 'IN' ? 0 : nextBijakNum, 
            items: validItems, 
            createdAt: Date.now(), 
            createdBy: currentUser.fullName, 
            proformaNumber: type === 'IN' ? proformaNumber : undefined, 
            recipientName: type === 'OUT' ? recipientName : undefined, 
            driverName: type === 'OUT' ? driverName : undefined, 
            plateNumber: type === 'OUT' ? plateNumber : undefined, 
            destination: type === 'OUT' ? destination : undefined,
            status: type === 'OUT' ? 'PENDING' : undefined,
        };

        try {
            await saveWarehouseTransaction(tx);
            await loadData();
            if(type === 'OUT') {
                updateNextBijak();
                setActiveAutoSends(prev => [...prev, { tx, type: 'CREATED' }]);
                alert('بیجک ثبت شد و در انتظار تایید مدیریت است.');
                setRecipientName(''); setDriverName(''); setPlateNumber(''); setDestination('');
            } else {
                setProformaNumber(''); alert('ورود کالا ثبت شد.');
            }
            setTxItems([{ itemId: '', quantity: 0, weight: 0, unitPrice: 0 }]);
        } catch (e: any) {
            alert('خطا در ثبت اطلاعات.');
        }
    };

    const handleApproveBijak = async (tx: WarehouseTransaction) => {
        if (!confirm('آیا تایید می‌کنید؟ پس از تایید، بیجک به صورت خودکار برای انبار و مدیریت ارسال می‌شود.')) return;
        
        try {
            const updatedTx = { ...tx, status: 'APPROVED' as const, approvedBy: currentUser.fullName };
            await updateWarehouseTransaction(updatedTx);
            loadData();
            
            // Add to notification queue
            setActiveAutoSends(prev => [...prev, { tx: updatedTx, type: 'APPROVED' }]);
            
            setViewBijak(null);
            alert("تایید و در صف ارسال قرار گرفت.");
        } catch (e) { alert("خطا در عملیات تایید"); }
    };

    const handleRejectBijak = async (tx: WarehouseTransaction) => {
        const reason = prompt("لطفا دلیل رد بیجک را وارد کنید:");
        if (reason) {
            const updatedTx = { ...tx, status: 'REJECTED' as const, rejectionReason: reason, rejectedBy: currentUser.fullName };
            await updateWarehouseTransaction(updatedTx);
            loadData();
            setViewBijak(null); 
        }
    };

    const handleDeleteTx = async (id: string) => { 
        if(!confirm('آیا از حذف این تراکنش اطمینان دارید؟ عملیات غیرقابل بازگشت است.')) return;

        const txToDelete = transactions.find(t => t.id === id);
        
        if (txToDelete && txToDelete.type === 'OUT' && settings && settings.companyNotifications) {
            const deletedMock = { ...txToDelete, status: 'DELETED' as any };
            setDeletedTxForAutoSend(deletedMock);

            setTimeout(async () => {
                const managerElement = document.getElementById(`print-bijak-del-${id}-price`);
                const warehouseElement = document.getElementById(`print-bijak-del-${id}-noprice`);
                
                const companyConfig = settings.companyNotifications?.[txToDelete.company];
                const managerNumber = companyConfig?.salesManager;
                const groupNumber = companyConfig?.warehouseGroup;

                let warningCaption = `❌❌ *هشدار: بیجک حذف شد* ❌❌\n`;
                warningCaption += `⛔ *ارسال بار ممنوع*\n`;
                warningCaption += `🔢 شماره: ${txToDelete.number}\n`;
                warningCaption += `👤 گیرنده: ${txToDelete.recipientName}\n`;
                warningCaption += `🗑️ حذف توسط: ${currentUser.fullName}\n`;
                warningCaption += `⚠️ *این بیجک از سیستم حذف شده و فاقد اعتبار است.*`;

                try {
                    if (managerNumber && managerElement) {
                        const canvas = await html2canvas(managerElement, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200, useCORS: true });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        await apiCall('/send-whatsapp', 'POST', { number: managerNumber, message: warningCaption, mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_DELETED_${txToDelete.number}.png` } });
                    }
                    if (warehouseElement) {
                        const canvas = await html2canvas(warehouseElement, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200, useCORS: true });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        const mediaData = { data: base64, filename: `Bijak_DELETED_${txToDelete.number}.png` };
                        
                        if (groupNumber) {
                            await apiCall('/send-whatsapp', 'POST', { number: groupNumber, message: warningCaption, mediaData: { ...mediaData, mimeType: 'image/png' } });
                        }
                        if (companyConfig?.telegramChannelId) {
                            await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: companyConfig.telegramChannelId, caption: warningCaption, mediaData });
                        }
                        if (companyConfig?.baleChannelId) {
                            await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: companyConfig.baleChannelId, caption: warningCaption, mediaData });
                        }
                    }
                } catch(e) { console.error("Error sending delete notification", e); }
                
                await deleteWarehouseTransaction(id);
                setDeletedTxForAutoSend(null);
                loadData();
                setViewBijak(null); 
                alert("تراکنش حذف و اطلاع‌رسانی شد.");

            }, 2500);
        } else {
            await deleteWarehouseTransaction(id);
            loadData();
        }
    };
    
    const handleEditBijakSave = async (updatedTx: WarehouseTransaction) => {
        try { 
            updatedTx.status = 'PENDING';
            updatedTx.updatedAt = Date.now();
            
            await updateWarehouseTransaction(updatedTx); 
            setEditingBijak(null); 
            
            setEditedBijakForAutoSend(updatedTx);

            setTimeout(async () => {
                 const element = document.getElementById(`print-bijak-edit-${updatedTx.id}`);
                 if (element) {
                     try {
                         const users = await getUsers();
                         const ceos = users.filter((u: any) => u.role === UserRole.CEO && (u.phoneNumber || u.telegramId || u.baleId || u.telegramChatId || u.baleChatId));
                         if (ceos.length > 0) {
                             const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200, useCORS: true });
                             const base64 = canvas.toDataURL('image/png').split(',')[1];
                            const mediaData = { data: base64, mimeType: 'image/png', filename: `Bijak_Edit_${updatedTx.number}.png` };
                            
                            for (const ceo of ceos) {
                                let caption = `📝 *اصلاحیه بیجک (جهت تایید مجدد)*\n`;
                                caption += `شماره: ${updatedTx.number}\n`;
                                caption += `گیرنده: ${updatedTx.recipientName}\n`;
                                caption += `ویرایش توسط: ${currentUser.fullName}\n\n`;
                                caption += `لطفا بررسی نمایید.`;

                                if (ceo.phoneNumber) {
                                  await apiCall('/send-whatsapp', 'POST', { number: ceo.phoneNumber, message: caption, mediaData });
                                }
                                if ((ceo as any).telegramId || (ceo as any).telegramChatId) {
                                  await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: (ceo as any).telegramId || (ceo as any).telegramChatId, caption, mediaData });
                                }
                                if ((ceo as any).baleId || (ceo as any).baleChatId) {
                                  await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: (ceo as any).baleId || (ceo as any).baleChatId, caption, mediaData });
                                }
                            }
                         }
                     } catch(e) { console.error(e); }
                 }
                 setEditedBijakForAutoSend(null);
                 loadData(); 
                 alert('بیجک ویرایش و جهت تایید مجدد به مدیریت ارسال شد.'); 
            }, 2500);

        } catch (e: any) { 
            console.error(e); 
            alert('خطا در ویرایش بیجک.');
        }
    };

    const handleEditReceiptSave = async (updatedTx: WarehouseTransaction) => {
        try { await updateWarehouseTransaction(updatedTx); setEditingReceipt(null); loadData(); alert('رسید با موفقیت ویرایش شد.'); } catch (e) { console.error(e); alert('خطا در ویرایش رسید.'); }
    };

    const safeTransactions = Array.isArray(transactions) ? transactions : [];

    const allWarehousesStock = useMemo(() => {
        const companies = settings?.companies?.filter(c => c.showInWarehouse !== false).map(c => c.name) || [];
        const result = companies.map(company => {
            const companyItems = items.map(catalogItem => {
                let quantity = 0; let weight = 0;
                
                // Cumulative logic: We want all transactions from all time UP TO the end of the selected financial year
                // If financialYear is not set, we use all transactions.
                allTransactions
                    .filter(tx => tx.company === company && tx.status !== 'REJECTED')
                    .filter(tx => {
                        if (!financialYear || financialYear === 'all') return true;
                        // Check if transaction year is <= current selected year
                        try {
                            const d = new Date(tx.date);
                            const shamsi = d.toLocaleDateString('fa-IR-u-nu-latn');
                            const yearStr = shamsi.split('/')[0].replace(/[^\d]/g, '');
                            const year = parseInt(yearStr, 10);
                            const targetYearStr = financialYear.replace(/[^\d]/g, '');
                            const targetYear = parseInt(targetYearStr, 10);
                            return year <= targetYear;
                        } catch (e) { return true; }
                    })
                    .forEach(tx => {
                        tx.items.forEach(txItem => {
                            if (txItem.itemId === catalogItem.id) {
                                if (tx.type === 'IN') { quantity += txItem.quantity; weight += txItem.weight; } 
                                else { quantity -= txItem.quantity; weight -= txItem.weight; }
                            }
                        });
                    });
                const containerCapacity = catalogItem.containerCapacity || 0;
                const containerCount = (containerCapacity > 0 && quantity > 0) ? (quantity / containerCapacity) : 0;
                return { id: catalogItem.id, name: catalogItem.name, quantity, weight, containerCount };
            }).filter(item => item.quantity !== 0); // FILTER NON-ZERO STOCK
            return { company, items: companyItems };
        }).filter(group => group.items.length > 0); // ONLY SHOW COMPANIES WITH AT LEAST ONE ITEM
        return result;
    }, [allTransactions, items, settings, financialYear]);

    const recentBijaks = useMemo(() => safeTransactions.filter(t => t.type === 'OUT').slice(0, 5), [safeTransactions]);
    
    // Updated Filtering logic using reportSearch
    const filteredArchiveBijaks = useMemo(() => safeTransactions.filter(t => t.type === 'OUT' && (!archiveFilterCompany || t.company === archiveFilterCompany) && (String(t.number).includes(reportSearch) || (t.recipientName && t.recipientName.includes(reportSearch)))), [safeTransactions, archiveFilterCompany, reportSearch]);
    const filteredArchiveReceipts = useMemo(() => safeTransactions.filter(t => t.type === 'IN' && (!archiveFilterCompany || t.company === archiveFilterCompany) && (String(t.proformaNumber).includes(reportSearch))), [safeTransactions, archiveFilterCompany, reportSearch]);
    
    const pendingBijaks = useMemo(() => safeTransactions.filter(t => t.type === 'OUT' && t.status === 'PENDING'), [safeTransactions]);

    const handlePrintStock = () => { setShowPrintStockReport(true); };

    // --- EXCEL EXPORT FUNCTION (Formatted side-by-side like PDF - OFFLINE) ---
    const handleExportExcel = () => {
        if (!allWarehousesStock || allWarehousesStock.length === 0) return alert("داده‌ای برای خروجی وجود ندارد.");
        
        const companiesCount = allWarehousesStock.length;
        const totalExcelCols = companiesCount * 5 - 1;
        
        const aoa = [];
        
        const titleRow = new Array(totalExcelCols).fill("");
        titleRow[0] = "موجودی کلی انبارها";
        aoa.push(titleRow);
        
        const companyRow = new Array(totalExcelCols).fill("");
        allWarehousesStock.forEach((group, index) => {
            const startCol = index * 5;
            companyRow[startCol] = group.company;
        });
        aoa.push(companyRow);
        
        const headerRow = new Array(totalExcelCols).fill("");
        allWarehousesStock.forEach((group, index) => {
            const startCol = index * 5;
            headerRow[startCol] = "نخ / کالا";
            headerRow[startCol + 1] = "کارتن";
            headerRow[startCol + 2] = "وزن";
            headerRow[startCol + 3] = "کانتینر";
        });
        aoa.push(headerRow);
        
        const maxItems = Math.max(...allWarehousesStock.map(group => group.items.length), 0);
        for (let i = 0; i < maxItems; i++) {
            const itemRow = new Array(totalExcelCols).fill("");
            allWarehousesStock.forEach((group, index) => {
                const startCol = index * 5;
                if (group.items[i]) {
                    const item = group.items[i];
                    itemRow[startCol] = item.name;
                    itemRow[startCol + 1] = Number(item.quantity || 0);
                    itemRow[startCol + 2] = Number(item.weight || 0);
                    itemRow[startCol + 3] = item.containerCount > 0 ? Number(item.containerCount) : "-";
                }
            });
            aoa.push(itemRow);
        }
        
        const totalRow = new Array(totalExcelCols).fill("");
        allWarehousesStock.forEach((group, index) => {
            const startCol = index * 5;
            if (group.items.length > 0) {
                const totalQty = group.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
                const totalWeight = group.items.reduce((sum, item) => sum + (item.weight || 0), 0);
                totalRow[startCol] = "جمع کل موجودی";
                totalRow[startCol + 1] = totalQty;
                totalRow[startCol + 2] = totalWeight;
                totalRow[startCol + 3] = "";
            }
        });
        aoa.push(totalRow);
        
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        
        const merges = [];
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, totalExcelCols - 1) } });
        
        allWarehousesStock.forEach((group, index) => {
            const startCol = index * 5;
            merges.push({ s: { r: 1, c: startCol }, e: { r: 1, c: startCol + 3 } });
        });
        
        ws['!merges'] = merges;
        
        const wscols = [];
        allWarehousesStock.forEach(() => {
            wscols.push({ wch: 25 });
            wscols.push({ wch: 12 });
            wscols.push({ wch: 12 });
            wscols.push({ wch: 12 });
            wscols.push({ wch: 4 });
        });
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "موجودی انبارها");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        saveBlobAndOpenFile(blob, `Stock_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    if (!settings || loadingData) return <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500 gap-2"><Loader2 className="animate-spin text-blue-600" size={32}/><span className="text-sm font-bold">در حال بارگذاری اطلاعات انبار...</span></div>;
    const companyList = settings.companies?.filter(c => c.showInWarehouse !== false).map(c => c.name) || [];
    if (companyList.length === 0) return (<div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 animate-fade-in"><div className="bg-amber-100 p-4 rounded-full text-amber-600 mb-4 shadow-sm"><AlertTriangle size={48}/></div><h2 className="text-xl font-bold text-gray-800 mb-2">هیچ شرکتی برای انبار فعال نشده است</h2><p className="text-gray-600 max-w-md mb-6 leading-relaxed">برای استفاده از سیستم انبار، لطفاً در تنظیمات سیستم به بخش "مدیریت شرکت‌ها" بروید و تیک "نمایش در انبار" را برای شرکت‌های مورد نظر فعال کنید.</p><div className="flex gap-2"><button onClick={() => window.location.hash = '#settings'} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg"><Settings size={20}/><span>رفتن به تنظیمات</span></button></div></div>);

    const years = Array.from({length:10},(_,i)=>1400+i); const months = Array.from({length:12},(_,i)=>i+1); const days = Array.from({length:31},(_,i)=>i+1);

    const canApprove = currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN || permissions?.canApproveBijak === true;

    return (
        <div className="glass-panel md:rounded-2xl shadow-sm md:border h-[calc(100dvh-140px)] md:h-[calc(100vh-100px)] flex flex-col overflow-hidden animate-fade-in relative">
            
            {/* Hidden Print Elements for Auto-Send */}
            {createdTxForAutoSend && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-bijak-created-${createdTxForAutoSend.id}-price`}><PrintBijak tx={createdTxForAutoSend} onClose={()=>{}} embed forceHidePrices={false} transactions={safeTransactions} /></div>
                </div>
            )}
            {approvedTxForAutoSend && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-bijak-${approvedTxForAutoSend.id}-price`}><PrintBijak tx={approvedTxForAutoSend} onClose={()=>{}} embed forceHidePrices={false} transactions={safeTransactions} /></div>
                    <div id={`print-bijak-${approvedTxForAutoSend.id}-noprice`}><PrintBijak tx={approvedTxForAutoSend} onClose={()=>{}} embed forceHidePrices={true} transactions={safeTransactions} /></div>
                </div>
            )}
            {deletedTxForAutoSend && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-bijak-del-${deletedTxForAutoSend.id}-price`}><PrintBijak tx={deletedTxForAutoSend} onClose={()=>{}} embed forceHidePrices={false} transactions={safeTransactions} /></div>
                    <div id={`print-bijak-del-${deletedTxForAutoSend.id}-noprice`}><PrintBijak tx={deletedTxForAutoSend} onClose={()=>{}} embed forceHidePrices={true} transactions={safeTransactions} /></div>
                </div>
            )}
            {editedBijakForAutoSend && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-bijak-edit-${editedBijakForAutoSend.id}`}><PrintBijak tx={editedBijakForAutoSend} onClose={()=>{}} embed forceHidePrices={false} transactions={safeTransactions} /></div>
                </div>
            )}
            
            {showPrintStockReport && (
                <PrintStockReport data={allWarehousesStock} onClose={() => setShowPrintStockReport(false)} />
            )}

            <div className={`bg-white dark:bg-gray-900 p-2 flex gap-1.5 border-b overflow-x-auto no-print scrollbar-hide shrink-0 sticky top-0 z-[35] backdrop-blur-md bg-opacity-90 ${isMobile ? 'px-4 py-3' : 'p-2'}`}>
                {activeTab !== 'dashboard' && (
                    <button 
                        onClick={() => setActiveTab('dashboard')}
                        data-subtab-back="true"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-200 shrink-0 transition-all hover:scale-105 active:scale-95 border border-transparent hover:border-gray-300"
                        title="بازگشت به پیشخوان انبار"
                    >
                        <ArrowLeftRight size={18} className="rotate-180" />
                        {!isMobile && <span className="text-xs">بازگشت</span>}
                    </button>
                )}
                {[
                    { id: 'dashboard', label: 'داشبورد', color: 'blue' },
                    { id: 'items', label: 'تعریف کالا', color: 'blue' },
                    { id: 'entry', label: 'ورود کالا', color: 'green' },
                    { id: 'entry_archive', label: 'رسیدها', color: 'emerald' },
                    { id: 'exit', label: 'خروج کالا', color: 'red' },
                    { id: 'archive', label: 'بیجک‌ها', color: 'gray' },
                    { id: 'approvals', label: 'تاییدیه', color: 'orange' },
                    { id: 'reports', label: 'کاردکس', color: 'purple' },
                    { id: 'stocktake', label: 'انبارگردانی', color: 'indigo' },
                    { id: 'dispatch_report', label: 'گزارش بیجک‌ها', color: 'red' },
                    { id: 'stock_report', label: 'موجودی', color: 'orange' }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)} 
                        className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all duration-200 ${
                            activeTab === tab.id 
                            ? `bg-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-600/20 scale-105 active-tab-pulse` 
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-white/5'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                
                {activeTab === 'approvals' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between no-print">
                            <h3 className="font-black text-gray-800 dark:text-white flex items-center gap-2"><CheckCircle className="text-orange-600"/> لیست در انتظار تایید</h3>
                            {isMobile && <div className="text-[10px] bg-orange-100 text-orange-700 font-bold px-2 py-1 rounded-full">{pendingBijaks.length} مورد</div>}
                        </div>
                        {/* Mobile Optimized List for Approvals */}
                        {isMobile ? (
                            <div className="grid grid-cols-1 gap-4">
                                {pendingBijaks.length === 0 ? (
                                    <div className="text-center text-gray-400 py-20 flex flex-col items-center gap-2">
                                        <ShieldCheck size={48} className="opacity-10"/>
                                        <p className="font-bold">هیچ درخواستی در لیست تایید نیست</p>
                                    </div>
                                ) : pendingBijaks.map(tx => (
                                    <div key={tx.id} className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-1.5 h-full bg-orange-500"></div>
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-orange-50 text-orange-700 font-black px-2 py-1 rounded-lg text-sm">#{tx.number}</span>
                                                <span className="text-[10px] font-bold text-gray-500">{formatDate(tx.date)}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-gray-400">توسط: {tx.createdBy}</span>
                                        </div>
                                        <div className="text-base font-black text-gray-800 dark:text-white mb-1">{tx.company}</div>
                                        <div className="text-xs font-bold text-gray-500 mb-4 flex items-center gap-1"><Users size={12}/> گیرنده: {tx.recipientName}</div>
                                        
                                        <div className="flex gap-2">
                                            <button onClick={() => setViewBijak(tx)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-3 rounded-xl text-xs font-black shadow-sm border border-gray-200 dark:border-white/5 active:scale-95 transition-transform">مشاهده</button>
                                            {canApprove && (
                                                <>
                                                    <button onClick={() => handleApproveBijak(tx)} className="flex-1 bg-green-600 text-white py-3 rounded-xl text-xs font-black shadow-lg shadow-green-600/20 active:scale-95 transition-transform">تایید</button>
                                                    <button onClick={() => handleRejectBijak(tx)} className="flex-1 bg-red-600 text-white py-3 rounded-xl text-xs font-black shadow-lg shadow-red-600/20 active:scale-95 transition-transform">رد</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            // Desktop Table
                            <div className="glass-panel rounded-xl border shadow-sm overflow-hidden">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-gray-100 text-gray-600"><tr><th className="p-4">شماره</th><th className="p-4">تاریخ</th><th className="p-4">شرکت</th><th className="p-4 text-center">عملیات</th></tr></thead>
                                    <tbody className="divide-y">
                                        {pendingBijaks.map(tx => (
                                            <tr key={tx.id} className="hover:bg-gray-50">
                                                <td className="p-4 font-mono font-bold text-red-600">#{tx.number}</td>
                                                <td className="p-4 text-xs">{formatDate(tx.date)}</td>
                                                <td className="p-4 text-xs font-bold">{tx.company}</td>
                                                <td className="p-4 text-center flex justify-center gap-2">
                                                    <button onClick={() => setViewBijak(tx)} className="bg-blue-100 text-blue-600 p-2 rounded hover:bg-blue-200" title="مشاهده"><Eye size={16}/></button>
                                                    {canApprove && (
                                                        <>
                                                            <button onClick={() => handleApproveBijak(tx)} className="bg-green-100 text-green-600 p-2 rounded hover:bg-green-200" title="تایید و ارسال"><CheckCircle size={16}/></button>
                                                            <button onClick={() => handleRejectBijak(tx)} className="bg-red-100 text-red-600 p-2 rounded hover:bg-red-200" title="رد"><XCircle size={16}/></button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {pendingBijaks.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">هیچ بیجکی در انتظار تایید نیست.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'dashboard' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex flex-col gap-1 mb-2">
                             <h2 className="text-xl font-black text-gray-800 dark:text-white">وضعیت انبار</h2>
                             <p className="text-xs font-bold text-gray-400">خلاصه فعالیت‌ها و موجودی کالاها</p>
                        </div>
                        {/* Cards - Auto Responsive Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div onClick={() => setActiveTab('items')} className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-blue-500/30 cursor-pointer hover:scale-[1.02] transition-transform flex flex-col justify-between h-40">
                                <div className="flex justify-between items-start">
                                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md"><Package size={24}/></div>
                                    <div className="text-4xl font-black">{items.length}</div>
                                </div>
                                <div>
                                    <div className="text-sm font-black opacity-90">تنوع کالاها</div>
                                    <div className="text-[10px] opacity-70 mt-0.5">لیست کالاهای تعریف شده در سیستم</div>
                                </div>
                            </div>
                            
                            <div onClick={() => setActiveTab('entry_archive')} className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-3xl text-white shadow-lg shadow-emerald-500/30 cursor-pointer hover:scale-[1.02] transition-transform flex flex-col justify-between h-40">
                                <div className="flex justify-between items-start">
                                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md"><ArrowDownCircle size={24}/></div>
                                    <div className="text-4xl font-black">{safeTransactions.filter(t=>t.type==='IN').length}</div>
                                </div>
                                <div>
                                    <div className="text-sm font-black opacity-90">کل ورودی‌ها</div>
                                    <div className="text-[10px] opacity-70 mt-0.5">تعداد کل فاکتورها و پروفرماهای رسیده</div>
                                </div>
                            </div>

                            <div onClick={() => setActiveTab('archive')} className="bg-gradient-to-br from-rose-500 to-orange-600 p-6 rounded-3xl text-white shadow-lg shadow-rose-500/30 cursor-pointer hover:scale-[1.02] transition-transform flex flex-col justify-between h-40">
                                <div className="flex justify-between items-start">
                                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md"><ArrowUpCircle size={24}/></div>
                                    <div className="text-4xl font-black">{safeTransactions.filter(t=>t.type==='OUT').length}</div>
                                </div>
                                <div>
                                    <div className="text-sm font-black opacity-90">کل خروجی‌ها (بیجک)</div>
                                    <div className="text-[10px] opacity-70 mt-0.5">تعداد کل حواله‌های صادره از انبار</div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity Mini-List */}
                        <div className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-white/10 rounded-3xl p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-black text-gray-800 dark:text-white flex items-center gap-2"><RefreshCw size={18} className="text-blue-500"/> آخرین بیجک‌های خروجی</h4>
                                <button onClick={() => setActiveTab('archive')} className="text-blue-600 text-[10px] font-black hover:underline px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full">مشاهده همه</button>
                            </div>
                            <div className="space-y-3">
                                {recentBijaks.length === 0 ? (
                                    <div className="text-center py-6 text-gray-400 text-xs">فعالیتی ثبت نشده است</div>
                                ) : recentBijaks.map(tx => (
                                    <div key={tx.id} onClick={() => setViewBijak(tx)} className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-black shadow-sm">
                                                {tx.number}
                                            </div>
                                            <div>
                                                <div className="text-xs font-black text-gray-800 dark:text-gray-100">{tx.recipientName}</div>
                                                <div className="text-[10px] font-bold text-gray-400">{tx.company}</div>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <div className="text-[10px] font-black text-gray-400 mb-1">{formatDate(tx.date)}</div>
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${tx.status === 'APPROVED' ? 'bg-green-100 text-green-700' : tx.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {tx.status === 'APPROVED' ? 'تایید شده' : tx.status === 'REJECTED' ? 'رد شده' : 'در انتظار'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                
                {/* ITEMS TAB - Mobile Card View */}
                {activeTab === 'items' && (
                    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-white dark:bg-gray-900/40 p-5 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm mb-6 flex flex-col md:flex-row items-end gap-4">
                            <div className="flex-1 w-full space-y-1.5 flex flex-col">
                                <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1"><Package size={14} className="text-blue-500"/> نام کالا</label>
                                <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-700 focus:border-blue-500 outline-none transition-all font-bold" placeholder="مثلا: میلگرد 12" value={newItemName} onChange={e=>setNewItemName(e.target.value)}/>
                            </div>
                            <div className="flex gap-4 w-full md:w-auto">
                                <div className="flex-1 space-y-1.5 flex flex-col">
                                    <label className="text-xs font-black text-gray-500 mr-2">کد کالا</label>
                                    <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-700 transition-all font-mono font-bold text-center" placeholder="1001" value={newItemCode} onChange={e=>setNewItemCode(e.target.value)}/>
                                </div>
                                <div className="flex-1 space-y-1.5 flex flex-col">
                                    <label className="text-xs font-black text-gray-500 mr-2">واحد</label>
                                    <select className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-gray-50 dark:bg-gray-800 font-bold" value={newItemUnit} onChange={e=>setNewItemUnit(e.target.value)}><option>عدد</option><option>کارتن</option><option>کیلوگرم</option><option>دستگاه</option><option>متر</option></select>
                                </div>
                            </div>
                            <button onClick={handleAddItem} className="bg-blue-600 text-white p-4 rounded-2xl hover:bg-blue-700 h-[58px] w-full md:w-16 flex items-center justify-center font-black shadow-lg shadow-blue-600/20 active:scale-95 transition-transform">
                                {isMobile ? <span className="flex items-center gap-2">افزودن کالا جدید <Plus/></span> : <Plus/>}
                            </button>
                        </div>

                        {isMobile ? (
                            <div className="grid grid-cols-1 gap-4">
                                {items.length === 0 ? (
                                    <div className="text-center text-gray-400 py-20 flex flex-col items-center gap-4">
                                        <Package size={64} className="opacity-10"/>
                                        <p className="font-bold">هنوز کالایی تعریف نشده است</p>
                                    </div>
                                ) : items.map(i => (
                                    <div key={i.id} className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm relative group overflow-hidden">
                                        <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500"></div>
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="text-lg font-black text-gray-800 dark:text-gray-100 leading-tight">{i.name}</div>
                                                <div className="text-[10px] font-mono text-gray-400 font-bold mt-1">کد کالای سیستمی: {i.code || '---'}</div>
                                            </div>
                                            <div className="bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-xl text-xs font-black border border-blue-100 dark:border-white/5">{i.unit}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setEditingItem(i)} className="flex-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 py-3 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1 active:scale-95 transition-transform"><Edit size={16}/> ویرایش</button>
                                            {currentUser.role === UserRole.ADMIN && (
                                                <button onClick={()=>handleDeleteItem(i.id)} className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-3 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1 active:scale-95 transition-transform"><Trash2 size={16}/> حذف</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                             <div className="bg-white dark:bg-gray-900/20 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                                 <table className="w-full text-sm text-right">
                                     <thead className="bg-gray-100 dark:bg-black/40 text-gray-600 dark:text-gray-400"><tr><th className="p-4 pr-8">کد</th><th className="p-4">نام کالا</th><th className="p-4">واحد سنجش</th><th className="p-4 text-center">عملیات مدیریت</th></tr></thead>
                                     <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                         {items.map(i => (
                                            <tr key={i.id} className="border-t hover:bg-gray-50 dark:hover:bg-white/5 transition-all group">
                                                <td className="p-4 pr-8 font-mono font-bold text-gray-400 group-hover:text-gray-600">{i.code || '-'}</td>
                                                <td className="p-4 font-black text-gray-800 dark:text-gray-100">{i.name}</td>
                                                <td className="p-4"><span className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-[10px] font-black text-gray-500">{i.unit}</span></td>
                                                <td className="p-4 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => setEditingItem(i)} className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all"><Edit size={20}/></button>
                                                        <button onClick={()=>handleDeleteItem(i.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><Trash2 size={20}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             </div>
                        )}
                    </div>
                )}

                {/* ENTRY TAB - Mobile Optimized */}
                {activeTab === 'entry' && (
                    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 pb-24">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-3xl border border-emerald-200 dark:border-emerald-800 mb-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100 dark:bg-emerald-800/30 rounded-full -translate-y-12 translate-x-12 blur-2xl"></div>
                            <h3 className="font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-2 relative z-10"><ArrowDownCircle/> ثبت ورود کالا (رسید انبار)</h3>
                            <p className="text-[10px] font-bold text-emerald-600/70 mr-8 relative z-10">ثبت اقلام وارد شده به انبار بر اساس پروفرما یا فاکتور</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1"><Home size={14}/> شرکت مالک</label>
                                <select className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800/80 font-bold outline-none focus:border-emerald-500 transition-all shadow-sm" value={selectedCompany} onChange={e=>setSelectedCompany(e.target.value)}>
                                    <option value="">انتخاب شرکت...</option>
                                    {companyList.map(c=><option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1"><FileText size={14}/> شماره پروفرما / سند</label>
                                <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800/80 font-bold outline-none focus:border-emerald-500 transition-all shadow-sm" placeholder="مثلا: PI-1403-001" value={proformaNumber} onChange={e=>setProformaNumber(e.target.value)}/>
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1"><Calendar size={14}/> تاریخ ورود</label>
                                <div className="flex gap-1.5 dir-ltr">
                                    <select className="border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 flex-1 bg-white dark:bg-gray-800 font-bold" value={txDate.year} onChange={e=>setTxDate({...txDate, year:Number(e.target.value)})}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select>
                                    <select className="border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 flex-1 bg-white dark:bg-gray-800 font-bold" value={txDate.month} onChange={e=>setTxDate({...txDate, month:Number(e.target.value)})}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select>
                                    <select className="border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 flex-1 bg-white dark:bg-gray-800 font-bold" value={txDate.day} onChange={e=>setTxDate({...txDate, day:Number(e.target.value)})}>{days.map(d=><option key={d} value={d}>{d}</option>)}</select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900/40 p-5 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-sm mb-10 overflow-hidden">
                            {/* Barcode and Excel Row */}
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-3xl mb-6 border border-gray-100 dark:border-white/5">
                                <div className="w-full md:w-1/2 flex items-center gap-2">
                                    <Barcode className="text-emerald-600 shrink-0" size={24}/>
                                    <input 
                                        type="text" 
                                        placeholder="اسکن سریع با بارکدخوان..." 
                                        value={barcodeScanInput} 
                                        onChange={e => setBarcodeScanInput(e.target.value)} 
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleBarcodeScan(barcodeScanInput, 'IN');
                                                setBarcodeScanInput('');
                                            }
                                        }}
                                        className="w-full bg-white dark:bg-gray-800 border-2 border-emerald-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button 
                                        type="button"
                                        onClick={handleDownloadTemplateExcel}
                                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/10 px-3 py-2 rounded-xl text-[10px] font-black flex items-center gap-1"
                                    >
                                        <Download size={14}/> دریافت نمونه اکسل
                                    </button>
                                    <label className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/10 px-3 py-2 rounded-xl text-[10px] font-black flex items-center gap-1 cursor-pointer">
                                        <Upload size={14}/> بارگذاری اقلام از اکسل
                                        <input 
                                            type="file" 
                                            accept=".xlsx, .xls" 
                                            className="hidden" 
                                            onChange={e => {
                                                handleImportItemsExcel(e);
                                                e.target.value = '';
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>

                            {barcodeScanFeedback && (
                                <div className={`p-3 rounded-2xl text-center mb-4 text-xs font-black ${barcodeScanFeedback.isError ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                                    {barcodeScanFeedback.message}
                                </div>
                            )}

                            <h4 className="text-xs font-black text-gray-400 mb-6 flex items-center gap-2"><List size={14}/> اقلام رسید</h4>
                            <div className="space-y-6">
                                {txItems.map((row, idx) => (
                                    <div key={idx} className="flex flex-col md:flex-row gap-5 items-end bg-gray-50 dark:bg-gray-800/20 p-5 rounded-[2rem] border border-gray-100 dark:border-white/5 relative group transition-all hover:shadow-md">
                                        <div className="flex-1 w-full space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 mr-2">نام کالا ({idx + 1})</label>
                                            <select className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-sm" value={row.itemId} onChange={e=>updateTxItem(idx, 'itemId', e.target.value)}>
                                                <option value="">انتخاب نوع کالا...</option>
                                                {items.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full md:w-auto">
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[10px] font-black text-gray-400 text-center">تعداد</label>
                                                <input type="number" className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-center dir-ltr" value={row.quantity === 0 ? '' : row.quantity} onFocus={e => e.target.select()} onChange={e=>updateTxItem(idx, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))}/>
                                            </div>
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[10px] font-black text-gray-400 text-center">وزن (KG)</label>
                                                <input type="number" className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-center dir-ltr" value={row.weight === 0 ? '' : row.weight} onFocus={e => e.target.select()} onChange={e=>updateTxItem(idx, 'weight', e.target.value === '' ? 0 : Number(e.target.value))}/>
                                            </div>
                                        </div>
                                        <div className="w-full md:w-44 space-y-1.5 flex flex-col">
                                            <label className="text-[10px] font-black text-gray-400 mr-2">فی واحد (ریال)</label>
                                            <input type="text" className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-blue-600 text-center dir-ltr" value={formatNumberString(row.unitPrice)} onChange={e=>updateTxItem(idx, 'unitPrice', deformatNumberString(e.target.value))}/>
                                        </div>
                                        {idx > 0 && (
                                            <button onClick={()=>handleRemoveTxItemRow(idx)} className="text-red-500 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl w-full md:w-auto flex justify-center hover:bg-red-100 active:scale-90 transition-all">
                                                <Trash2 size={24}/>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={handleAddTxItemRow} className="w-full py-5 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-3xl text-blue-600 font-black text-xs flex items-center justify-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all active:scale-[0.98] group">
                                    <Plus className="group-hover:rotate-90 transition-transform"/> افزودن ردیف کالای جدید
                                </button>
                            </div>
                        </div>
                        
                        <div className={isMobile ? 'fixed bottom-4 left-4 right-4 z-50' : 'flex justify-center'}>
                             <button onClick={()=>handleSubmitTx('IN')} className="w-full md:w-80 bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-600/30 active:scale-95 transition-all hover:bg-emerald-700 flex items-center justify-center gap-2 text-base">
                                <Save size={20}/> ثبت و صدور رسید انبار
                             </button>
                        </div>
                    </div>
                )}
                
                {/* EXIT TAB - Mobile Optimized */}
                {activeTab === 'exit' && (
                    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 pb-32">
                        <div className="bg-rose-50 dark:bg-rose-900/20 p-5 p-md:p-8 rounded-[2.5rem] border border-rose-200 dark:border-rose-800 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 dark:bg-rose-800/30 rounded-full -translate-y-16 translate-x-16 blur-3xl opacity-50"></div>
                             <div className="relative z-10 text-center md:text-right">
                                <h3 className="font-black text-rose-800 dark:text-rose-300 text-xl flex items-center justify-center md:justify-start gap-2 mb-1"><ArrowUpCircle size={28}/> صدور بیجک خروجی</h3>
                                <p className="text-xs font-bold text-rose-600/70 md:mr-9">ثبت حواله خروج کالا و اعلام بار راننده</p>
                            </div>
                            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md px-6 py-3 rounded-3xl shadow-xl border-2 border-white dark:border-white/5 text-center relative z-10 w-full md:w-auto min-w-[140px]">
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">شماره حواله سیستمی</div>
                                <div className="text-3xl font-black text-rose-600 font-mono leading-none flex items-center justify-center gap-3">
                                    {loadingBijakNum ? <Loader2 className="animate-spin" size={24}/> : (nextBijakNum > 0 ? nextBijakNum : '---')}
                                    {!loadingBijakNum && !!selectedCompany && <button type="button" onClick={updateNextBijak} className="text-gray-300 hover:text-blue-500 transition-colors"><RefreshCw size={16}/></button>}
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1"><Home size={14}/> شرکت فرستنده بار</label>
                                <select className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800/80 font-bold outline-none focus:border-rose-500 transition-all shadow-sm" value={selectedCompany} onChange={e => { setSelectedCompany(e.target.value); }}>
                                    <option value="">انتخاب شرکت...</option>
                                    {companyList.map(c=><option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1"><Calendar size={14}/> تاریخ خروج کانتینر / تریلی</label>
                                <div className="flex gap-1.5 dir-ltr font-bold">
                                    <select className="border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 flex-1 bg-white dark:bg-gray-800" value={txDate.year} onChange={e=>setTxDate({...txDate, year:Number(e.target.value)})}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select>
                                    <select className="border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 flex-1 bg-white dark:bg-gray-800" value={txDate.month} onChange={e=>setTxDate({...txDate, month:Number(e.target.value)})}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select>
                                    <select className="border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 flex-1 bg-white dark:bg-gray-800" value={txDate.day} onChange={e=>setTxDate({...txDate, day:Number(e.target.value)})}>{days.map(d=><option key={d} value={d}>{d}</option>)}</select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900/60 p-6 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-xl mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="col-span-2 md:col-span-1 space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 mr-2 uppercase tracking-wide">تحویل گیرنده نهایی</label>
                                <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 text-sm font-bold bg-gray-50 dark:bg-gray-800 focus:bg-white transition-all shadow-inner outline-none focus:border-rose-500" placeholder="نام خریدار یا انبار مقصد" value={recipientName} onChange={e=>setRecipientName(e.target.value)}/>
                            </div>
                            <div className="col-span-1 space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 mr-2 uppercase tracking-wide">نام راننده حامل</label>
                                <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 text-sm font-bold bg-gray-50 dark:bg-gray-800 focus:bg-white transition-all shadow-inner outline-none focus:border-rose-500" placeholder="..." value={driverName} onChange={e=>setDriverName(e.target.value)}/>
                            </div>
                            <div className="col-span-1 space-y-1.5 text-center">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wide">شماره پلاک</label>
                                <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 text-sm font-black bg-gray-50 dark:bg-gray-800 focus:bg-white transition-all shadow-inner outline-none focus:border-rose-500 dir-ltr text-center" placeholder="-- --- --" value={plateNumber} onChange={e=>setPlateNumber(e.target.value)}/>
                            </div>
                            <div className="col-span-2 md:col-span-1 space-y-1.5 flex flex-col">
                                <label className="text-[10px] font-black text-gray-400 mr-2 uppercase tracking-wide flex items-center gap-1"><Navigation size={10}/> مقصد بارگیری</label>
                                <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 text-sm font-bold bg-gray-50 dark:bg-gray-800 focus:bg-white transition-all shadow-inner outline-none focus:border-rose-500" placeholder="شهر یا بندر" value={destination} onChange={e=>setDestination(e.target.value)}/>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900/40 p-5 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-sm mb-12">
                            {/* Barcode and Excel Row */}
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-3xl mb-6 border border-gray-100 dark:border-white/5">
                                <div className="w-full md:w-1/2 flex items-center gap-2">
                                    <Barcode className="text-rose-600 shrink-0" size={24}/>
                                    <input 
                                        type="text" 
                                        placeholder="اسکن سریع با بارکدخوان..." 
                                        value={barcodeScanInput} 
                                        onChange={e => setBarcodeScanInput(e.target.value)} 
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleBarcodeScan(barcodeScanInput, 'OUT');
                                                setBarcodeScanInput('');
                                            }
                                        }}
                                        className="w-full bg-white dark:bg-gray-800 border-2 border-rose-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-rose-500"
                                    />
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button 
                                        type="button"
                                        onClick={handleDownloadTemplateExcel}
                                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/10 px-3 py-2 rounded-xl text-[10px] font-black flex items-center gap-1"
                                    >
                                        <Download size={14}/> دریافت نمونه اکسل
                                    </button>
                                    <label className="bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-900/10 px-3 py-2 rounded-xl text-[10px] font-black flex items-center gap-1 cursor-pointer">
                                        <Upload size={14}/> بارگذاری اقلام از اکسل
                                        <input 
                                            type="file" 
                                            accept=".xlsx, .xls" 
                                            className="hidden" 
                                            onChange={e => {
                                                handleImportItemsExcel(e);
                                                e.target.value = '';
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>

                            {barcodeScanFeedback && (
                                <div className={`p-3 rounded-2xl text-center mb-4 text-xs font-black ${barcodeScanFeedback.isError ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                                    {barcodeScanFeedback.message}
                                </div>
                            )}

                            <h4 className="text-[10px] font-black text-gray-400 mb-5 flex items-center gap-2 uppercase tracking-[0.2em] px-4"><List size={14} className="text-rose-500"/> جزییات اقلام خروج</h4>
                            <div className="space-y-6">
                                {txItems.map((row, idx) => (
                                    <div key={idx} className="flex flex-col md:flex-row gap-5 items-end bg-gray-50 dark:bg-gray-800/20 p-5 rounded-[2rem] border border-gray-100 dark:border-white/5 group transition-all hover:shadow-lg">
                                        <div className="flex-1 w-full space-y-1.5 flex flex-col">
                                            <label className="text-[10px] font-black text-gray-400 mr-2">انتخاب کالا ({idx + 1})</label>
                                            <select className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-sm" value={row.itemId} onChange={e=>updateTxItem(idx, 'itemId', e.target.value)}>
                                                <option value="">جستجوی کالا...</option>
                                                {items.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full md:w-auto">
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[10px] font-black text-gray-400 text-center">تعداد</label>
                                                <input type="number" className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-center dir-ltr" value={row.quantity === 0 ? '' : row.quantity} onFocus={e => e.target.select()} onChange={e=>updateTxItem(idx, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))}/>
                                            </div>
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[10px] font-black text-gray-400 text-center">وزن (KG)</label>
                                                <input type="number" className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-center dir-ltr" value={row.weight === 0 ? '' : row.weight} onFocus={e => e.target.select()} onChange={e=>updateTxItem(idx, 'weight', e.target.value === '' ? 0 : Number(e.target.value))}/>
                                            </div>
                                        </div>
                                        <div className="w-full md:w-44 space-y-1.5 flex flex-col">
                                            <label className="text-[10px] font-black text-gray-400 mr-2 text-center">فی واحد (ریال)</label>
                                            <input type="text" className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-rose-600 text-center dir-ltr" value={formatNumberString(row.unitPrice)} onChange={e=>updateTxItem(idx, 'unitPrice', deformatNumberString(e.target.value))}/>
                                        </div>
                                        {idx > 0 && (
                                            <button onClick={()=>handleRemoveTxItemRow(idx)} className="text-red-500 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl w-full md:w-auto flex justify-center hover:bg-red-100 active:rotate-12 transition-all">
                                                <Trash2 size={24}/>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={handleAddTxItemRow} className="w-full py-5 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-[2rem] text-rose-600 font-black text-xs flex items-center justify-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all active:scale-[0.98]">
                                    <Plus size={18}/> افزودن ردیف کالای اضافه
                                </button>
                            </div>
                        </div>
                        
                        <div className={isMobile ? 'fixed bottom-4 left-4 right-4 z-50' : 'flex justify-center'}>
                             <button onClick={()=>handleSubmitTx('OUT')} className="w-full md:w-96 bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-rose-600/40 active:scale-95 transition-all hover:bg-rose-700 flex items-center justify-center gap-3 text-lg">
                                <Send size={22} className="-rotate-12"/> ثبت نهایی و ارسال جهت تایید بیجک
                             </button>
                        </div>
                    </div>
                )}
                
                {/* --- ARCHIVE TAB (Mobile Optimized) --- */}
                {activeTab === 'archive' && (
                    <div className="space-y-4 animate-fade-in">
                        {/* Search Bar */}
                        <div className="glass-panel p-4 rounded-xl shadow-sm border flex flex-col gap-2">
                             <h3 className="font-bold text-gray-800 flex items-center gap-2"><Archive size={20}/> آرشیو حواله‌های خروج</h3>
                             <div className="flex gap-2">
                                <select className="border rounded-lg p-2 text-sm flex-1" value={archiveFilterCompany} onChange={e => setArchiveFilterCompany(e.target.value)}><option value="">همه شرکت‌ها</option>{companyList.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                <input className="border rounded-lg p-2 text-sm flex-1" placeholder="جستجو..." value={reportSearch} onChange={e => setReportSearch(e.target.value)} />
                            </div>
                        </div>

                        {/* Mobile Cards */}
                        {isMobile ? (
                            <div className="space-y-3">
                                {filteredArchiveBijaks.length === 0 ? <div className="text-center text-gray-400 py-10">موردی یافت نشد</div> : filteredArchiveBijaks.map(tx => (
                                    <div key={tx.id} className="glass-panel border rounded-xl p-4 shadow-sm relative">
                                        <div className="absolute top-4 left-4 text-xs bg-gray-100 px-2 py-1 rounded">{tx.status}</div>
                                        <div className="font-bold text-red-600 mb-1">#{tx.number}</div>
                                        <div className="text-sm font-bold text-gray-800 mb-1">{tx.company}</div>
                                        <div className="text-xs text-gray-600 mb-2">{tx.recipientName}</div>
                                        <div className="text-xs text-gray-400 mb-3">{formatDate(tx.date)}</div>
                                        <div className="flex gap-2 justify-end border-t pt-2">
                                             <button onClick={() => setViewBijak(tx)} className="text-blue-600 p-2 bg-blue-50 rounded-lg"><Eye size={18}/></button>
                                             {(currentUser.role === UserRole.ADMIN || (tx.status === 'PENDING' && currentUser.role === UserRole.WAREHOUSE_KEEPER)) && (
                                                <button onClick={() => setEditingBijak(tx)} className="text-amber-600 p-2 bg-amber-50 rounded-lg"><Edit size={18}/></button>
                                             )}
                                             {currentUser.role === UserRole.ADMIN && <button onClick={() => handleDeleteTx(tx.id)} className="text-red-600 p-2 bg-red-50 rounded-lg"><Trash2 size={18}/></button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="glass-panel rounded-xl border shadow-sm overflow-hidden">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-gray-100 text-gray-600"><tr><th className="p-4">شماره</th><th className="p-4">تاریخ</th><th className="p-4">شرکت</th><th className="p-4">گیرنده</th><th className="p-4">وضعیت</th><th className="p-4 text-center">عملیات</th></tr></thead>
                                    <tbody className="divide-y">
                                        {filteredArchiveBijaks.map(tx => (
                                            <tr key={tx.id} className="hover:bg-gray-50">
                                                <td className="p-4 font-mono font-bold text-red-600">#{tx.number}</td>
                                                <td className="p-4 text-xs">{formatDate(tx.date)}</td>
                                                <td className="p-4 text-xs font-bold">{tx.company}</td>
                                                <td className="p-4 text-xs">{tx.recipientName}</td>
                                                <td className="p-4"><span className={`text-[10px] px-2 py-1 rounded font-bold w-fit ${tx.status === 'APPROVED' ? 'bg-green-100 text-green-700' : tx.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>{tx.status}</span></td>
                                                <td className="p-4 text-center flex justify-center gap-2">
                                                    <button onClick={() => setViewBijak(tx)} className="text-blue-600 hover:text-blue-800 p-1"><Eye size={16}/></button>
                                                    {(currentUser.role === UserRole.ADMIN || (tx.status === 'PENDING' && currentUser.role === UserRole.WAREHOUSE_KEEPER)) && <button onClick={() => setEditingBijak(tx)} className="text-amber-600 hover:text-amber-800 p-1"><Edit size={16}/></button>}
                                                    {(currentUser.role === UserRole.ADMIN) && <button onClick={() => handleDeleteTx(tx.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 size={16}/></button>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ENTRY ARCHIVE TAB */}
                {activeTab === 'entry_archive' && (
                    <div className="space-y-4 animate-fade-in">
                        {/* Search Bar */}
                        <div className="glass-panel p-4 rounded-xl shadow-sm border flex flex-col gap-2">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><ArrowDownCircle size={20} className="text-green-600"/> آرشیو رسیدهای ورود</h3>
                                <div className="flex gap-2">
                                <select className="border rounded-lg p-2 text-sm flex-1" value={archiveFilterCompany} onChange={e => setArchiveFilterCompany(e.target.value)}><option value="">همه شرکت‌ها</option>{companyList.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                <input className="border rounded-lg p-2 text-sm flex-1" placeholder="جستجو (پروفرما)..." value={reportSearch} onChange={e => setReportSearch(e.target.value)} />
                            </div>
                        </div>

                        {/* List */}
                        {isMobile ? (
                            <div className="space-y-3">
                                {filteredArchiveReceipts.length === 0 ? <div className="text-center text-gray-400 py-10">موردی یافت نشد</div> : filteredArchiveReceipts.map(tx => (
                                    <div key={tx.id} className="glass-panel border rounded-xl p-4 shadow-sm relative">
                                        <div className="font-bold text-green-600 mb-1">پروفرما: {tx.proformaNumber}</div>
                                        <div className="text-sm font-bold text-gray-800 mb-1">{tx.company}</div>
                                        <div className="text-xs text-gray-400 mb-3">{formatDate(tx.date)}</div>
                                        <div className="flex gap-2 justify-end border-t pt-2">
                                                <button onClick={() => setEditingReceipt(tx)} className="text-amber-600 p-2 bg-amber-50 rounded-lg"><Edit size={18}/></button>
                                                {currentUser.role === UserRole.ADMIN && <button onClick={() => handleDeleteTx(tx.id)} className="text-red-600 p-2 bg-red-50 rounded-lg"><Trash2 size={18}/></button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="glass-panel rounded-xl border shadow-sm overflow-hidden">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-gray-100 text-gray-600"><tr><th className="p-4">پروفرما</th><th className="p-4">تاریخ</th><th className="p-4">شرکت</th><th className="p-4 text-center">عملیات</th></tr></thead>
                                    <tbody className="divide-y">
                                        {filteredArchiveReceipts.map(tx => (
                                            <tr key={tx.id} className="hover:bg-gray-50">
                                                <td className="p-4 font-mono font-bold text-green-600">{tx.proformaNumber}</td>
                                                <td className="p-4 text-xs">{formatDate(tx.date)}</td>
                                                <td className="p-4 text-xs font-bold">{tx.company}</td>
                                                <td className="p-4 text-center flex justify-center gap-2">
                                                    <button onClick={() => setEditingReceipt(tx)} className="text-amber-600 hover:text-amber-800 p-1"><Edit size={16}/></button>
                                                    {(currentUser.role === UserRole.ADMIN) && <button onClick={() => handleDeleteTx(tx.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 size={16}/></button>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* REPORTS TAB (KARDEX) */}
                {activeTab === 'reports' && (
                    <div className="glass-panel p-4 rounded-xl shadow-sm border h-full">
                        <WarehouseKardexReport 
                            items={items} 
                            transactions={safeTransactions} 
                            allTransactions={allTransactions}
                            companies={companyList} 
                            financialYear={financialYear}
                        />
                    </div>
                )}

                {/* STOCKTAKE TAB */}
                {activeTab === 'stocktake' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-20 max-w-6xl mx-auto">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-3xl border border-indigo-200 dark:border-indigo-800 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-100 dark:bg-indigo-800/30 rounded-full -translate-y-12 translate-x-12 blur-2xl"></div>
                            <div>
                                <h3 className="font-black text-indigo-800 dark:text-indigo-300 flex items-center gap-2 relative z-10"><Barcode size={24}/> انبارگردانی اصولی با بارکدخوان</h3>
                                <p className="text-xs font-bold text-indigo-600/70 mr-8 relative z-10">مقایسه موجودی شمارش شده انبار با موجودی سیستمی و صدور اسناد اصلاحی خودکار</p>
                            </div>
                            <div className="flex gap-2 relative z-10 w-full sm:w-auto">
                                <select 
                                    className="border-2 border-indigo-200 dark:border-indigo-800 rounded-xl p-2.5 bg-white dark:bg-gray-800 font-bold text-xs"
                                    value={stocktakeCompany}
                                    onChange={e => {
                                        setStocktakeCompany(e.target.value);
                                        setStocktakeCounted({});
                                    }}
                                >
                                    <option value="">انتخاب شرکت برای انبارگردانی...</option>
                                    {companyList.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        {stocktakeCompany ? (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Scanning and Controls Column */}
                                <div className="lg:col-span-1 space-y-6">
                                    <div className="bg-white dark:bg-gray-900/40 p-5 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-sm">
                                        <h4 className="text-xs font-black text-indigo-600 mb-4 flex items-center gap-1.5"><Barcode size={18}/> اسکن بارکد کالاها</h4>
                                        <div className="space-y-4">
                                            <div className="relative">
                                                <input 
                                                    type="text"
                                                    placeholder="بارکد کالا را اسکن کنید..."
                                                    value={stocktakeScanCode}
                                                    onChange={e => setStocktakeScanCode(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleStocktakeBarcodeScan(stocktakeScanCode);
                                                            setStocktakeScanCode('');
                                                        }
                                                    }}
                                                    className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-indigo-100 rounded-2xl p-4 text-xs font-black outline-none focus:border-indigo-500 pl-10"
                                                    autoFocus
                                                />
                                                <div className="absolute left-3 top-3.5 text-gray-400">
                                                    <Barcode size={20}/>
                                                </div>
                                            </div>

                                            {stocktakeFeedback && (
                                                <div className={`p-3 rounded-xl text-center text-[11px] font-black ${stocktakeFeedback.isError ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                                                    {stocktakeFeedback.message}
                                                </div>
                                            )}

                                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-dashed border-indigo-100 dark:border-indigo-900">
                                                <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 leading-relaxed">
                                                    💡 برای انبارگردانی سریع، بارکدخوان خود را روی حالت Enter قرار دهید. با هر بار اسکن، یک واحد به تعداد شمارش شده کالا اضافه خواهد شد.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-gray-900/40 p-5 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-sm space-y-3">
                                        <h4 className="text-xs font-black text-gray-700 dark:text-gray-300 mb-2">عملیات گروهی انبارگردانی</h4>
                                        
                                        <label className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl text-xs font-black text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2 cursor-pointer transition-colors">
                                            <Upload size={16}/> بارگذاری شمارش اکسل
                                            <input 
                                                type="file" 
                                                accept=".xlsx, .xls" 
                                                className="hidden" 
                                                onChange={e => {
                                                    handleImportStocktakeExcel(e);
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>

                                        <button 
                                            onClick={handleExportStocktakeExcel}
                                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/10"
                                        >
                                            <FileSpreadsheet size={16}/> خروجی مغایرت اکسل
                                        </button>

                                        <button 
                                            onClick={handleApplyStocktake}
                                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-600/20"
                                        >
                                            <CheckCircle size={16}/> ثبت نهایی و اعمال تعدیلات
                                        </button>

                                        <button 
                                            onClick={() => {
                                                if (confirm('آیا مایل به ریست کردن تمام تعداد شمارش شده هستید؟')) {
                                                    setStocktakeCounted({});
                                                }
                                            }}
                                            className="w-full py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                                        >
                                            <Trash2 size={14}/> ریست شمارش‌ها
                                        </button>
                                    </div>
                                </div>

                                {/* Right Comparison Grid Column */}
                                <div className="lg:col-span-2 space-y-4">
                                    <div className="bg-white dark:bg-gray-900/40 p-5 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-sm h-full flex flex-col">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                            <h4 className="text-sm font-black text-gray-800 dark:text-white flex items-center gap-1.5"><List size={18}/> جدول مقایسه و مغایرت‌گیری</h4>
                                            <input 
                                                type="text"
                                                placeholder="جستجو در اقلام..."
                                                value={stocktakeSearch}
                                                onChange={e => setStocktakeSearch(e.target.value)}
                                                className="bg-gray-50 dark:bg-gray-800 border rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
                                            />
                                        </div>

                                        <div className="overflow-x-auto flex-1 max-h-[500px] overflow-y-auto">
                                            <table className="w-full text-xs text-center">
                                                <thead className="bg-gray-100 dark:bg-black/30 text-gray-600 dark:text-gray-400 sticky top-0 z-10">
                                                    <tr>
                                                        <th className="p-3 text-right">کد / نام کالا</th>
                                                        <th className="p-3">سیستم</th>
                                                        <th className="p-3">شمارش دستی</th>
                                                        <th className="p-3">مغایرت</th>
                                                        <th className="p-3">وضعیت</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                    {items
                                                        .filter(i => !stocktakeSearch || i.name.includes(stocktakeSearch) || (i.code && i.code.includes(stocktakeSearch)))
                                                        .map(i => {
                                                            const systemQty = getSystemStockForCompany(stocktakeCompany, i.id);
                                                            const countedQty = stocktakeCounted[i.id] || 0;
                                                            const diff = countedQty - systemQty;

                                                            return (
                                                                <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                                                    <td className="p-3 text-right">
                                                                        <div className="font-black text-gray-800 dark:text-gray-200 text-xs">{i.name}</div>
                                                                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{i.code || 'فاقد کد'} • {i.unit}</div>
                                                                    </td>
                                                                    <td className="p-3 font-mono font-black text-blue-600 text-sm">
                                                                        {formatNumberString(systemQty)}
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <input 
                                                                            type="number" 
                                                                            value={countedQty || ''}
                                                                            placeholder="0"
                                                                            onChange={e => {
                                                                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                                                                setStocktakeCounted(prev => ({ ...prev, [i.id]: val }));
                                                                            }}
                                                                            className="w-20 border rounded-lg px-2 py-1 text-center font-mono font-black bg-white dark:bg-gray-800"
                                                                        />
                                                                    </td>
                                                                    <td className={`p-3 font-mono font-black text-sm ${diff === 0 ? 'text-gray-500' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                        {diff > 0 ? `+${formatNumberString(diff)}` : formatNumberString(diff)}
                                                                    </td>
                                                                    <td className="p-3">
                                                                        {diff === 0 ? (
                                                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded-md font-bold text-[10px]">منطبق</span>
                                                                        ) : diff > 0 ? (
                                                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-md font-bold text-[10px]">سرک ({formatNumberString(diff)})</span>
                                                                        ) : (
                                                                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 rounded-md font-bold text-[10px]">کسری ({formatNumberString(Math.abs(diff))})</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-900/40 p-12 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-sm text-center">
                                <Barcode className="mx-auto text-gray-300 dark:text-gray-600 mb-4 animate-pulse" size={48}/>
                                <h4 className="font-black text-gray-700 dark:text-gray-300 mb-2">شروع فرایند انبارگردانی</h4>
                                <p className="text-xs text-gray-400 max-w-md mx-auto mb-6">برای مقایسه موجودی واقعی انبار با موجودی ثبت شده در سیستم، ابتدا شرکت فرستنده یا مالک کالا را از منوی بالا انتخاب کنید.</p>
                                <div className="inline-block">
                                    <select 
                                        className="border-2 border-indigo-100 rounded-2xl p-4 bg-white dark:bg-gray-800 font-bold text-sm"
                                        value={stocktakeCompany}
                                        onChange={e => setStocktakeCompany(e.target.value)}
                                    >
                                        <option value="">انتخاب شرکت...</option>
                                        {companyList.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* DISPATCH REPORT TAB */}
                {activeTab === 'dispatch_report' && (
                    <div className="glass-panel p-4 rounded-xl shadow-sm border h-full">
                        <WarehouseDispatchReport transactions={safeTransactions} companies={companyList} />
                    </div>
                )}

                {/* STOCK REPORT TAB */}
                {activeTab === 'stock_report' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 pb-20">
                        <div className="glass-panel p-4 md:p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-orange-100 p-2 rounded-xl"><BarChart3 size={24} className="text-orange-600"/></div>
                                <div>
                                    <h3 className="font-black text-gray-800 dark:text-white">موجودی لحظه‌ای انبار</h3>
                                    <p className="text-[10px] font-bold text-gray-400">آخرین برآورد کلی موجودی تمام انبارها</p>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <button onClick={handlePrintStock} className="flex-1 md:flex-none justify-center bg-blue-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-xs font-black shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">
                                    <Printer size={16}/> چاپ گزارش
                                </button>
                                <button onClick={handleExportExcel} className="flex-1 md:flex-none justify-center bg-green-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-xs font-black shadow-lg shadow-green-600/20 hover:bg-green-700 transition-all">
                                    <FileSpreadsheet size={16}/> خروجی اکسل
                                </button>
                            </div>
                        </div>
                        
                        {isMobile ? (
                            <div className="grid grid-cols-1 gap-6">
                                {allWarehousesStock.map(group => (
                                    <div key={group.company} className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-b border-gray-200 dark:border-white/5 flex justify-between items-center">
                                            <h4 className="font-black text-gray-800 dark:text-white">{group.company}</h4>
                                            <div className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">{group.items.length} قلم کالا</div>
                                        </div>
                                        <div className="divide-y divide-gray-100 dark:divide-white/5">
                                            {group.items.map(item => (
                                                <div key={item.id} className="p-4 flex justify-between items-center bg-white dark:bg-transparent">
                                                    <div className="space-y-1">
                                                        <div className="text-sm font-black text-gray-800 dark:text-gray-100">{item.name}</div>
                                                        <div className="text-[10px] text-gray-400 font-bold bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-md inline-block">کد: {items.find(i=>i.id===item.id)?.code || '---'}</div>
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-base font-black text-blue-600 font-mono">{formatNumberString(item.quantity)} <span className="text-[10px] font-bold text-gray-400">{items.find(i=>i.id===item.id)?.unit}</span></div>
                                                        <div className="text-[11px] font-bold text-gray-500 font-mono">{formatNumberString(item.weight)} <span className="text-[9px] opacity-70">KG</span></div>
                                                        {item.containerCount > 0 && (
                                                            <div className="text-[10px] font-black text-orange-600 mt-1 py-0.5 px-1.5 bg-orange-50 dark:bg-orange-900/20 rounded inline-block">
                                                                📦 {item.containerCount.toFixed(1)} کانتینر
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-900/20 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-center">
                                        <thead className="bg-gray-800 dark:bg-black/40 text-white">
                                            <tr>
                                                <th className="p-4 text-right pr-10">شرکت / نام کالا</th>
                                                <th className="p-4">موجودی تعدادی</th>
                                                <th className="p-4">موجودی وزنی (KG)</th>
                                                <th className="p-4">تخمین کانتینر</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allWarehousesStock.map((group) => (
                                                <React.Fragment key={group.company}>
                                                    <tr className="bg-blue-50 dark:bg-blue-900/10 font-black text-blue-900 dark:text-blue-300">
                                                        <td colSpan={4} className="p-3 text-right pr-4 border-t border-blue-100 dark:border-white/5 flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                                                            {group.company}
                                                        </td>
                                                    </tr>
                                                    {group.items.map(item => (
                                                        <tr key={item.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                            <td className="p-3 text-right pr-10 font-bold text-gray-700 dark:text-gray-300">{item.name}</td>
                                                            <td className="p-3 font-mono font-black text-blue-600 text-lg">{formatNumberString(item.quantity)}</td>
                                                            <td className="p-3 font-mono font-bold text-gray-600 dark:text-gray-400">{formatNumberString(item.weight)}</td>
                                                            <td className="p-3 font-mono text-orange-600 font-black">{item.containerCount > 0 ? item.containerCount.toFixed(2) : '-'}</td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
            
            {viewBijak && (
                <PrintBijak 
                    tx={viewBijak} 
                    onClose={() => setViewBijak(null)} 
                    settings={settings}
                    transactions={safeTransactions}
                    onApprove={canApprove && viewBijak.status === 'PENDING' ? () => handleApproveBijak(viewBijak) : undefined}
                    onReject={canApprove && viewBijak.status === 'PENDING' ? () => handleRejectBijak(viewBijak) : undefined} 
                />
            )}

            {/* Edit Modals */}
            {editingBijak && (
                <TransactionEditModal 
                    tx={editingBijak} 
                    onClose={() => setEditingBijak(null)} 
                    onSave={handleEditBijakSave} 
                    items={items} 
                />
            )}
            
            {editingReceipt && (
                <TransactionEditModal 
                    tx={editingReceipt} 
                    onClose={() => setEditingReceipt(null)} 
                    onSave={handleEditReceiptSave} 
                    items={items} 
                />
            )}

            {/* Subtab Back Trigger for Mobile Back gesture */}
            {activeTab !== 'dashboard' && (
                <button 
                    data-subtab-back="true" 
                    onClick={() => setActiveTab('dashboard')} 
                    className="hidden"
                />
            )}
        </div>
    );
};

export default WarehouseModule;
