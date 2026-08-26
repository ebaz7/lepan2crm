import React, { useState, useMemo } from 'react';
import { WarehouseItem, WarehouseTransaction, User } from '../types';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatNumberString } from '../constants';
import { saveWarehouseTransaction } from '../services/storageService';
import { apiCall } from '../services/apiService';
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
    ArrowDown,
    Sparkles,
    FileText
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
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Calculate real-time stock for any item in the selected company
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
        if (quantity <= 0) {
            quantity = 0;
            weight = 0;
        }
        return { quantity, weight };
    };

    const sourceItem = useMemo(() => items.find(i => i.id === sourceItemId), [items, sourceItemId]);
    const destItem = useMemo(() => items.find(i => i.id === destItemId), [items, destItemId]);

    const sourceStock = useMemo(() => getDetailedStock(selectedCompany, sourceItemId), [selectedCompany, sourceItemId, allTransactions]);
    const destStock = useMemo(() => getDetailedStock(selectedCompany, destItemId), [selectedCompany, destItemId, allTransactions]);

    const sourceAvgWeight = sourceStock.quantity > 0 && sourceStock.weight > 0
        ? Math.round((sourceStock.weight / sourceStock.quantity + Number.EPSILON) * 100) / 100
        : 0;

    const parsedQty = parseFloat(transferQty) || 0;
    const parsedWeight = parseFloat(transferWeight) || 0;

    // Projected Stock Calculations
    const sourceProjectedQty = Math.max(0, Math.round((sourceStock.quantity - parsedQty + Number.EPSILON) * 1000) / 1000);
    const sourceProjectedWeight = Math.max(0, Math.round((sourceStock.weight - parsedWeight + Number.EPSILON) * 1000) / 1000);

    const destProjectedQty = Math.round((destStock.quantity + parsedQty + Number.EPSILON) * 1000) / 1000;
    const destProjectedWeight = Math.round((destStock.weight + parsedWeight + Number.EPSILON) * 1000) / 1000;

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
        if (sourceStock.quantity > 0) {
            setTransferQty(sourceStock.quantity.toString());
        }
        if (sourceStock.weight > 0) {
            setTransferWeight(sourceStock.weight.toString());
        }
    };

    const handleSubmitTransfer = async () => {
        setErrorMsg(null);

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

            // Next bijak number for company
            let nextNum = 0;
            try {
                const res = await apiCall<{ nextNumber: number }>(`/next-bijak-number?company=${encodeURIComponent(selectedCompany)}`);
                if (res && res.nextNumber) nextNum = res.nextNumber;
            } catch (e) {
                console.warn("Could not fetch next bijak number:", e);
            }

            const now = Date.now();
            const reasonText = transferReason.trim() || 'اصلاح و جابجایی موجودی انبارگردانی';

            // 1. OUT Transaction (خروج از کالای مبدا)
            const txOut: WarehouseTransaction = {
                id: generateUUID(),
                type: 'OUT',
                date: txDateIso,
                company: selectedCompany,
                number: nextNum,
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
                approvedBy: currentUser.fullName
            };

            // 2. IN Transaction (ورود به کالای مقصد)
            const txIn: WarehouseTransaction = {
                id: generateUUID(),
                type: 'IN',
                date: txDateIso,
                company: selectedCompany,
                number: 0,
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
                status: 'APPROVED'
            };

            await saveWarehouseTransaction(txOut);
            await saveWarehouseTransaction(txIn);

            onSuccess();
            onClose();
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto" dir="rtl">
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-2xl w-full max-w-3xl overflow-hidden my-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 p-6 text-white flex justify-between items-center relative">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                            <ArrowLeftRight className="text-indigo-200" size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black tracking-tight">انتقال موجودی بین کالاها</h3>
                                <span className="text-[10px] bg-amber-400/20 text-amber-200 border border-amber-400/40 px-2 py-0.5 rounded-full font-bold">ویژه مدیر / انبارگردانی</span>
                            </div>
                            <p className="text-xs text-indigo-200/80 mt-0.5 font-medium">جابجایی تعداد کارتن و وزن دلخواه از یک کالا به کالای دیگر جهت اصلاح موجودی و رفع مغایرت</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                    {errorMsg && (
                        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-xs font-bold animate-shake">
                            <AlertTriangle size={18} className="shrink-0" />
                            <span>{errorMsg}</span>
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
                                        انتقال کل موجودی
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

                            {/* Live Stock Source Stats */}
                            {sourceItemId && (
                                <div className="bg-white/80 dark:bg-gray-900/80 p-3 rounded-xl border border-rose-200/60 dark:border-rose-900/40 space-y-1.5 text-xs">
                                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                        <span>کارتن موجود در انبار:</span>
                                        <span className="font-mono font-black text-rose-600">{formatNumberString(sourceStock.quantity)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                        <span>وزن موجود در انبار:</span>
                                        <span className="font-mono font-black text-rose-600">{formatNumberString(sourceStock.weight)} KG</span>
                                    </div>
                                    {sourceAvgWeight > 0 && (
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

                            {/* Live Stock Destination Stats */}
                            {destItemId && (
                                <div className="bg-white/80 dark:bg-gray-900/80 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 space-y-1.5 text-xs">
                                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                        <span>کارتن فعلی در انبار:</span>
                                        <span className="font-mono font-black text-emerald-600">{formatNumberString(destStock.quantity)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                        <span>وزن فعلی در انبار:</span>
                                        <span className="font-mono font-black text-emerald-600">{formatNumberString(destStock.weight)} KG</span>
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
                                    {sourceStock.quantity > 0 && (
                                        <button 
                                            type="button" 
                                            onClick={() => setTransferQty(sourceStock.quantity.toString())}
                                            className="text-[10px] text-indigo-600 font-bold hover:underline"
                                        >
                                            تمام کارتن‌های مبدا ({formatNumberString(sourceStock.quantity)})
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
                                        {sourceStock.weight > 0 && (
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

                    {/* Preview Table of Changes */}
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
                                        <span className="font-mono font-black text-gray-800 dark:text-gray-200">{formatNumberString(sourceProjectedQty)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-500 text-[11px] mt-0.5">
                                        <span>وزن: {formatNumberString(sourceStock.weight)} ➔</span>
                                        <span className="font-mono font-black text-gray-800 dark:text-gray-200">{formatNumberString(sourceProjectedWeight)} KG</span>
                                    </div>
                                </div>

                                {/* Dest item after */}
                                <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                                    <div className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">{destItem.name} (مقصد)</div>
                                    <div className="flex justify-between text-gray-500 text-[11px]">
                                        <span>کارتن: {formatNumberString(destStock.quantity)} ➔</span>
                                        <span className="font-mono font-black text-emerald-600">{formatNumberString(destProjectedQty)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-500 text-[11px] mt-0.5">
                                        <span>وزن: {formatNumberString(destStock.weight)} ➔</span>
                                        <span className="font-mono font-black text-emerald-600">{formatNumberString(destProjectedWeight)} KG</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-5 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-white/5 flex flex-col sm:flex-row justify-end items-center gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-6 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-all"
                    >
                        انصراف
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmitTransfer}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <span>در حال ثبت اسناد...</span>
                        ) : (
                            <>
                                <CheckCircle2 size={16} />
                                <span>تایید و ثبت نهایی انتقال موجودی</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
