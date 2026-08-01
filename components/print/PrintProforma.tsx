
import React from 'react';
import { TradeRecord, SystemSettings } from '../../types';
import { formatNumberString, formatCurrency } from '../../constants';

interface PrintProformaProps {
  record: TradeRecord;
  settings: SystemSettings | null;
}

const PrintProforma: React.FC<PrintProformaProps> = ({ record, settings }) => {
  const totalWeight = record.items.reduce((sum, item) => sum + item.weight, 0);
  const totalAmount = record.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const company = settings?.companies?.find(c => c.name === record.company);

  return (
    <div className="p-8 bg-white text-gray-900 h-full flex flex-col font-sans" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-gray-900">پیش‌فاکتور (Proforma Invoice)</h1>
          <p className="text-sm font-bold text-gray-600">شرکت {record.company}</p>
        </div>
        {company?.logo && <img src={company.logo} alt="Logo" className="h-16 w-auto object-contain" />}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
        <div className="space-y-2 border p-4 rounded-lg bg-gray-50">
          <div className="flex justify-between"><span className="font-bold">فروشنده:</span> <span>{record.sellerName}</span></div>
          <div className="flex justify-between"><span className="font-bold">شماره پرونده:</span> <span className="font-mono">{record.fileNumber}</span></div>
          <div className="flex justify-between"><span className="font-bold">تاریخ:</span> <span>{new Date(record.createdAt).toLocaleDateString('fa-IR')}</span></div>
        </div>
        <div className="space-y-2 border p-4 rounded-lg bg-gray-50">
          <div className="flex justify-between"><span className="font-bold">ارز پایه:</span> <span>{record.mainCurrency}</span></div>
          <div className="flex justify-between"><span className="font-bold">شماره ثبت سفارش:</span> <span className="font-mono">{record.registrationNumber || '-'}</span></div>
          <div className="flex justify-between"><span className="font-bold">بانک عامل:</span> <span>{record.operatingBank || '-'}</span></div>
        </div>
      </div>

      {/* Items Table */}
      <div className="flex-1 overflow-hidden border rounded-xl mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="p-3 text-right">شرح کالا</th>
              <th className="p-3 text-center">کد تعرفه (HS)</th>
              <th className="p-3 text-center">وزن (KG)</th>
              <th className="p-3 text-center">فی ({record.mainCurrency})</th>
              <th className="p-3 text-left">جمع کل ({record.mainCurrency})</th>
            </tr>
          </thead>
          <tbody className="divide-y border-b">
            {record.items.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-3 font-bold">{item.name}</td>
                <td className="p-3 text-center font-mono">{item.hsCode || '-'}</td>
                <td className="p-3 text-center font-mono">{formatNumberString(item.weight)}</td>
                <td className="p-3 text-center font-mono">{formatNumberString(item.unitPrice)}</td>
                <td className="p-3 text-left font-mono font-black">{formatNumberString(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100 font-black">
            <tr>
              <td className="p-3" colSpan={2}>جمع کل</td>
              <td className="p-3 text-center font-mono">{formatNumberString(totalWeight)}</td>
              <td></td>
              <td className="p-3 text-left font-mono text-blue-700">{formatNumberString(totalAmount)} {record.mainCurrency}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer / Notes */}
      <div className="grid grid-cols-2 gap-8 text-[11px] text-gray-500 border-t pt-4">
        <div>
          <h4 className="font-bold text-gray-700 mb-2 underline">شرایط و ملاحظات</h4>
          <p>۱. تمامی مبالغ بر اساس ارز پایه {record.mainCurrency} محاسبه شده است.</p>
          <p>۲. مسئولیت صحت کدهای تعرفه بر عهده واحد بازرگانی می‌باشد.</p>
          <p>۳. این سند فاقد ارزش مالیاتی بوده و صرفاً جهت امور بانکی و ثبت سفارش صادر شده است.</p>
        </div>
        <div className="flex flex-col items-center justify-center border-r pr-8">
          <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center text-gray-300 transform rotate-12">
            محل مهر و امضا
          </div>
          <p className="mt-2 font-bold text-gray-700">مدیر بازرگانی</p>
        </div>
      </div>
      
      {company?.address && (
        <div className="mt-8 text-[10px] text-center text-gray-400 border-t pt-2">
          {company.address} | تلفن: {company.phone}
        </div>
      )}
    </div>
  );
};

export default PrintProforma;
