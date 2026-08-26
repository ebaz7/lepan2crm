import React, { useState, useMemo } from 'react';
import { WarehouseItem, WarehouseTransaction, User } from '../types';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatNumberString } from '../constants';
import { saveWarehouseTransaction, updateWarehouseTransaction, deleteWarehouseTransaction } from '../services/storageService';
import { 
    SlidersHorizontal, 
    X, 
    Building2, 
    Package, 
    Scale, 
    Calendar, 
    CheckCircle2, 
    AlertTriangle, 
    History, 
    Trash2, 
    Sparkles, 
    FileText, 
    RotateCcw,
    Zap,
    Search,
    ArrowUpCircle,
    ArrowDownCircle,
    Info,
    Edit3
} from 'lucide-react';

interface SingleItemAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: WarehouseItem[];
    companies: string[];
    defaultCompany?: string;
    defaultItemId?: string;
    currentUser: User;
    allTransactions: WarehouseTransaction[];
    onSuccess: () => void;
}

interface AdjustmentRecord {
    id: string;
    adjustmentId?: string;
    type: 'IN' | 'OUT';
    date: string;
    company: string;
    itemId: string;
    itemName: string;
    quantity: number;
    weight: number;
    description: string;
    createdBy: string;
    createdAt: number;
}

export const SingleItemAdjustmentModal: React.FC<SingleItemAdjustmentModalProps> = ({
    isOpen,
    onClose,
    items,
    companies,
    defaultCompany,
    defaultItemId,
    currentUser,
    allTransactions,
    onSuccess
}) => {
    const currentShamsi = getCurrentShamsiDate();
    const [activeTab, setActiveTab] = useState<'adjust_form' | 'history'>('adjust_form');

    const [selectedCompany, setSelectedCompany] = useState<string>(defaultCompany || (companies.length > 0 ? companies[0] : ''));
    const [selectedItemId, setSelectedItemId] = useState<string>(defaultItemId || '');
    const [itemSearch, setItemSearch] = useState<string>('');
    const [historySearch, setHistorySearch] = useState<string>('');

    // Target values (what the user wants the final stock to be)
    const [targetQty, setTargetQty] = useState<string>('');
    const [targetWeight, setTargetWeight] = useState<string>('');
    const [reason, setReason] = useState<string>('اصلاح مانده وزن/کارتن در انبارگردانی');
    const [adjustDate, setAdjustDate] = useState({
        year: currentShamsi.year,
        month: currentShamsi.month,
        day: currentShamsi.day
    });

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Calculate real-time signed stock for the selected item in the selected company
    const currentStock = useMemo(() => {
        if (!selectedCompany || !selectedItemId) return { quantity: 0, weight: 0 };
        let quantity = 0;
        let weight = 0;
        allTransactions
            .filter(tx => tx.company === selectedCompany && tx.status !== 'REJECTED')
            .forEach(tx => {
                tx.items.forEach(txItem => {
                    if (txItem.itemId === selectedItemId) {
                        const q = Number(txItem.quantity) || 0;
                        const w = Number(txItem.weight) || 0;
                        if (tx.type === 'IN') {
                            quantity += q;
                            weight += w;
                        } else {
                            quantity -= q;
                            weight -= w;
                        }
                    }
                });
            });
        quantity = Math.round((quantity + Number.EPSILON) * 1000) / 1000;
        weight = Math.round((weight + Number.EPSILON) * 1000) / 1000;
        if (Math.abs(quantity) < 0.0001) quantity = 0;
        if (Math.abs(weight) < 0.0001) weight = 0;
        return { quantity, weight };
    }, [selectedCompany, selectedItemId, allTransactions]);

    const selectedItem = useMemo(() => items.find(i => i.id === selectedItemId), [items, selectedItemId]);

    // When item changes, initialize target inputs to current stock so user sees exact starting point
    const handleSelectItem = (itemId: string) => {
        setSelectedItemId(itemId);
        setErrorMsg(null);
        setSuccessMsg(null);
        if (!itemId) {
            setTargetQty('');
            setTargetWeight('');
            return;
        }
        // Calculate stock for this newly chosen item
        let q = 0;
        let w = 0;
        allTransactions
            .filter(tx => tx.company === selectedCompany && tx.status !== 'REJECTED')
            .forEach(tx => {
                tx.items.forEach(txItem => {
                    if (txItem.itemId === itemId) {
                        const tq = Number(txItem.quantity) || 0;
                        const tw = Number(txItem.weight) || 0;
                        if (tx.type === 'IN') { q += tq; w += tw; }
                        else { q -= tq; w -= tw; }
                    }
                });
            });
        q = Math.round((q + Number.EPSILON) * 1000) / 1000;
        w = Math.round((w + Number.EPSILON) * 1000) / 1000;
        if (Math.abs(q) < 0.0001) q = 0;
        if (Math.abs(w) < 0.0001) w = 0;
        setTargetQty(q.toString());
        setTargetWeight(w.toString());
    };

    // Parse numeric inputs
    const parsedTargetQty = targetQty === '' ? currentStock.quantity : (parseFloat(targetQty) || 0);
    const parsedTargetWeight = targetWeight === '' ? currentStock.weight : (parseFloat(targetWeight) || 0);

    // Difference between target and current: (Target - Current)
    const diffQty = Math.round((parsedTargetQty - currentStock.quantity + Number.EPSILON) * 1000) / 1000;
    const diffWeight = Math.round((parsedTargetWeight - currentStock.weight + Number.EPSILON) * 1000) / 1000;

    const hasChanges = (Math.abs(diffQty) >= 0.0001 || Math.abs(diffWeight) >= 0.0001);

    // History of all direct adjustments
    const adjustmentHistory = useMemo(() => {
        const list: AdjustmentRecord[] = [];
        allTransactions.forEach(tx => {
            if (
                tx.isAdjustment || 
                (tx.number === 0 && !tx.isTransfer && (
                    (tx.proformaNumber && tx.proformaNumber.includes('تعدیل')) ||
                    (tx.destination && tx.destination.includes('تعدیل')) ||
                    (tx.description && (tx.description.includes('تعدیل') || tx.description.includes('اصلاح مانده')))
                ))
            ) {
                tx.items.forEach(it => {
                    list.push({
                        id: tx.id,
                        adjustmentId: tx.adjustmentId,
                        type: tx.type,
                        date: tx.date,
                        company: tx.company,
                        itemId: it.itemId,
                        itemName: it.itemName || items.find(x => x.id === it.itemId)?.name || 'کالای نامشخص',
                        quantity: it.quantity || 0,
                        weight: it.weight || 0,
                        description: tx.description || tx.proformaNumber || tx.destination || 'تعدیل انبارگردانی',
                        createdBy: tx.createdBy || 'کاربر سیستم',
                        createdAt: tx.createdAt
                    });
                });
            }
        });
        return list.sort((a, b) => b.createdAt - a.createdAt);
    }, [allTransactions, items]);

    const filteredHistory = useMemo(() => {
        if (!historySearch.trim()) return adjustmentHistory;
        const q = historySearch.toLowerCase();
        return adjustmentHistory.filter(h => 
            h.company.toLowerCase().includes(q) ||
            h.itemName.toLowerCase().includes(q) ||
            h.description.toLowerCase().includes(q) ||
            h.createdBy.toLowerCase().includes(q)
        );
    }, [adjustmentHistory, historySearch]);

    // Quick Zero Out Handlers
    const handleZeroBoth = () => {
        setTargetQty('0');
        setTargetWeight('0');
        setReason('صفر کردن کامل مانده کارتن و وزن در انبارگردانی');
    };

    const handleZeroWeightOnly = () => {
        setTargetQty(currentStock.quantity.toString());
        setTargetWeight('0');
        setReason('اصلاح و صفر کردن مانده وزن در انبارگردانی (تعداد کارتن بدون تغییر)');
    };

    const handleResetToCurrent = () => {
        setTargetQty(currentStock.quantity.toString());
        setTargetWeight(currentStock.weight.toString());
    };

    const handleDeleteAdjustment = async (adj: AdjustmentRecord) => {
        const confirmMsg = `آیا از حذف این سند تعدیل مطمئن هستید؟\n\n` +
            `• شرکت: ${adj.company}\n` +
            `• کالا: ${adj.itemName}\n` +
            `• نوع تعدیل: ${adj.type === 'IN' ? 'افزایش (سرک)' : 'کاهش (کسری)'}\n` +
            `• مقدار: ${formatNumberString(adj.quantity)} کارتن (${formatNumberString(adj.weight)} کیلوگرم)\n\n` +
            `⚠️ با حذف این سند، اثر آن از موجودی کالا برداشته می‌شود.`;

        if (!window.confirm(confirmMsg)) return;

        setIsSubmitting(true);
        setErrorMsg(null);

        try {
            await deleteWarehouseTransaction(adj.id);
            setSuccessMsg('سند تعدیل با موفقیت حذف شد و موجودی به حالت قبل بازگشت.');
            onSuccess();
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err: any) {
            console.error("Error deleting adjustment:", err);
            setErrorMsg(err.message || 'خطا در حذف سند تعدیل.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitAdjustment = async () => {
        setErrorMsg(null);
        setSuccessMsg(null);

        if (!selectedCompany) {
            setErrorMsg('لطفاً شرکت مربوطه را انتخاب کنید.');
            return;
        }

        if (!selectedItemId || !selectedItem) {
            setErrorMsg('لطفاً کالای مورد نظر را انتخاب نمایید.');
            return;
        }

        if (!hasChanges) {
            setErrorMsg('هیچ تغییری در تعداد کارتن یا وزن نسبت به موجودی فعلی وارد نشده است.');
            return;
        }

        setIsSubmitting(true);

        try {
            const txDateIso = (() => {
                try {
                    const d = jalaliToGregorian(adjustDate.year, adjustDate.month, adjustDate.day);
                    d.setHours(12, 0, 0, 0);
                    return d.toISOString();
                } catch {
                    const d = new Date();
                    d.setHours(12, 0, 0, 0);
                    return d.toISOString();
                }
            })();

            const now = Date.now();
            const adjustmentGroupId = `ADJ-${generateUUID()}`;
            const note = reason.trim() || 'تعدیل مستقیم موجودی/وزن در انبارگردانی';

            // Case 1: Both adjustments are increases (or one is 0 and other is > 0)
            if (diffQty >= 0 && diffWeight >= 0) {
                const txIn: WarehouseTransaction = {
                    id: generateUUID(),
                    type: 'IN',
                    date: txDateIso,
                    company: selectedCompany,
                    number: 0, // No Bijak number consumed!
                    items: [{
                        itemId: selectedItem.id,
                        itemName: selectedItem.name,
                        quantity: diffQty,
                        weight: diffWeight,
                        unitPrice: 0
                    }],
                    createdAt: now,
                    createdBy: currentUser.fullName,
                    proformaNumber: 'تعدیل مستقیم انبارگردانی (سرک)',
                    description: `${note} [تغییر کارتن: +${diffQty} | تغییر وزن: +${diffWeight} KG]`,
                    status: 'APPROVED',
                    isAdjustment: true,
                    adjustmentId: adjustmentGroupId
                };
                await saveWarehouseTransaction(txIn);
            } 
            // Case 2: Both adjustments are decreases (or one is 0 and other is < 0)
            else if (diffQty <= 0 && diffWeight <= 0) {
                const txOut: WarehouseTransaction = {
                    id: generateUUID(),
                    type: 'OUT',
                    date: txDateIso,
                    company: selectedCompany,
                    number: 0, // No Bijak number consumed!
                    items: [{
                        itemId: selectedItem.id,
                        itemName: selectedItem.name,
                        quantity: Math.abs(diffQty),
                        weight: Math.abs(diffWeight),
                        unitPrice: 0
                    }],
                    createdAt: now,
                    createdBy: currentUser.fullName,
                    destination: 'تعدیل مستقیم انبارگردانی (کسری)',
                    description: `${note} [تغییر کارتن: ${diffQty} | تغییر وزن: ${diffWeight} KG]`,
                    status: 'APPROVED',
                    approvedBy: currentUser.fullName,
                    isAdjustment: true,
                    adjustmentId: adjustmentGroupId
                };
                await saveWarehouseTransaction(txOut);
            } 
            // Case 3: One is increase and one is decrease (mixed delta)
            else {
                // Positive part => IN
                const posQty = diffQty > 0 ? diffQty : 0;
                const posWeight = diffWeight > 0 ? diffWeight : 0;
                if (posQty > 0 || posWeight > 0) {
                    const txIn: WarehouseTransaction = {
                        id: generateUUID(),
                        type: 'IN',
                        date: txDateIso,
                        company: selectedCompany,
                        number: 0,
                        items: [{
                            itemId: selectedItem.id,
                            itemName: selectedItem.name,
                            quantity: posQty,
                            weight: posWeight,
                            unitPrice: 0
                        }],
                        createdAt: now,
                        createdBy: currentUser.fullName,
                        proformaNumber: 'تعدیل مستقیم انبارگردانی (سرک)',
                        description: `${note} (افزایش کارتن/وزن)`,
                        status: 'APPROVED',
                        isAdjustment: true,
                        adjustmentId: adjustmentGroupId
                    };
                    await saveWarehouseTransaction(txIn);
                }

                // Negative part => OUT
                const negQty = diffQty < 0 ? Math.abs(diffQty) : 0;
                const negWeight = diffWeight < 0 ? Math.abs(diffWeight) : 0;
                if (negQty > 0 || negWeight > 0) {
                    const txOut: WarehouseTransaction = {
                        id: generateUUID(),
                        type: 'OUT',
                        date: txDateIso,
                        company: selectedCompany,
                        number: 0,
                        items: [{
                            itemId: selectedItem.id,
                            itemName: selectedItem.name,
                            quantity: negQty,
                            weight: negWeight,
                            unitPrice: 0
                        }],
                        createdAt: now + 20,
                        createdBy: currentUser.fullName,
                        destination: 'تعدیل مستقیم انبارگردانی (کسری)',
                        description: `${note} (کاهش کارتن/وزن)`,
                        status: 'APPROVED',
                        approvedBy: currentUser.fullName,
                        isAdjustment: true,
                        adjustmentId: adjustmentGroupId
                    };
                    await saveWarehouseTransaction(txOut);
                }
            }

            setSuccessMsg(`تعدیل موجودی کالا "${selectedItem.name}" برای شرکت "${selectedCompany}" بدون استفاده از شماره بیجک با موفقیت ثبت شد.`);
            onSuccess();
            setTimeout(() => {
                setSuccessMsg(null);
            }, 3500);
        } catch (err: any) {
            console.error("Adjustment error:", err);
            setErrorMsg(err.message || 'خطا در ثبت سند تعدیل.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredItems = items.filter(i => 
        !itemSearch || 
        i.name.toLowerCase().includes(itemSearch.toLowerCase()) || 
        (i.code && i.code.toLowerCase().includes(itemSearch.toLowerCase()))
    );

    const years = [1402, 1403, 1404, 1405, 1406];
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/65 backdrop-blur-sm animate-fade-in overflow-y-auto" dir="rtl">
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-2xl w-full max-w-3xl overflow-hidden my-4">
                
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-800 p-5 md:p-6 text-white flex justify-between items-center relative">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                            <SlidersHorizontal className="text-purple-200" size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black tracking-tight">اصلاح مستقیم کارتن و وزن تک کالا</h3>
                                <span className="text-[10px] bg-amber-400/20 text-amber-200 border border-amber-400/40 px-2 py-0.5 rounded-full font-bold">
                                    بدون مصرف شماره بیجک
                                </span>
                            </div>
                            <p className="text-xs text-purple-200/80 mt-0.5 font-medium">اصلاح مانده وزن، کارتن یا صفر کردن مستقیم بدون تداخل در شماره‌های رسمی</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Subtabs Bar */}
                <div className="bg-gray-100 dark:bg-gray-800/80 px-6 py-2.5 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('adjust_form')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                activeTab === 'adjust_form'
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            <SlidersHorizontal size={15} />
                            <span>فرم اصلاح و تعدیل</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('history')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                activeTab === 'history'
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            <History size={15} />
                            <span>تاریخچه تعدیل‌ها ({adjustmentHistory.length})</span>
                        </button>
                    </div>

                    <div className="text-[11px] text-gray-500 font-bold hidden sm:block">
                        تعدیل مستقیم انبارگردانی
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-5 md:p-6 space-y-5 max-h-[72vh] overflow-y-auto">
                    {/* Feedback Messages */}
                    {errorMsg && (
                        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-2xl flex items-center gap-2.5 text-red-600 dark:text-red-400 text-xs font-bold animate-shake">
                            <AlertTriangle size={17} className="shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}
                    {successMsg && (
                        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                            <CheckCircle2 size={17} className="shrink-0" />
                            <span>{successMsg}</span>
                        </div>
                    )}

                    {/* TAB 1: ADJUSTMENT FORM */}
                    {activeTab === 'adjust_form' && (
                        <div className="space-y-5">
                            {/* Step 1: Select Company & Item */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Company */}
                                <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200/70 dark:border-white/5 space-y-2">
                                    <label className="text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <Building2 size={16} className="text-purple-600" />
                                        <span>شرکت / انبار مربوطه:</span>
                                    </label>
                                    <select 
                                        value={selectedCompany} 
                                        onChange={e => {
                                            setSelectedCompany(e.target.value);
                                            setErrorMsg(null);
                                        }}
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="">-- انتخاب شرکت --</option>
                                        {companies.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                {/* Date */}
                                <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200/70 dark:border-white/5 space-y-2">
                                    <label className="text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <Calendar size={16} className="text-purple-600" />
                                        <span>تاریخ سند اصلاحی:</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <select 
                                            className="border border-gray-300 dark:border-gray-700 rounded-xl p-2 flex-1 bg-white dark:bg-gray-800 text-xs font-bold"
                                            value={adjustDate.year} 
                                            onChange={e => setAdjustDate({ ...adjustDate, year: Number(e.target.value) })}
                                        >
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                        <select 
                                            className="border border-gray-300 dark:border-gray-700 rounded-xl p-2 flex-1 bg-white dark:bg-gray-800 text-xs font-bold"
                                            value={adjustDate.month} 
                                            onChange={e => setAdjustDate({ ...adjustDate, month: Number(e.target.value) })}
                                        >
                                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                        <select 
                                            className="border border-gray-300 dark:border-gray-700 rounded-xl p-2 flex-1 bg-white dark:bg-gray-800 text-xs font-bold"
                                            value={adjustDate.day} 
                                            onChange={e => setAdjustDate({ ...adjustDate, day: Number(e.target.value) })}
                                        >
                                            {days.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Item Picker */}
                            <div className="bg-purple-50/40 dark:bg-purple-950/20 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/30 space-y-3">
                                <label className="text-xs font-black text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                                    <Package size={16} />
                                    <span>انتخاب کالا جهت اصلاح موجودی:</span>
                                </label>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div className="sm:col-span-1">
                                        <div className="relative">
                                            <Search className="absolute right-3 top-2.5 text-gray-400" size={15} />
                                            <input 
                                                type="text"
                                                placeholder="جستجوی نام یا کد..."
                                                value={itemSearch}
                                                onChange={e => setItemSearch(e.target.value)}
                                                className="w-full bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800/40 rounded-xl pr-9 pl-3 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <select 
                                            value={selectedItemId} 
                                            onChange={e => handleSelectItem(e.target.value)}
                                            className="w-full bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 rounded-xl p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
                                        >
                                            <option value="">-- انتخاب کالا از لیست ({filteredItems.length}) --</option>
                                            {filteredItems.map(i => (
                                                <option key={i.id} value={i.id}>
                                                    {i.name} {i.code ? `(${i.code})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Current Stock Display Card */}
                                {selectedItem && (
                                    <div className="bg-white/90 dark:bg-gray-900/90 p-4 rounded-2xl border border-purple-200/60 dark:border-purple-900/40 shadow-sm mt-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-white/5 pb-2.5 mb-3">
                                            <div>
                                                <span className="text-xs font-black text-gray-800 dark:text-gray-200">{selectedItem.name}</span>
                                                <span className="text-[11px] text-gray-400 font-mono mr-2">[{selectedItem.code || 'فاقد کد'}]</span>
                                            </div>
                                            <span className="text-[11px] text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2.5 py-0.5 rounded-full font-bold">
                                                شرکت: {selectedCompany}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                                            <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                                                <div className="text-[10px] font-bold text-gray-500 mb-1">کارتن فعلی در سیستم</div>
                                                <div className={`font-mono font-black text-sm ${currentStock.quantity < 0 ? 'text-rose-600 bg-rose-50 dark:bg-rose-950 px-1 py-0.5 rounded' : currentStock.quantity === 0 ? 'text-gray-600' : 'text-blue-600'}`}>
                                                    {formatNumberString(currentStock.quantity)}
                                                </div>
                                            </div>

                                            <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                                                <div className="text-[10px] font-bold text-gray-500 mb-1">وزن فعلی در سیستم</div>
                                                <div className={`font-mono font-black text-sm ${currentStock.weight < 0 ? 'text-rose-600' : currentStock.weight === 0 ? 'text-gray-600' : 'text-purple-600'}`}>
                                                    {formatNumberString(currentStock.weight)} KG
                                                </div>
                                            </div>

                                            <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl col-span-2 sm:col-span-1">
                                                <div className="text-[10px] font-bold text-gray-500 mb-1">وضعیت کالا</div>
                                                <div className="text-xs font-bold">
                                                    {currentStock.quantity === 0 && currentStock.weight !== 0 ? (
                                                        <span className="text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                                                            <AlertTriangle size={12} /> کارتن صفر ولی وزن مانده!
                                                        </span>
                                                    ) : currentStock.quantity === 0 && currentStock.weight === 0 ? (
                                                        <span className="text-gray-500">موجودی صفر و بدون مانده</span>
                                                    ) : currentStock.quantity < 0 || currentStock.weight < 0 ? (
                                                        <span className="text-rose-600">موجودی دارای کسری منفی</span>
                                                    ) : (
                                                        <span className="text-emerald-600">دارای موجودی مثبت</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Target Values Inputs & Quick Actions */}
                            {selectedItem && (
                                <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-4">
                                    <div className="flex flex-wrap justify-between items-center gap-2">
                                        <h4 className="text-xs font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                                            <Scale size={16} />
                                            <span>تعیین موجودی صحیح نهایی (مقادیر پس از اصلاح):</span>
                                        </h4>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={handleZeroBoth}
                                                className="text-[10px] bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 px-2.5 py-1 rounded-lg font-black transition-all flex items-center gap-1"
                                                title="تنظیم تعداد کارتن = ۰ و وزن = ۰"
                                            >
                                                <Zap size={11} />
                                                <span>صفر کردن کارتن و وزن</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleZeroWeightOnly}
                                                className="text-[10px] bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 px-2.5 py-1 rounded-lg font-black transition-all flex items-center gap-1"
                                                title="صفر کردن مانده وزن در حالی که تعداد کارتن فعلی حفظ شود"
                                            >
                                                <Zap size={11} />
                                                <span>صفر کردن فقط وزن</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleResetToCurrent}
                                                className="text-[10px] bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-lg font-bold transition-all flex items-center gap-1"
                                            >
                                                <RotateCcw size={11} />
                                                <span>بازنشانی</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Target Quantity (کارتن) */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                                                <span>تعداد کارتن نهایی مورد نظر:</span>
                                                <span className="text-[11px] font-mono text-gray-400">فعلی: {formatNumberString(currentStock.quantity)}</span>
                                            </label>
                                            <input 
                                                type="number"
                                                step="any"
                                                placeholder="0"
                                                value={targetQty}
                                                onChange={e => setTargetQty(e.target.value)}
                                                className="w-full bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-800/50 rounded-xl p-3 text-center font-mono font-black text-sm outline-none focus:border-indigo-600"
                                            />
                                        </div>

                                        {/* Target Weight (وزن KG) */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                                                <span>وزن نهایی مورد نظر (KG):</span>
                                                <span className="text-[11px] font-mono text-gray-400">فعلی: {formatNumberString(currentStock.weight)} KG</span>
                                            </label>
                                            <input 
                                                type="number"
                                                step="any"
                                                placeholder="0"
                                                value={targetWeight}
                                                onChange={e => setTargetWeight(e.target.value)}
                                                className="w-full bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-800/50 rounded-xl p-3 text-center font-mono font-black text-sm outline-none focus:border-indigo-600"
                                            />
                                        </div>
                                    </div>

                                    {/* Reason */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                            <FileText size={14} className="text-gray-400" />
                                            <span>دلیل اصلاح و شرح سند:</span>
                                        </label>
                                        <input 
                                            type="text"
                                            placeholder="مثلاً: اصلاح مانده وزن کالا در انبارگردانی / صفر کردن مانده"
                                            value={reason}
                                            onChange={e => setReason(e.target.value)}
                                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>

                                    {/* Calculation & Difference Summary Preview */}
                                    {hasChanges && (
                                        <div className="p-3.5 bg-white dark:bg-gray-900 rounded-xl border border-indigo-200 dark:border-indigo-900/60 space-y-2 text-xs">
                                            <div className="font-black text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                                                <Sparkles size={14} className="text-amber-500" />
                                                <span>خلاصه سند تعدیل که صادر خواهد شد:</span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/60 p-2 rounded-lg">
                                                    <span>تعدیل کارتن:</span>
                                                    <span className={`font-mono font-black ${diffQty === 0 ? 'text-gray-500' : diffQty > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {diffQty > 0 ? `+${formatNumberString(diffQty)} (افزایش)` : diffQty < 0 ? `${formatNumberString(diffQty)} (کاهش)` : 'بدون تغییر'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/60 p-2 rounded-lg">
                                                    <span>تعدیل وزن:</span>
                                                    <span className={`font-mono font-black ${diffWeight === 0 ? 'text-gray-500' : diffWeight > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {diffWeight > 0 ? `+${formatNumberString(diffWeight)} KG (افزایش)` : diffWeight < 0 ? `${formatNumberString(diffWeight)} KG (کاهش)` : 'بدون تغییر'}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-gray-400 leading-relaxed">
                                                ⚡ این سند به عنوان تعدیل داخلی انبارگردانی بدون مصرف شماره بیجک رسمی ثبت می‌شود و هیچ اختلالی در توالی شماره‌های ورود و خروج مشتری ایجاد نخواهد کرد.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Submit Button */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs transition-all"
                                >
                                    انصراف
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmitAdjustment}
                                    disabled={isSubmitting || !selectedItemId || !hasChanges}
                                    className={`px-6 py-2.5 rounded-xl font-black text-xs text-white shadow-lg transition-all flex items-center gap-2 ${
                                        isSubmitting || !selectedItemId || !hasChanges
                                            ? 'bg-gray-400 cursor-not-allowed shadow-none'
                                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-600/20 cursor-pointer active:scale-95'
                                    }`}
                                >
                                    {isSubmitting ? (
                                        <span>در حال ذخیره...</span>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={16} />
                                            <span>ثبت اصلاحیه و اعمال به موجودی</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: ADJUSTMENT HISTORY */}
                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                                <div className="relative w-full sm:w-72">
                                    <Search className="absolute right-3 top-2.5 text-gray-400" size={15} />
                                    <input 
                                        type="text"
                                        placeholder="جستجو در سوابق اصلاحات..."
                                        value={historySearch}
                                        onChange={e => setHistorySearch(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pr-9 pl-3 py-2 text-xs outline-none"
                                    />
                                </div>

                                <div className="text-xs text-gray-500 font-bold">
                                    تعداد سوابق: {filteredHistory.length}
                                </div>
                            </div>

                            {filteredHistory.length === 0 ? (
                                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 text-xs">
                                    <History size={32} className="mx-auto mb-2 text-gray-300" />
                                    <span>هیچ سند تعدیل یا اصلاح مستقیمی یافت نشد.</span>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {filteredHistory.map((adj, index) => (
                                        <div 
                                            key={`${adj.id}-${index}`}
                                            className="bg-white dark:bg-gray-800/80 p-4 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-purple-200 dark:hover:border-purple-800/40 transition-all shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2.5 rounded-xl shrink-0 ${adj.type === 'IN' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/50'}`}>
                                                    {adj.type === 'IN' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-gray-800 dark:text-gray-200">{adj.itemName}</span>
                                                        <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md font-bold">
                                                            {adj.company}
                                                        </span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-black ${adj.type === 'IN' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950' : 'bg-rose-100 text-rose-700 dark:bg-rose-950'}`}>
                                                            {adj.type === 'IN' ? 'سرک (افزایش)' : 'کسری (کاهش)'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                                        {adj.description}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 flex items-center gap-2">
                                                        <span>ثبت: {adj.createdBy}</span>
                                                        <span>•</span>
                                                        <span>{new Date(adj.date).toLocaleDateString('fa-IR')}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-white/5">
                                                <div className="text-left font-mono">
                                                    <div className="font-black text-gray-800 dark:text-gray-200">
                                                        {formatNumberString(adj.quantity)} کارتن
                                                    </div>
                                                    <div className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">
                                                        {formatNumberString(adj.weight)} KG
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteAdjustment(adj)}
                                                    disabled={isSubmitting}
                                                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all"
                                                    title="حذف این سند تعدیل و بازگشت موجودی"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
