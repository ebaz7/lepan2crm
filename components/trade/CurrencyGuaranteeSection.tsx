import React, { useState } from 'react';
import { ShieldCheck, Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { formatNumberString, deformatNumberString, formatCurrency } from '../../constants';

interface GuaranteeCheque {
    amount: number;
    bank: string;
    chequeNumber: string;
    dueDate: string;
    isDelivered?: boolean;
}

interface Props {
    guarantees: GuaranteeCheque[];
    onAdd: (g: GuaranteeCheque) => void;
    onDelete: (index: number) => void;
    onToggleDelivery: (index: number) => void;
    companyBanks: string[];
}

const CurrencyGuaranteeSection: React.FC<Props> = ({ 
    guarantees = [], 
    onAdd, 
    onDelete, 
    onToggleDelivery,
    companyBanks 
}) => {
    const [chequeNumber, setChequeNumber] = useState('');
    const [chequeBank, setChequeBank] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [dueDate, setDueDate] = useState('');

    const handleLocalAdd = () => {
        if (!chequeNumber.trim()) {
            alert('لطفاً شماره چک را وارد نمایید.');
            return;
        }
        if (!chequeBank) {
            alert('لطفاً نام بانک را انتخاب نمایید.');
            return;
        }
        const numericAmount = deformatNumberString(amountStr);
        if (numericAmount <= 0) {
            alert('لطفاً مبلغ معتبری وارد نمایید.');
            return;
        }

        onAdd({
            chequeNumber: chequeNumber.trim(),
            bank: chequeBank,
            amount: numericAmount,
            dueDate: dueDate.trim() || '-',
            isDelivered: false
        });

        // Reset state
        setChequeNumber('');
        setChequeBank('');
        setAmountStr('');
        setDueDate('');
    };

    return (
        <div id="currency-guarantees-management" className="glass-panel p-6 rounded-xl shadow-sm border space-y-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm md:text-base">
                <ShieldCheck size={20} className="text-purple-600"/> 
                چک‌های ضمانت ارزی ثبت‌شده (رفع تعهد)
            </h3>
            
            {/* Input fields form */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">شماره چک *</label>
                    <input 
                        type="text"
                        placeholder="شماره چک ضمانت..."
                        className="w-full border rounded-lg p-2 text-xs md:text-sm dir-ltr outline-none bg-white font-heavy focus:border-purple-500" 
                        value={chequeNumber} 
                        onChange={e => setChequeNumber(e.target.value)} 
                    />
                </div>
                
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">نام بانک (شرکت) *</label>
                    <select 
                        className="w-full border rounded-lg p-2 text-xs md:text-sm outline-none bg-white font-heavy cursor-pointer focus:border-purple-500" 
                        value={chequeBank} 
                        onChange={e => setChequeBank(e.target.value)}
                    >
                        <option value="">انتخاب کنید...</option>
                        {companyBanks.length > 0 ? (
                            companyBanks.map((b, idx) => (
                                <option key={`${b}-${idx}`} value={b}>{b}</option>
                            ))
                        ) : (
                            <option disabled>بانکی تعریف نشده است</option>
                        )}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">مبلغ چک (ریال) *</label>
                    <input 
                        type="text"
                        placeholder="مبلغ به ریال"
                        className="w-full border rounded-lg p-2 text-xs md:text-sm dir-ltr outline-none bg-white font-mono focus:border-purple-500 font-bold text-purple-700" 
                        value={amountStr} 
                        onChange={e => setAmountStr(formatNumberString(deformatNumberString(e.target.value).toString()))} 
                    />
                </div>
                
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">تاریخ سررسید</label>
                    <input 
                        type="text"
                        className="w-full border rounded-lg p-2 text-xs md:text-sm dir-ltr outline-none bg-white focus:border-purple-500" 
                        placeholder="1403/xx/xx" 
                        value={dueDate} 
                        onChange={e => setDueDate(e.target.value)} 
                    />
                </div>
                
                <button 
                    type="button"
                    onClick={handleLocalAdd} 
                    className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white p-2 rounded-lg text-xs md:text-sm font-heavy h-[38px] flex items-center justify-center gap-1 transition-all shadow-sm shadow-purple-600/10"
                >
                    <Plus size={16} /> ثبت و ایجاد ردیف
                </button>
            </div>

            {/* List / Table of added guarantees */}
            <div className="border border-slate-100 rounded-xl overflow-hidden mt-4">
                <table className="w-full text-right text-xs">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-extrabold select-none">
                            <th className="p-3 text-center w-12">ردیف</th>
                            <th className="p-3 text-center">شماره چک</th>
                            <th className="p-3 text-center">بانک</th>
                            <th className="p-3 text-center">مبلغ ضمانت (ریال)</th>
                            <th className="p-3 text-center">تاریخ سررسید</th>
                            <th className="p-3 text-center">وضعیت تسویه</th>
                            <th className="p-3 text-center w-16">حذف</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {guarantees.map((item, index) => (
                            <tr key={`${item.chequeNumber}_${index}`} className="hover:bg-slate-50/50 text-slate-800">
                                <td className="p-3 text-center font-bold text-slate-400">{index + 1}</td>
                                <td className="p-3 text-center font-mono font-bold">{item.chequeNumber}</td>
                                <td className="p-3 text-center font-bold text-slate-700">{item.bank}</td>
                                <td className="p-3 text-center font-mono font-semibold text-purple-700">{formatCurrency(item.amount)}</td>
                                <td className="p-3 text-center font-mono text-slate-500">{item.dueDate || '-'}</td>
                                <td className="p-3 text-center select-none">
                                    <button
                                        type="button"
                                        onClick={() => onToggleDelivery(index)}
                                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black transition-all ${
                                            item.isDelivered 
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200' 
                                                : 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
                                        }`}
                                    >
                                        {item.isDelivered ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                                        {item.isDelivered ? 'عودت داده شد (رفع تعهد)' : 'نزد سازمان (در جریان)'}
                                    </button>
                                </td>
                                <td className="p-3 text-center">
                                    <button 
                                        type="button"
                                        onClick={() => onDelete(index)} 
                                        className="text-red-500 hover:text-red-700 transition-colors p-1 hover:bg-red-50 rounded"
                                        title="حذف ضمانت‌نامه"
                                    >
                                        <Trash2 size={15}/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {guarantees.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-slate-400 font-extrabold text-xs">
                                    هیچ چک ضمانت ارزی ثبت نشده است. اطلاعات چک را بالا وارد کنید و ثبت نمایید.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CurrencyGuaranteeSection;
