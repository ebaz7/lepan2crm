import React from 'react';
import { PurchaseRequest } from '../types';
import { formatDate } from '../constants';

interface Props {
    request: PurchaseRequest;
}

const PrintWarehouseReceipt: React.FC<Props> = ({ request }) => {
    return (
        <div className="bg-white p-6 w-full h-full text-black print-only-section font-serif" dir="rtl" style={{ direction: 'rtl' }}>
            {/* Header */}
            <div className="border-4 border-double border-black p-4 mb-4 flex justify-between items-center bg-gray-50">
                <div className="w-1/4 text-right">
                    <p className="text-[12px] font-bold">شماره رسید: {request.warehouseReceiptNumber || '---'}</p>
                    <p className="text-[12px] font-bold">تاریخ: {request.warehouseReceiptDate ? formatDate(request.warehouseReceiptDate) : formatDate(getCurrentDate())}</p>
                    <p className="text-[10px] font-bold">عطف به: {request.requestNumber}</p>
                </div>
                <div className="w-2/4 text-center">
                    <h1 className="text-2xl font-black mb-1">رسید انبار کالا</h1>
                    <p className="text-[11px] font-bold">شرکت خدماتی و تولیدی کارخانه</p>
                </div>
                <div className="w-1/4 text-left">
                    <div className="border-2 border-black p-2 font-black text-sm inline-block">
                        A5 LANDSCAPE
                    </div>
                </div>
            </div>

            {/* Delivery Details */}
            <div className="grid grid-cols-3 gap-2 border border-black p-3 mb-4 text-[13px] bg-gray-50/30">
                <div><span className="font-bold">تحویل دهنده:</span> {request.proformas.find(p => p.isChosen)?.vendorName || '-'}</div>
                <div><span className="font-bold">محل خرید:</span> {request.location === 'Tehran' ? 'دفتر تهران' : 'کارخانه'}</div>
                <div><span className="font-bold">نحوه ورود:</span> انتظامات</div>
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse border-2 border-black mb-6">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="border border-black p-2 text-[12px] w-12">ردیف</th>
                        <th className="border border-black p-2 text-[12px] w-32">کد کالا</th>
                        <th className="border border-black p-2 text-[12px]">شرح کامل قطعه / کالا</th>
                        <th className="border border-black p-2 text-[12px] w-20">تعداد</th>
                        <th className="border border-black p-2 text-[12px] w-20">واحد</th>
                        <th className="border border-black p-2 text-[12px] w-32">ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="h-16">
                        <td className="border border-black p-2 text-center text-sm font-bold">۱</td>
                        <td className="border border-black p-2 text-center text-sm font-mono">{request.id.substring(0, 8).toUpperCase()}</td>
                        <td className="border border-black p-2 text-right text-sm px-4">
                            <span className="font-black">{request.itemName}</span>
                            <p className="text-[10px] mt-1 text-gray-600 leading-relaxed">{request.specifications}</p>
                        </td>
                        <td className="border border-black p-2 text-center text-[16px] font-black">{request.entryQuantity || request.quantity}</td>
                        <td className="border border-black p-2 text-center text-sm">{request.unit}</td>
                        <td className="border border-black p-2 text-center text-[10px]">{request.qcResult === 'تایید' ? 'تایید QC' : '-'}</td>
                    </tr>
                </tbody>
            </table>

            {/* Approvals and Signatures */}
            <div className="grid grid-cols-4 gap-4 text-center mt-auto border-t-2 border-black pt-4">
                <div>
                    <h4 className="text-[12px] font-black mb-12">تحویل دهنده</h4>
                    <div className="h-0.5 bg-black/10 mx-4"></div>
                </div>
                <div>
                    <h4 className="text-[12px] font-black mb-12">انباردار</h4>
                    <p className="text-[10px] font-bold">{request.approverWarehouseReceipt || '-'}</p>
                </div>
                <div>
                    <h4 className="text-[12px] font-black mb-12">کنترل کیفی (QC)</h4>
                    <p className="text-[10px] font-bold">{request.approverQc || '-'}</p>
                </div>
                <div>
                    <h4 className="text-[12px] font-black mb-12">تایید نهایی مدیر کارخانه</h4>
                    <p className="text-[10px] font-bold">{request.approverFactoryArchive || '-'}</p>
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

function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

export default PrintWarehouseReceipt;
