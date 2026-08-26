import React, { useState, useMemo } from 'react';
import { WarehouseItem, WarehouseTransaction, User } from '../types';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatNumberString } from '../constants';
import { saveWarehouseTransaction, updateWarehouseTransaction, deleteWarehouseTransaction } from '../services/storageService';
import { 
    ArrowLeftRight, 
    X, 
    Building2, 
    Package, 
    Scale, 
    Calendar, 
    CheckCircle2, 
    AlertTriangle, 
    Calculator,
    Sparkles,
    FileText,
    History,
    Edit3,
    Trash2,
    PlusCircle,
    Search,
    Info,
    RefreshCw
} from 'lucide-react';

interface StockTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: WarehouseItem[];
    companies: string[];
    defaultCompany?: string;
    currentUser: User;
    allTransactions: WarehouseTransaction[];
    onSuccess: () => void;
}

interface TransferGroupRecord {
    transferId: string;
    date: string;
    company: string;
    sourceTx: WarehouseTransaction;
    destTx?: WarehouseTransaction;
    sourceItemId: string;
    sourceItemName: string;
    destItemId: string;
    destItemName: string;
    quantity: number;
    weight: number;
    reason: string;
    createdBy: string;
    createdAt: number;
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
    isOpen,
    onClose,
    items,
    companies,
    defaultCompany,
    currentUser,
    allTransactions,
    onSuccess
}) => {
    const currentShamsi = getCurrentShamsiDate();
    const [activeSubTab, setActiveSubTab] = useState<'new_transfer' | 'history'>('new_transfer');
    
    // Editing state
    const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
    const [editingSourceTxId, setEditingSourceTxId] = useState<string | null>(null);
    const [editingDestTxId, setEditingDestTxId] = useState<string | null>(null);

    const [selectedCompany, setSelectedCompany] = useState<string>(defaultCompany || (companies.length > 0 ? companies[0] : ''));
    const [sourceItemId, setSourceItemId] = useState<string>('');
    const [destItemId, setDestItemId] = useState<string>('');
    const [transferQty, setTransferQty] = useState<string>('');
    const [transferWeight, setTransferWeight] = useState<string>('');
    const [transferReason, setTransferReason] = useState<string>('اصلاح و جابجایی موجودی در انبارگردانی');
    const [transferDate, setTransferDate] = useState({
        year: currentShamsi.year,
        month: currentShamsi.month,
        day: currentShamsi.day
    });
    const [searchSource, setSearchSource] = useState<string>('');
    const [searchDest, setSearchDest] = useState<string>('');
    const [historySearch, setHistorySearch] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Calculate real-time signed stock (positive or negative) for any item in the selected company
    const getDetailedStock = (companyName: string, itemId: string) => {
        if (!companyName || !itemId) return { quantity: 0, weight: 0 };
        let quantity = 0;
        let weight = 0;
        allTransactions
            .filter(tx => tx.company === companyName && tx.status !== 'REJECTED')
            .forEach(tx => {
                tx.items.forEach(txItem => {
                    if (txItem.itemId === itemId) {
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
        // Clean micro decimals
        if (Math.abs(quantity) < 0.0001) quantity = 0;
        if (Math.abs(weight) < 0.0001) weight = 0;
        return { quantity, weight };
    };

    const sourceItem = useMemo(() => items.find(i => i.id === sourceItemId), [items, sourceItemId]);
    const destItem = useMemo(() => items.find(i => i.id === destItemId), [items, destItemId]);

    const sourceStock = useMemo(() => getDetailedStock(selectedCompany, sourceItemId), [selectedCompany, sourceItemId, allTransactions]);
    const destStock = useMemo(() => getDetailedStock(selectedCompany, destItemId), [selectedCompany, destItemId, allTransactions]);

    const sourceAvgWeight = sourceStock.quantity !== 0 && sourceStock.weight !== 0
        ? Math.round((sourceStock.weight / sourceStock.quantity + Number.EPSILON) * 100) / 100
        : 0;

    const parsedQty = parseFloat(transferQty) || 0;
    const parsedWeight = parseFloat(transferWeight) || 0;

    // Projected Stock Calculations - allows displaying negative numbers accurately
    const sourceProjectedQty = Math.round((sourceStock.quantity - parsedQty + Number.EPSILON) * 1000) / 1000;
    const sourceProjectedWeight = Math.round((sourceStock.weight - parsedWeight + Number.EPSILON) * 1000) / 1000;

    const destProjectedQty = Math.round((destStock.quantity + parsedQty + Number.EPSILON) * 1000) / 1000;
    const destProjectedWeight = Math.round((destStock.weight + parsedWeight + Number.EPSILON) * 1000) / 1000;

    // Find and group all transfer records from transactions
    const transferHistory = useMemo(() => {
        const outTransfers = allTransactions.filter(tx => 
            tx.type === 'OUT' && 
            (tx.isTransfer || (tx.destination && tx.destination.includes('انتقال')) || (tx.description && tx.description.includes('انتقال')))
        );

        const inTransfers = allTransactions.filter(tx => 
            tx.type === 'IN' && 
            (tx.isTransfer || (tx.proformaNumber && tx.proformaNumber.includes('انتقال')) || (tx.description && tx.description.includes('انتقال')))
        );

        const historyList: TransferGroupRecord[] = [];

        outTransfers.forEach(outTx => {
            // Match with inTx by transferId or by similar time and matching company
            const matchingIn = inTransfers.find(inTx => 
                (outTx.transferId && inTx.transferId === outTx.transferId) ||
                (Math.abs(inTx.createdAt - outTx.createdAt) < 2000 && inTx.company === outTx.company)
            );

            const sourceItemData = outTx.items[0] || { itemId: '', itemName: '', quantity: 0, weight: 0 };
            const destItemData = matchingIn?.items[0] || { itemId: '', itemName: '', quantity: 0, weight: 0 };

            const trId = outTx.transferId || `TRF-${outTx.id}`;

            historyList.push({
                transferId: trId,
                date: outTx.date,
                company: outTx.company,
                sourceTx: outTx,
                destTx: matchingIn,
                sourceItemId: sourceItemData.itemId,
                sourceItemName: sourceItemData.itemName || items.find(i => i.id === sourceItemData.itemId)?.name || 'کالای مبدا',
                destItemId: destItemData.itemId,
                destItemName: destItemData.itemName || items.find(i => i.id === destItemData.itemId)?.name || 'کالای مقصد',
                quantity: sourceItemData.quantity || 0,
                weight: sourceItemData.weight || 0,
                reason: outTx.description?.replace(/\(انتقال به .*\)/, '').trim() || outTx.description || 'اصلاح و انتقال موجودی',
                createdBy: outTx.createdBy || 'کاربر سیستم',
                createdAt: outTx.createdAt
            });
        });

        // Sort descending by creation date
        return historyList.sort((a, b) => b.createdAt - a.createdAt);
    }, [allTransactions, items]);

    const filteredHistory = useMemo(() => {
        if (!historySearch.trim()) return transferHistory;
        const q = historySearch.toLowerCase();
        return transferHistory.filter(t => 
            t.company.toLowerCase().includes(q) ||
            t.sourceItemName.toLowerCase().includes(q) ||
            t.destItemName.toLowerCase().includes(q) ||
            t.reason.toLowerCase().includes(q) ||
            t.createdBy.toLowerCase().includes(q)
        );
    }, [transferHistory, historySearch]);

    const years = [1402, 1403, 1404, 1405, 1406];
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    if (!isOpen) return null;

    const handleAutoCalculateWeight = () => {
        if (parsedQty > 0 && sourceAvgWeight > 0) {
            const calculated = (parsedQty * sourceAvgWeight).toFixed(2);
            setTransferWeight(calculated);
        } else if (sourceStock.weight > 0) {
            setTransferWeight(sourceStock.weight.toString());
        }
    };

    const handleTransferAllSource = () => {
        if (sourceStock.quantity !== 0) {
            setTransferQty(sourceStock.quantity.toString());
        }
        if (sourceStock.weight !== 0) {
            setTransferWeight(sourceStock.weight.toString());
        }
    };

    const resetForm = () => {
        setEditingTransferId(null);
        setEditingSourceTxId(null);
        setEditingDestTxId(null);
        setSourceItemId('');
        setDestItemId('');
        setTransferQty('');
        setTransferWeight('');
        setTransferReason('اصلاح و جابجایی موجودی در انبارگردانی');
        setSearchSource('');
        setSearchDest('');
        setErrorMsg(null);
        setSuccessMsg(null);
    };

    const handleStartEdit = (record: TransferGroupRecord) => {
        setEditingTransferId(record.transferId);
        setEditingSourceTxId(record.sourceTx.id);
        setEditingDestTxId(record.destTx?.id || null);

        setSelectedCompany(record.company);
        setSourceItemId(record.sourceItemId);
        setDestItemId(record.destItemId);
        setTransferQty(record.quantity ? record.quantity.toString() : '');
        setTransferWeight(record.weight ? record.weight.toString() : '');
        setTransferReason(record.reason || 'اصلاح و جابجایی موجودی در انبارگردانی');

        // Parse date
        try {
            const d = new Date(record.date);
            const shamsiStr = d.toLocaleDateString('fa-IR-u-nu-latn');
            const parts = shamsiStr.split('/').map(p => parseInt(p.replace(/[^\d]/g, ''), 10));
            if (parts.length === 3) {
                setTransferDate({
                    year: parts[0],
                    month: parts[1],
                    day: parts[2]
                });
            }
        } catch (e) {
            console.warn("Could not parse transfer date:", e);
        }

        setActiveSubTab('new_transfer');
        setErrorMsg(null);
        setSuccessMsg(null);
    };

    const handleDeleteTransfer = async (record: TransferGroupRecord) => {
        const confirmMsg = `آیا از حذف این سند انتقال بین کالاها مطمئن هستید؟\n\n` +
            `• شرکت: ${record.company}\n` +
            `• کالای مبدا: ${record.sourceItemName}\n` +
            `• کالای مقصد: ${record.destItemName}\n` +
            `• مقدار جابجایی: ${formatNumberString(record.quantity)} کارتن (${formatNumberString(record.weight)} کیلوگرم)\n\n` +
            `⚠️ با حذف این سند، مقادیر جابجا شده به موجودی کالای مبدا بازگشته و از موجودی کالای مقصد کسر می‌شود.`;

        if (!window.confirm(confirmMsg)) return;

        setIsSubmitting(true);
        setErrorMsg(null);

        try {
            // Delete source transaction (OUT)
            if (record.sourceTx && record.sourceTx.id) {
                await deleteWarehouseTransaction(record.sourceTx.id);
            }
            // Delete dest transaction (IN)
            if (record.destTx && record.destTx.id) {
                await deleteWarehouseTransaction(record.destTx.id);
            }

            setSuccessMsg('سند انتقال با موفقیت حذف شد و موجودی به حالت قبل بازگشت.');
            onSuccess();
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err: any) {
            console.error("Error deleting transfer:", err);
            setErrorMsg(err.message || 'خطا در حذف سند انتقال.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitTransfer = async () => {
        setErrorMsg(null);
        setSuccessMsg(null);

        if (!selectedCompany) {
            setErrorMsg('لطفاً شرکت (انبار) مورد نظر را انتخاب کنید.');
            return;
        }

        if (!sourceItemId || !sourceItem) {
            setErrorMsg('لطفاً کالای مبدا (جهت کسر موجودی) را انتخاب کنید.');
            return;
        }

        if (!destItemId || !destItem) {
            setErrorMsg('لطفاً کالای مقصد (جهت افزایش موجودی) را انتخاب کنید.');
            return;
        }

        if (sourceItemId === destItemId) {
            setErrorMsg('کالای مبدا و کالای مقصد نمی‌توانند یکسان باشند.');
            return;
        }

        if (parsedQty <= 0 && parsedWeight <= 0) {
            setErrorMsg('لطفاً تعداد کارتن یا وزن انتقالی معتبر (بزرگتر از صفر) وارد نمایید.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Compute Jalali ISO Date
            const txDateIso = (() => {
                try {
                    const d = jalaliToGregorian(transferDate.year, transferDate.month, transferDate.day);
                    d.setHours(12, 0, 0, 0);
                    return d.toISOString();
                } catch {
                    const d = new Date();
                    d.setHours(12, 0, 0, 0);
                    return d.toISOString();
                }
            })();

            const now = Date.now();
            const reasonText = transferReason.trim() || 'اصلاح و جابجایی موجودی انبارگردانی';
            const transferGroupId = editingTransferId || `TRF-${generateUUID()}`;

            // 1. OUT Transaction (خروج از کالای مبدا - بدون استفاده از شماره بیجک)
            const txOut: WarehouseTransaction = {
                id: editingSourceTxId || generateUUID(),
                type: 'OUT',
                date: txDateIso,
                company: selectedCompany,
                number: 0, // No Bijak number consumed!
                items: [{
                    itemId: sourceItem.id,
                    itemName: sourceItem.name,
                    quantity: parsedQty,
                    weight: parsedWeight,
                    unitPrice: 0
                }],
                createdAt: now,
                createdBy: currentUser.fullName,
                destination: `انتقال اصلاحی به: ${destItem.name}`,
                description: `${reasonText} (انتقال به ${destItem.name})`,
                status: 'APPROVED',
                approvedBy: currentUser.fullName,
                isTransfer: true,
                transferId: transferGroupId
            };

            // 2. IN Transaction (ورود به کالای مقصد - بدون شماره بیجک)
            const txIn: WarehouseTransaction = {
                id: editingDestTxId || generateUUID(),
                type: 'IN',
                date: txDateIso,
                company: selectedCompany,
                number: 0, // No Bijak number consumed!
                items: [{
                    itemId: destItem.id,
                    itemName: destItem.name,
                    quantity: parsedQty,
                    weight: parsedWeight,
                    unitPrice: 0
                }],
                createdAt: now + 50,
                createdBy: currentUser.fullName,
                proformaNumber: `انتقال اصلاحی از: ${sourceItem.name}`,
                description: `${reasonText} (انتقال از ${sourceItem.name})`,
                status: 'APPROVED',
                isTransfer: true,
                transferId: transferGroupId
            };

            if (editingTransferId) {
                await updateWarehouseTransaction(txOut);
                await updateWarehouseTransaction(txIn);
                setSuccessMsg('اصلاحات سند انتقال با موفقیت ذخیره شد.');
            } else {
                await saveWarehouseTransaction(txOut);
                await saveWarehouseTransaction(txIn);
                setSuccessMsg('سند انتقال جدید بدون استفاده از شماره بیجک با موفقیت ثبت شد.');
            }

            onSuccess();
            resetForm();
            setActiveSubTab('history');
            setTimeout(() => setSuccessMsg(null), 3500);
        } catch (err: any) {
            console.error("Transfer error:", err);
            setErrorMsg(err.message || 'خطا در ثبت تراکنش‌های انتقال موجودی.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredSourceItems = items.filter(i => 
        !searchSource || 
        i.name.toLowerCase().includes(searchSource.toLowerCase()) || 
        (i.code && i.code.toLowerCase().includes(searchSource.toLowerCase()))
    );

    const filteredDestItems = items.filter(i => 
        i.id !== sourceItemId &&
        (!searchDest || 
        i.name.toLowerCase().includes(searchDest.toLowerCase()) || 
        (i.code && i.code.toLowerCase().includes(searchDest.toLowerCase())))
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto" dir="rtl">
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-2xl w-full max-w-4xl overflow-hidden my-4">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 p-5 md:p-6 text-white flex justify-between items-center relative">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                            <ArrowLeftRight className="text-indigo-200" size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black tracking-tight">مدیریت انتقال موجودی بین کالاها</h3>
                                <span className="text-[10px] bg-emerald-400/20 text-emerald-200 border border-emerald-400/40 px-2 py-0.5 rounded-full font-bold">
                                    بدون مصرف شماره بیجک
                                </span>
                            </div>
                            <p className="text-xs text-indigo-200/80 mt-0.5 font-medium">جابجایی کارتن و وزن، مشاهده موجودی منفی و مثبت، اصلاح و حذف آسان اسناد انتقال</p>
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
                            onClick={() => {
                                setActiveSubTab('new_transfer');
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                activeSubTab === 'new_transfer'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {editingTransferId ? <Edit3 size={15} /> : <PlusCircle size={15} />}
                            <span>{editingTransferId ? 'اصلاح سند انتقال' : 'ثبت انتقال جدید'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setActiveSubTab('history');
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                activeSubTab === 'history'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            <History size={15} />
                            <span>لیست و تاریخچه انتقال‌ها ({transferHistory.length})</span>
                        </button>
                    </div>

                    {editingTransferId && (
                        <button
                            type="button"
                            onClick={resetForm}
                            className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 flex items-center gap-1.5 transition-all"
                        >
                            <X size={13} />
                            <span>انصراف از ویرایش</span>
                        </button>
                    )}
                </div>

                {/* Body Content */}
                <div className="p-5 md:p-6 space-y-5 max-h-[72vh] overflow-y-auto">
                    {/* Alerts */}
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

                    {/* TAB 1: NEW / EDIT TRANSFER FORM */}
                    {activeSubTab === 'new_transfer' && (
                        <div className="space-y-5">
                            {editingTransferId && (
                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3.5 rounded-2xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                                    <div className="flex items-center gap-2">
                                        <Edit3 size={16} className="text-amber-600" />
                                        <span className="font-bold">در حال ویرایش سند انتقال قبلی هستید. پس از ثبت، مقادیر جدید اعمال خواهند شد.</span>
                                    </div>
                                    <span className="font-mono text-[11px] bg-amber-200 dark:bg-amber-900 px-2 py-0.5 rounded-md font-bold">{editingTransferId}</span>
                                </div>
                            )}

                            {/* Top Row: Company & Date */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Company Selection */}
                                <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200/70 dark:border-white/5 space-y-2">
                                    <label className="text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <Building2 size={16} className="text-indigo-600" />
                                        <span>شرکت / انبار مربوطه:</span>
                                    </label>
                                    <select 
                                        value={selectedCompany} 
                                        onChange={e => setSelectedCompany(e.target.value)}
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">-- انتخاب شرکت --</option>
                                        {companies.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                {/* Transfer Date */}
                                <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200/70 dark:border-white/5 space-y-2">
                                    <label className="text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <Calendar size={16} className="text-indigo-600" />
                                        <span>تاریخ سند انتقال:</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <select 
                                            className="border border-gray-300 dark:border-gray-700 rounded-xl p-2 flex-1 bg-white dark:bg-gray-800 text-xs font-bold"
                                            value={transferDate.year} 
                                            onChange={e => setTransferDate({ ...transferDate, year: Number(e.target.value) })}
                                        >
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                        <select 
                                            className="border border-gray-300 dark:border-gray-700 rounded-xl p-2 flex-1 bg-white dark:bg-gray-800 text-xs font-bold"
                                            value={transferDate.month} 
                                            onChange={e => setTransferDate({ ...transferDate, month: Number(e.target.value) })}
                                        >
                                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                        <select 
                                            className="border border-gray-300 dark:border-gray-700 rounded-xl p-2 flex-1 bg-white dark:bg-gray-800 text-xs font-bold"
                                            value={transferDate.day} 
                                            onChange={e => setTransferDate({ ...transferDate, day: Number(e.target.value) })}
                                        >
                                            {days.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Middle Section: Source & Destination Goods */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                                {/* Source Item (کاهش) */}
                                <div className="bg-rose-50/40 dark:bg-rose-950/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-black text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                                            <Package size={16} />
                                            <span>کالای مبدا (کسر از موجودی):</span>
                                        </label>
                                        {sourceItem && (
                                            <button 
                                                type="button" 
                                                onClick={handleTransferAllSource}
                                                className="text-[10px] bg-rose-100 dark:bg-rose-900/50 hover:bg-rose-200 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-lg font-bold transition-all"
                                            >
                                                انتخاب کل موجودی
                                            </button>
                                        )}
                                    </div>

                                    <input 
                                        type="text"
                                        placeholder="جستجوی سریع کالای مبدا..."
                                        value={searchSource}
                                        onChange={e => setSearchSource(e.target.value)}
                                        className="w-full bg-white dark:bg-gray-800 border border-rose-200 dark:border-rose-800/40 rounded-xl px-3 py-1.5 text-xs outline-none"
                                    />

                                    <select 
                                        value={sourceItemId} 
                                        onChange={e => setSourceItemId(e.target.value)}
                                        className="w-full bg-white dark:bg-gray-800 border border-rose-300 dark:border-rose-700 rounded-xl p-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
                                    >
                                        <option value="">-- انتخاب کالای مبدا --</option>
                                        {filteredSourceItems.map(i => (
                                            <option key={i.id} value={i.id}>
                                                {i.name} {i.code ? `(${i.code})` : ''}
                                            </option>
                                        ))}
                                    </select>

                                    {/* Live Stock Source Stats (Shows Negative/Positive) */}
                                    {sourceItemId && (
                                        <div className="bg-white/90 dark:bg-gray-900/90 p-3 rounded-xl border border-rose-200/60 dark:border-rose-900/40 space-y-1.5 text-xs">
                                            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                                                <span>کارتن موجود در انبار:</span>
                                                <span className={`font-mono font-black ${sourceStock.quantity < 0 ? 'text-rose-600 bg-rose-100 dark:bg-rose-950 px-1.5 py-0.5 rounded' : 'text-gray-800 dark:text-gray-200'}`}>
                                                    {formatNumberString(sourceStock.quantity)}
                                                    {sourceStock.quantity < 0 && <span className="text-[10px] mr-1 text-rose-500 font-sans">(موجودی منفی)</span>}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                                                <span>وزن موجود در انبار:</span>
                                                <span className={`font-mono font-black ${sourceStock.weight < 0 ? 'text-rose-600' : 'text-gray-800 dark:text-gray-200'}`}>
                                                    {formatNumberString(sourceStock.weight)} KG
                                                </span>
                                            </div>
                                            {sourceAvgWeight !== 0 && (
                                                <div className="flex justify-between text-[11px] text-amber-700 dark:text-amber-400 border-t border-gray-100 dark:border-white/5 pt-1">
                                                    <span>میانگین وزن هر کارتن:</span>
                                                    <span className="font-mono font-bold">{sourceAvgWeight.toFixed(2)} KG</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Destination Item (افزایش) */}
                                <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 space-y-3">
                                    <label className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                        <Package size={16} />
                                        <span>کالای مقصد (افزایش موجودی):</span>
                                    </label>

                                    <input 
                                        type="text"
                                        placeholder="جستجوی سریع کالای مقصد..."
                                        value={searchDest}
                                        onChange={e => setSearchDest(e.target.value)}
                                        className="w-full bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-3 py-1.5 text-xs outline-none"
                                    />

                                    <select 
                                        value={destItemId} 
                                        onChange={e => setDestItemId(e.target.value)}
                                        className="w-full bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-xl p-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="">-- انتخاب کالای مقصد --</option>
                                        {filteredDestItems.map(i => (
                                            <option key={i.id} value={i.id}>
                                                {i.name} {i.code ? `(${i.code})` : ''}
                                            </option>
                                        ))}
                                    </select>

                                    {/* Live Stock Destination Stats (Shows Negative/Positive) */}
                                    {destItemId && (
                                        <div className="bg-white/90 dark:bg-gray-900/90 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 space-y-1.5 text-xs">
                                            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                                                <span>کارتن فعلی در انبار:</span>
                                                <span className={`font-mono font-black ${destStock.quantity < 0 ? 'text-rose-600 bg-rose-100 dark:bg-rose-950 px-1.5 py-0.5 rounded' : 'text-emerald-600'}`}>
                                                    {formatNumberString(destStock.quantity)}
                                                    {destStock.quantity < 0 && <span className="text-[10px] mr-1 text-rose-500 font-sans">(موجودی منفی)</span>}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                                                <span>وزن فعلی در انبار:</span>
                                                <span className={`font-mono font-black ${destStock.weight < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {formatNumberString(destStock.weight)} KG
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quantities to transfer */}
                            <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-4">
                                <h4 className="text-xs font-black text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                                    <Scale size={16} />
                                    <span>مقادیر انتقالی (تعداد کارتن و وزن دلخواه):</span>
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Quantity (کارتن) */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-gray-700 dark:text-gray-300">تعداد کارتن انتقالی:</span>
                                            {sourceStock.quantity !== 0 && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => setTransferQty(sourceStock.quantity.toString())}
                                                    className="text-[10px] text-indigo-600 font-bold hover:underline"
                                                >
                                                    موجودی مبدا ({formatNumberString(sourceStock.quantity)})
                                                </button>
                                            )}
                                        </div>
                                        <input 
                                            type="number"
                                            step="any"
                                            min="0"
                                            placeholder="مثال: 10"
                                            value={transferQty}
                                            onChange={e => setTransferQty(e.target.value)}
                                            className="w-full bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-800/50 rounded-xl p-3 text-center font-mono font-black text-sm outline-none focus:border-indigo-600"
                                        />
                                    </div>

                                    {/* Weight (وزن) */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-gray-700 dark:text-gray-300">وزن انتقالی (کیلوگرم):</span>
                                            <div className="flex gap-2">
                                                {sourceAvgWeight > 0 && parsedQty > 0 && (
                                                    <button 
                                                        type="button" 
                                                        onClick={handleAutoCalculateWeight}
                                                        className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold hover:bg-indigo-200 flex items-center gap-1"
                                                        title="محاسبه وزن بر اساس میانگین کارتن کالای مبدا"
                                                    >
                                                        <Calculator size={10} />
                                                        <span>محاسبه خودکار</span>
                                                    </button>
                                                )}
                                                {sourceStock.weight !== 0 && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setTransferWeight(sourceStock.weight.toString())}
                                                        className="text-[10px] text-indigo-600 font-bold hover:underline"
                                                    >
                                                        کل وزن مبدا ({formatNumberString(sourceStock.weight)})
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <input 
                                            type="number"
                                            step="any"
                                            min="0"
                                            placeholder="مثال: 330.5"
                                            value={transferWeight}
                                            onChange={e => setTransferWeight(e.target.value)}
                                            className="w-full bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-800/50 rounded-xl p-3 text-center font-mono font-black text-sm outline-none focus:border-indigo-600"
                                        />
                                    </div>
                                </div>

                                {/* Reason / Notes */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                        <FileText size={14} className="text-gray-400" />
                                        <span>شرح و دلیل جابجایی:</span>
                                    </label>
                                    <input 
                                        type="text"
                                        placeholder="مثلاً: اصلاح اشتباه ثبتی در نام کالا / رفع مغایرت انبارگردانی"
                                        value={transferReason}
                                        onChange={e => setTransferReason(e.target.value)}
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Preview Table of Changes (With Negative Stock Handling) */}
                            {sourceItem && destItem && (parsedQty > 0 || parsedWeight > 0) && (
                                <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-200 dark:border-white/5 space-y-2">
                                    <div className="flex items-center gap-1.5 text-xs font-black text-gray-700 dark:text-gray-300">
                                        <Sparkles size={14} className="text-amber-500" />
                                        <span>پیش‌نمایش تغییرات پس از ثبت انتقال:</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                        {/* Source item after */}
                                        <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-rose-100 dark:border-rose-900/30">
                                            <div className="font-bold text-rose-700 dark:text-rose-400 mb-1">{sourceItem.name} (مبدا)</div>
                                            <div className="flex justify-between text-gray-500 text-[11px]">
                                                <span>کارتن: {formatNumberString(sourceStock.quantity)} ➔</span>
                                                <span className={`font-mono font-black ${sourceProjectedQty < 0 ? 'text-rose-600 bg-rose-50 dark:bg-rose-950 px-1 rounded' : 'text-gray-800 dark:text-gray-200'}`}>
                                                    {formatNumberString(sourceProjectedQty)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-gray-500 text-[11px] mt-0.5">
                                                <span>وزن: {formatNumberString(sourceStock.weight)} ➔</span>
                                                <span className={`font-mono font-black ${sourceProjectedWeight < 0 ? 'text-rose-600' : 'text-gray-800 dark:text-gray-200'}`}>
                                                    {formatNumberString(sourceProjectedWeight)} KG
                                                </span>
                                            </div>
                                        </div>

                                        {/* Dest item after */}
                                        <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                                            <div className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">{destItem.name} (مقصد)</div>
                                            <div className="flex justify-between text-gray-500 text-[11px]">
                                                <span>کارتن: {formatNumberString(destStock.quantity)} ➔</span>
                                                <span className={`font-mono font-black ${destProjectedQty < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {formatNumberString(destProjectedQty)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-gray-500 text-[11px] mt-0.5">
                                                <span>وزن: {formatNumberString(destStock.weight)} ➔</span>
                                                <span className={`font-mono font-black ${destProjectedWeight < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {formatNumberString(destProjectedWeight)} KG
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="pt-2 flex flex-col sm:flex-row justify-end items-center gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                    className="w-full sm:w-auto px-5 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-all"
                                >
                                    بستن
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmitTransfer}
                                    disabled={isSubmitting}
                                    className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <span>در حال ثبت سند...</span>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={16} />
                                            <span>{editingTransferId ? 'ذخیره اصلاحات سند انتقال' : 'تایید و ثبت نهایی انتقال موجودی'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: HISTORY & EDIT/DELETE MANAGEMENT */}
                    {activeSubTab === 'history' && (
                        <div className="space-y-4">
                            {/* Search bar */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="relative w-full sm:w-80">
                                    <input
                                        type="text"
                                        placeholder="جستجو بر اساس شرکت، نام کالا، علت یا ثبت کننده..."
                                        value={historySearch}
                                        onChange={e => setHistorySearch(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl pr-9 pl-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <Search size={15} className="absolute right-3 top-2.5 text-gray-400" />
                                </div>
                                
                                <div className="text-xs text-gray-500 flex items-center gap-1.5 self-end sm:self-center">
                                    <Info size={14} />
                                    <span>مجموع انتقال‌های ثبت شده: <strong className="font-mono text-gray-800 dark:text-gray-200">{transferHistory.length}</strong> مورد</span>
                                </div>
                            </div>

                            {/* Table of Transfers */}
                            {filteredHistory.length === 0 ? (
                                <div className="p-12 text-center bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-200 dark:border-white/5 space-y-2">
                                    <ArrowLeftRight size={32} className="mx-auto text-gray-400" />
                                    <p className="text-xs font-bold text-gray-500">هیچ سند انتقالی یافت نشد.</p>
                                </div>
                            ) : (
                                <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-right">
                                            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold border-b border-gray-200 dark:border-white/10">
                                                <tr>
                                                    <th className="p-3">تاریخ</th>
                                                    <th className="p-3">شرکت</th>
                                                    <th className="p-3">کالای مبدا (کسر)</th>
                                                    <th className="p-3">کالای مقصد (افزایش)</th>
                                                    <th className="p-3 text-center">تعداد کارتن</th>
                                                    <th className="p-3 text-center">وزن (KG)</th>
                                                    <th className="p-3">علت / شرح</th>
                                                    <th className="p-3 text-center">عملیات</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                {filteredHistory.map((rec) => {
                                                    const formattedDate = (() => {
                                                        try {
                                                            const d = new Date(rec.date);
                                                            return d.toLocaleDateString('fa-IR');
                                                        } catch {
                                                            return rec.date;
                                                        }
                                                    })();

                                                    return (
                                                        <tr key={rec.transferId} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors">
                                                            <td className="p-3 font-mono font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                                {formattedDate}
                                                            </td>
                                                            <td className="p-3 font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                                                                {rec.company}
                                                            </td>
                                                            <td className="p-3 font-bold text-rose-700 dark:text-rose-400">
                                                                {rec.sourceItemName}
                                                            </td>
                                                            <td className="p-3 font-bold text-emerald-700 dark:text-emerald-400">
                                                                {rec.destItemName}
                                                            </td>
                                                            <td className="p-3 text-center font-mono font-black text-gray-900 dark:text-gray-100">
                                                                {formatNumberString(rec.quantity)}
                                                            </td>
                                                            <td className="p-3 text-center font-mono font-black text-gray-900 dark:text-gray-100">
                                                                {formatNumberString(rec.weight)}
                                                            </td>
                                                            <td className="p-3 text-gray-600 dark:text-gray-400 max-w-xs truncate" title={rec.reason}>
                                                                {rec.reason}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    {/* Edit Button */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleStartEdit(rec)}
                                                                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/70 text-indigo-600 dark:text-indigo-300 rounded-lg transition-all"
                                                                        title="اصلاح و ویرایش انتقال"
                                                                    >
                                                                        <Edit3 size={14} />
                                                                    </button>
                                                                    {/* Delete Button */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteTransfer(rec)}
                                                                        disabled={isSubmitting}
                                                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 text-rose-600 dark:text-rose-400 rounded-lg transition-all disabled:opacity-40"
                                                                        title="حذف سند انتقال"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Bottom note */}
                            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                <Info size={15} className="shrink-0" />
                                <span>تمامی اسناد انتقال به صورت داخلی بین کالاها ثبت شده و هیچ شماره بیجک رسمی مصرف نمی‌کنند. با ویرایش یا حذف، موجودی کالاها به طور خودکار اصلاح و همگام‌سازی می‌شود.</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
