import React from 'react';
import { PurchaseRequest } from '../types';
import { formatDate } from '../constants';

interface Props {
    request: PurchaseRequest;
}

const BarcodeVisual = ({ value }: { value: string }) => {
    const s = value || 'PR-0000';
    const lines: boolean[] = [];
    for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        for (let j = 0; j < 8; j++) {
            lines.push(((code >> j) & 1) === 1);
        }
    }
    return (
        <div className="flex flex-col items-center bg-white p-2 rounded border border-black w-full">
            <div className="flex items-stretch h-8 px-1 gap-[1.5px] bg-white w-full justify-center">
                {lines.slice(0, 48).map((isBlack, idx) => (
                    <div key={idx} className={`w-[2px] h-full ${isBlack ? 'bg-black' : 'bg-transparent'}`} />
                ))}
            </div>
            <span className="text-[10px] font-mono tracking-widest font-black mt-1 text-black uppercase">{s}</span>
        </div>
    );
};

const PrintPurchaseBarcode: React.FC<Props> = ({ request }) => {
    const itemsList = request.items && request.items.length > 0 ? request.items : [
        {
            id: '1',
            itemCode: request.itemCodeAssigned || `PR-${request.requestNumber}`,
            itemName: request.itemName,
            quantity: request.quantity,
            unit: request.unit,
            specifications: request.specifications || ''
        }
    ];

    return (
        <div className="bg-white p-6 w-full text-black font-sans dir-rtl text-right print-p-0 printable-barcode" dir="rtl">
            <div className="border-4 border-black p-4 mb-6 bg-gray-50 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-black text-black">برچسب بارکد و ردیابی درخواست خرید</h1>
                    <p className="text-xs font-bold text-gray-700">شماره درخواست: PR-{request.requestNumber} | تاریخ: {formatDate(request.date)}</p>
                    <p className="text-xs font-bold text-gray-700">واحد درخواست‌کننده: {request.requestingUnit || 'عمومی'} ({request.requester})</p>
                </div>
                <div className="w-56">
                    <BarcodeVisual value={`PR-${request.requestNumber}`} />
                </div>
            </div>

            <div className="mb-4">
                <h2 className="text-sm font-black mb-2 border-b-2 border-black pb-1">لیست برچسب‌های بارکد اقلام (Barcode Labels):</h2>
                <div className="grid grid-cols-2 gap-4">
                    {itemsList.map((item, idx) => {
                        const codeVal = item.itemCode && item.itemCode !== '---' ? item.itemCode : `PR-${request.requestNumber}-${idx + 1}`;
                        return (
                            <div key={item.id || idx} className="border-2 border-black p-3 bg-white rounded flex flex-col justify-between space-y-2">
                                <div className="flex justify-between items-start border-b border-gray-300 pb-1">
                                    <div>
                                        <span className="text-[10px] font-black bg-black text-white px-1.5 py-0.5 rounded ml-1"># {idx + 1}</span>
                                        <span className="text-xs font-black">{item.itemName}</span>
                                    </div>
                                    <span className="text-xs font-black border border-black px-1.5 py-0.5 bg-gray-100">
                                        {item.quantity} {item.unit}
                                    </span>
                                </div>
                                {item.specifications && (
                                    <p className="text-[10px] text-gray-700 truncate font-mono">{item.specifications}</p>
                                )}
                                <BarcodeVisual value={codeVal} />
                                <div className="flex justify-between text-[8px] font-bold text-gray-500 font-mono">
                                    <span>PR NO: {request.requestNumber}</span>
                                    <span>DATE: {formatDate(request.date)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page { size: A4 portrait; margin: 10mm; }
                    body { visibility: hidden; background: white !important; }
                    .printable-barcode, .printable-barcode * { visibility: visible; }
                    .printable-barcode { position: absolute; left: 0; top: 0; width: 100%; }
                }
            `}} />
        </div>
    );
};

export default PrintPurchaseBarcode;
