import React from 'react';
import { PurchaseRequest, PurchaseProforma } from '../types';
import { formatDate, formatCurrency } from '../constants';

interface Props {
    request: PurchaseRequest;
    proforma: PurchaseProforma;
}

const PrintPurchaseProforma: React.FC<Props> = ({ request, proforma }) => {
    return (
        <div className="bg-white p-6 w-full h-full text-black print-only-section font-serif" dir="rtl" style={{ direction: 'rtl' }}>
            {/* Header */}
            <div className="border-2 border-black p-4 mb-4 flex justify-between items-center relative">
                <div className="w-1/3 text-right">
                    <p className="text-[12px] font-bold">شماره درخواست: {request.requestNumber}</p>
                    <p className="text-[12px] font-bold">شماره پیش‌فاکتور: {proforma.number}</p>
                    <p className="text-[12px] font-bold">تاریخ: {formatDate(proforma.date)}</p>
                </div>
                <div className="w-1/3 text-center">
                    <h1 className="text-xl font-black border-b-2 border-black inline-block pb-1">پیش‌فاکتور خرید کالا</h1>
                    <p className="text-[10px] mt-1 font-bold">تامین‌کننده: {proforma.vendorName}</p>
                </div>
                <div className="w-1/3 text-left">
                    <div className="border border-black p-2 rounded text-[10px] inline-block">
                         A5 Landscape
                    </div>
                </div>
            </div>

            {/* Vendor Info */}
            <div className="grid grid-cols-2 gap-4 mb-4 border border-black p-2 text-[12px]">
                <div className="flex gap-2">
                    <span className="font-bold">فروشنده:</span>
                    <span>{proforma.vendorName}</span>
                </div>
                <div className="flex gap-2">
                    <span className="font-bold">تلفن:</span>
                    <span>{proforma.vendorPhone || '-'}</span>
                </div>
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse border border-black mb-4">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-black p-1 text-[11px] w-10">ردیف</th>
                        <th className="border border-black p-1 text-[11px]">شرح کالا / خدمات</th>
                        <th className="border border-black p-1 text-[11px] w-16">تعداد</th>
                        <th className="border border-black p-1 text-[11px] w-16">واحد</th>
                        <th className="border border-black p-1 text-[11px] w-24">فی (ریال)</th>
                        <th className="border border-black p-1 text-[11px] w-32">جمع کل (ریال)</th>
                    </tr>
                </thead>
                <tbody>
                    {proforma.items && proforma.items.length > 0 ? (
                        proforma.items.map((item, idx) => (
                            <tr key={item.id}>
                                <td className="border border-black p-1 text-center text-[10px]">{idx + 1}</td>
                                <td className="border border-black p-1 text-right text-[10px]">{item.description}</td>
                                <td className="border border-black p-1 text-center text-[10px]">{item.quantity}</td>
                                <td className="border border-black p-1 text-center text-[10px]">{item.unit}</td>
                                <td className="border border-black p-1 text-center text-[10px]">{formatCurrency(item.unitPrice)}</td>
                                <td className="border border-black p-1 text-center text-[10px] font-bold">{formatCurrency(item.totalPrice)}</td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td className="border border-black p-1 text-center text-[10px]">۱</td>
                            <td className="border border-black p-1 text-right text-[10px]">{request.itemName}</td>
                            <td className="border border-black p-1 text-center text-[10px]">{request.quantity}</td>
                            <td className="border border-black p-1 text-center text-[10px]">{request.unit}</td>
                            <td className="border border-black p-1 text-center text-[10px]">-</td>
                            <td className="border border-black p-1 text-center text-[10px] font-bold">{formatCurrency(proforma.totalAmount)}</td>
                        </tr>
                    )}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={5} className="border border-black p-1 text-left font-bold text-[11px]">جمع کل:</td>
                        <td className="border border-black p-1 text-center font-black text-[11px] underline">{formatCurrency(proforma.totalAmount)}</td>
                    </tr>
                </tfoot>
            </table>

            {/* Approvals */}
            <div className="grid grid-cols-3 gap-4 mt-8">
                <div className="text-center">
                    <p className="text-[11px] font-bold mb-10">تنظیم‌کننده</p>
                    <p className="text-[10px] border-t border-black pt-1">{proforma.registeredBy || request.approverCommercial || '-'}</p>
                </div>
                <div className="text-center">
                    <p className="text-[11px] font-bold mb-10">مدیر بازرگانی</p>
                    <p className="text-[10px] border-t border-black pt-1">{request.approverCommercial || '-'}</p>
                </div>
                <div className="text-center">
                    <p className="text-[11px] font-bold mb-10">مدیر عامل / مدیر کارخانه</p>
                    <p className="text-[10px] border-t border-black pt-1">{request.approverCeoSelection || request.approverFactorySelection || '-'}</p>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page { size: A5 landscape; margin: 0; }
                    body { visibility: hidden !important; margin: 0 !important; }
                    .print-only-section {
                        visibility: visible !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        margin: 0 !important;
                        padding: 10mm !important;
                        background: white !important;
                    }
                }
            `}} />
        </div>
    );
};

export default PrintPurchaseProforma;
