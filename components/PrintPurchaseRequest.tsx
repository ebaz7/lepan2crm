import React from 'react';
import { PurchaseRequest } from '../types';
import { formatDate } from '../constants';

interface Props {
    request: PurchaseRequest;
}

const BarcodeSvg: React.FC<{ value: string }> = ({ value }) => {
    const s = value || 'PR-0000';
    const lines: boolean[] = [];
    for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        for (let j = 0; j < 8; j++) {
            lines.push(((code >> j) & 1) === 1);
        }
    }
    return (
        <div className="flex flex-col items-center justify-center p-1 bg-white border border-black">
            <div className="flex items-stretch h-6 px-1 gap-[1px] bg-white">
                {lines.slice(0, 42).map((isBlack, idx) => (
                    <div key={idx} className={`w-[2px] h-full ${isBlack ? 'bg-black' : 'bg-transparent'}`} />
                ))}
            </div>
            <span className="text-[8px] font-mono tracking-widest font-bold mt-0.5 text-black uppercase">{s.slice(0, 16)}</span>
        </div>
    );
};

const PrintPurchaseRequest: React.FC<Props> = ({ request }) => {
    const itemsList = request.items && request.items.length > 0 ? request.items : [
        {
            id: '1',
            itemCode: request.itemCodeAssigned || '---',
            itemName: request.itemName,
            quantity: request.quantity,
            unit: request.unit,
            suggestedBrand: '---',
            specifications: request.specifications || '---'
        }
    ];

    return (
        <div className="bg-white p-6 w-full h-full text-black print-only-section font-serif" dir="rtl" style={{ direction: 'rtl' }}>
            <div className="border-4 border-double border-black p-4 mb-4 flex justify-between items-center text-center bg-gray-50/50">
                <div className="w-1/3 text-right space-y-1">
                    <p className="text-[12px] font-bold">شماره درخواست: <span className="font-mono">{request.requestNumber}</span></p>
                    <p className="text-[12px] font-bold">تاریخ: {formatDate(request.date)}</p>
                    {request.repairRequestNumber && (
                        <p className="text-[11px] font-bold text-gray-700">کد درخواست تعمیر/نت: {request.repairRequestNumber}</p>
                    )}
                </div>
                <div className="w-1/3 flex flex-col items-center">
                    <h2 className="text-xl font-black border-b-2 border-black inline-block pb-1">فرم درخواست خرید قطعه / کالا (BPMN)</h2>
                    <p className="text-[10px] font-bold mt-1">سامانه جامع تدارکات و بازرگانی کارخانه</p>
                </div>
                <div className="w-1/3 text-left flex flex-col items-end gap-1">
                    <BarcodeSvg value={`PR-${request.requestNumber}`} />
                    <div className="border-2 border-black px-2 py-0.5 font-black text-xs inline-block">
                        فوریت: <span className={request.urgency === 'اضطراری' ? 'text-red-600 underline' : ''}>{request.urgency || 'عادی'}</span>
                    </div>
                </div>
            </div>

            {/* Header info bar */}
            <div className="grid grid-cols-4 gap-2 border-2 border-black p-2 mb-4 text-xs font-bold bg-gray-100">
                <div>واحد درخواست‌کننده: <span className="font-normal">{request.requestingUnit || '---'}</span></div>
                <div>دستگاه / ماشین‌آلات: <span className="font-normal">{request.machinery || '---'}</span></div>
                <div>محل نصب: <span className="font-normal">{request.installationLocation || '---'}</span></div>
                <div>درخواست‌کننده: <span className="font-normal">{request.requester}</span></div>
            </div>

            {/* Reason / Breakdown info */}
            {(request.breakdownDescription || request.purchaseReason) && (
                <div className="border border-black p-2 mb-4 text-xs bg-gray-50">
                    {request.breakdownDescription && (
                        <div className="mb-1"><span className="font-bold">شرح خرابی/حادثه: </span>{request.breakdownDescription}</div>
                    )}
                    {request.purchaseReason && (
                        <div><span className="font-bold">علت درخواست خرید: </span>{request.purchaseReason}</div>
                    )}
                </div>
            )}

            <table className="w-full border-collapse border-2 border-black mb-4">
                <thead>
                    <tr className="bg-gray-200 text-[11px]">
                        <th className="border border-black p-2 font-bold w-12 text-center">ردیف</th>
                        <th className="border border-black p-2 font-bold w-24 text-center">کد کالا</th>
                        <th className="border border-black p-2 font-bold text-right">نام قطعه / شرح کالا</th>
                        <th className="border border-black p-2 font-bold w-28 text-center">برند پیشنهادی</th>
                        <th className="border border-black p-2 font-bold w-16 text-center">تعداد</th>
                        <th className="border border-black p-2 font-bold w-16 text-center">واحد</th>
                        <th className="border border-black p-2 font-bold text-right">مشخصات فنی</th>
                    </tr>
                </thead>
                <tbody>
                    {itemsList.map((item, idx) => (
                        <tr key={item.id || idx} className="text-xs">
                            <td className="border border-black p-2 text-center font-bold">{idx + 1}</td>
                            <td className="border border-black p-2 text-center font-mono">{item.itemCode || '---'}</td>
                            <td className="border border-black p-2 font-black">{item.itemName}</td>
                            <td className="border border-black p-2 text-center">{item.suggestedBrand || '---'}</td>
                            <td className="border border-black p-2 text-center font-black text-sm">{item.quantity}</td>
                            <td className="border border-black p-2 text-center">{item.unit}</td>
                            <td className="border border-black p-2">{item.specifications || '---'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="border border-black p-3 mb-4 bg-gray-50/30">
                <h3 className="text-[11px] font-black underline mb-1">ملاحظات و وضعیت گردش فرآیند (Status):</h3>
                <p className="text-[12px] leading-relaxed py-1 font-bold text-indigo-900">وضعیت فعلی: {request.status}</p>
                {request.rejectionReason && (
                    <p className="text-xs text-red-600 font-bold">علت رد/توقف: {request.rejectionReason}</p>
                )}
                {request.returnReason && (
                    <p className="text-xs text-amber-700 font-bold">علت عودت جهت اصلاح: {request.returnReason}</p>
                )}
            </div>

            {/* Approval sign boxes */}
            <div className="grid grid-cols-5 gap-2 text-center mt-auto text-[10px]">
                <div className="border border-black p-2">
                    <h4 className="font-black mb-6">ثبت درخواست / انبار</h4>
                    <p className="border-t border-black/20 pt-1 font-bold">{request.requester}</p>
                </div>
                <div className="border border-black p-2">
                    <h4 className="font-black mb-6">بررسی فنی / نت</h4>
                    <p className="border-t border-black/20 pt-1 font-bold">{request.approverTechnical || '-'}</p>
                </div>
                <div className="border border-black p-2">
                    <h4 className="font-black mb-6">مدیر کارخانه</h4>
                    <p className="border-t border-black/20 pt-1 font-bold">{request.approverFactory || '-'}</p>
                </div>
                <div className="border border-black p-2">
                    <h4 className="font-black mb-6">مدیرعامل / بازرگانی</h4>
                    <p className="border-t border-black/20 pt-1 font-bold">{request.approverCeoSelection || request.approverCommercial || '-'}</p>
                </div>
                <div className="border border-black p-2">
                    <h4 className="font-black mb-6">رسید انبار و تحویل</h4>
                    <p className="border-t border-black/20 pt-1 font-bold">{request.approverWarehouseReceipt || '-'}</p>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page { size: A4 portrait; margin: 10mm; }
                    body {
                        visibility: hidden !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
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

export default PrintPurchaseRequest;
