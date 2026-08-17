import React from 'react';
import { ExitPermit, ExitPermitItem } from '../types';

export interface SayanRemittanceData {
  companyTitle?: string;
  remittanceNumber: string | number;
  subCode?: string | number;
  archiveCode?: string | number;
  shamsiDate: string;
  recipientName: string;
  recipientCode?: string;
  tafsiliCode?: string;
  recipientAddress?: string;
  recipientPhone?: string;
  items: {
    rowNo?: number;
    goodsName: string;
    netQty: number; // مقدار خالص
    grossQty: number; // مقدار ناخالص
    cartonCount: number; // تعداد کارتن
    bobbinCount: number; // تعداد بوبین
    grade?: string; // گرید (AA, A, ...)
    twistDirection?: string; // جهت تاب (Z, S, ...)
    description?: string;
  }[];
  notes?: string;
  creatorName?: string;
  warehouseKeeperName?: string;
  managerName?: string;
  securityGuardName?: string;
  exitTime?: string;
}

interface Props {
  data: SayanRemittanceData;
  id?: string;
  showStamps?: boolean;
}

const SayanSalesRemittanceDoc: React.FC<Props> = ({
  data,
  id = 'sayan-sales-remittance-doc',
  showStamps = true,
}) => {
  const totalNet = data.items.reduce((sum, i) => sum + (Number(i.netQty) || 0), 0);
  const totalGross = data.items.reduce((sum, i) => sum + (Number(i.grossQty) || 0), 0);
  const totalCartons = data.items.reduce((sum, i) => sum + (Number(i.cartonCount) || 0), 0);
  const totalBobbins = data.items.reduce((sum, i) => sum + (Number(i.bobbinCount) || 0), 0);

  return (
    <div
      id={id}
      className="bg-white text-black p-8 font-sans border border-gray-300 shadow-sm mx-auto select-none"
      style={{
        width: '820px',
        minHeight: '1080px',
        boxSizing: 'border-box',
        direction: 'rtl',
        fontFamily: 'Vazirmatn, Tahoma, Arial, sans-serif',
        color: '#111827',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Top Header */}
      <div className="border-b-2 border-black pb-4 mb-4">
        <div className="flex justify-between items-start">
          {/* Right Header Metadata */}
          <div className="w-1/3 text-right space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-700">شماره:</span>
              <span className="font-mono font-black text-sm tracking-wider">{data.remittanceNumber || '---'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-700">نام شخص:</span>
              <span className="font-black text-xs text-gray-900">{data.recipientName || '---'}</span>
            </div>
            {data.recipientCode && (
              <div className="flex items-center gap-1.5 text-[10px] text-gray-600 font-mono">
                <span>کد شخص / تفصیلی:</span>
                <span className="font-bold">{data.recipientCode}</span>
                {data.tafsiliCode && <span>({data.tafsiliCode})</span>}
              </div>
            )}
          </div>

          {/* Center Brand Title */}
          <div className="w-1/3 text-center">
            <h1 className="text-xl font-black tracking-tight text-gray-900 mb-1">
              {data.companyTitle || 'شرکت لپان بافت'}
            </h1>
            <div className="inline-block bg-gray-100 px-4 py-0.5 rounded border border-gray-400 font-black text-base tracking-wide text-gray-900">
              حواله فروش
            </div>
            <p className="text-[9px] text-gray-600 mt-2 font-medium leading-tight">
              آدرس: تهران - خیام شمالی - بازار آل یاسین - کوچه شیریها - پلاک ۲۹
            </p>
          </div>

          {/* Left Document Details */}
          <div className="w-1/3 text-left space-y-1.5 text-xs font-mono">
            <div className="flex justify-end gap-1.5">
              <span className="font-sans font-bold text-gray-700">تاریخ:</span>
              <span className="font-bold">{data.shamsiDate || '---'}</span>
            </div>
            <div className="flex justify-end gap-1.5">
              <span className="font-sans font-bold text-gray-700">کد فرعی:</span>
              <span className="font-bold">{data.subCode || '---'}</span>
            </div>
            <div className="flex justify-end gap-1.5">
              <span className="font-sans font-bold text-gray-700">کد بایگانی:</span>
              <span className="font-bold">{data.archiveCode || '---'}</span>
            </div>
            <div className="flex justify-end text-[10px] text-gray-500">
              <span>صفحه ۱ از ۱</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="border border-black overflow-hidden mb-4">
        <table className="w-full text-xs text-center border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-black text-gray-900 font-bold">
              <th className="py-2.5 px-2 border-l border-black w-10">ردیف</th>
              <th className="py-2.5 px-3 border-l border-black text-right">نام کالا</th>
              <th className="py-2.5 px-2 border-l border-black w-24">مقدار خالص</th>
              <th className="py-2.5 px-2 border-l border-black w-24">مقدار ناخالص</th>
              <th className="py-2.5 px-2 border-l border-black w-20">تعداد کارتن</th>
              <th className="py-2.5 px-2 border-l border-black w-20">تعداد بوبین</th>
              <th className="py-2.5 px-2 border-l border-black w-16">گرید</th>
              <th className="py-2.5 px-2 border-l border-black w-16">جهت تاب</th>
              <th className="py-2.5 px-2 w-32">توضیحات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300">
            {data.items && data.items.length > 0 ? (
              data.items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-300 hover:bg-gray-50/50">
                  <td className="py-2.5 px-2 border-l border-black font-mono font-bold text-gray-600">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3 border-l border-black text-right font-bold text-gray-900">
                    {item.goodsName || '---'}
                  </td>
                  <td className="py-2.5 px-2 border-l border-black font-mono font-black text-gray-900">
                    {Number(item.netQty || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                  </td>
                  <td className="py-2.5 px-2 border-l border-black font-mono font-bold text-gray-800">
                    {Number(item.grossQty || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                  </td>
                  <td className="py-2.5 px-2 border-l border-black font-mono font-bold text-gray-800">
                    {item.cartonCount || 0}
                  </td>
                  <td className="py-2.5 px-2 border-l border-black font-mono font-bold text-gray-800">
                    {item.bobbinCount || 0}
                  </td>
                  <td className="py-2.5 px-2 border-l border-black font-bold text-gray-700">
                    {item.grade || 'AA'}
                  </td>
                  <td className="py-2.5 px-2 border-l border-black font-bold text-gray-700">
                    {item.twistDirection || 'Z'}
                  </td>
                  <td className="py-2.5 px-2 text-right text-[10px] text-gray-600">
                    {item.description || '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="py-6 text-center text-gray-400 font-bold">
                  بدون ردیف کالا
                </td>
              </tr>
            )}

            {/* Empty padding rows to maintain authentic official look if items < 4 */}
            {data.items && data.items.length > 0 && data.items.length < 4 && (
              Array.from({ length: 4 - data.items.length }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-gray-200 h-8">
                  <td className="border-l border-black"></td>
                  <td className="border-l border-black"></td>
                  <td className="border-l border-black"></td>
                  <td className="border-l border-black"></td>
                  <td className="border-l border-black"></td>
                  <td className="border-l border-black"></td>
                  <td className="border-l border-black"></td>
                  <td className="border-l border-black"></td>
                  <td></td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 border-t-2 border-black font-black text-gray-900 text-xs">
              <td colSpan={2} className="py-3 px-4 border-l border-black text-left font-bold">
                جمع کل:
              </td>
              <td className="py-3 px-2 border-l border-black font-mono text-sm font-black text-blue-900">
                {Number(totalNet.toFixed(3)).toLocaleString('en-US')}
              </td>
              <td className="py-3 px-2 border-l border-black font-mono text-sm font-black text-green-900">
                {Number(totalGross.toFixed(3)).toLocaleString('en-US')}
              </td>
              <td className="py-3 px-2 border-l border-black font-mono text-sm font-black">
                {totalCartons}
              </td>
              <td className="py-3 px-2 border-l border-black font-mono text-sm font-black">
                {totalBobbins}
              </td>
              <td colSpan={3} className="py-3 px-2 bg-gray-50 text-[10px] text-gray-500 font-normal">
                ثبت خودکار سیستم یکپارچه سایان ERP
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Destination & Notes */}
      {(data.recipientAddress || data.notes) && (
        <div className="border border-gray-300 rounded p-3 mb-4 text-xs bg-gray-50/60 leading-relaxed">
          {data.recipientAddress && (
            <div className="flex items-start gap-1 mb-1">
              <span className="font-bold text-gray-700 shrink-0">آدرس تحویل / مقصد:</span>
              <span className="text-gray-900">{data.recipientAddress}</span>
            </div>
          )}
          {data.notes && (
            <div className="flex items-start gap-1">
              <span className="font-bold text-gray-700 shrink-0">توضیحات:</span>
              <span className="text-gray-800">{data.notes}</span>
            </div>
          )}
        </div>
      )}

      {/* Signature & Official Stamps Section */}
      <div className="mt-8 pt-4 border-t-2 border-dashed border-gray-400">
        <div className="grid grid-cols-4 gap-4 text-center text-xs">
          
          {/* 1. Creator */}
          <div className="border border-gray-300 rounded-lg p-3 relative h-36 flex flex-col justify-between bg-white shadow-xs">
            <span className="font-bold text-gray-800 border-b pb-1">تنظیم کننده</span>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[11px] text-gray-600 font-medium">{data.creatorName || 'مسئول فروش'}</span>
            </div>
            <div className="text-[9px] text-gray-400 font-mono">امضاء و تایید</div>
          </div>

          {/* 2. Warehouse Keeper with Official Blue Oval Stamp */}
          <div className="border border-gray-300 rounded-lg p-3 relative h-36 flex flex-col justify-between bg-white shadow-xs overflow-hidden">
            <span className="font-bold text-gray-800 border-b pb-1">مسئول انبار</span>
            
            {showStamps && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-85 rotate-[-8deg]">
                <div className="w-28 h-18 border-2 border-blue-700 rounded-[50%] flex flex-col items-center justify-center p-1 text-blue-800 font-mono text-[9px] font-black leading-tight border-dashed shadow-xs bg-blue-50/20">
                  <span className="tracking-widest font-black text-[10px]">STORE</span>
                  <span className="font-sans font-black text-[11px] text-blue-900">انبار لپان بافت</span>
                  <span className="text-[8px] tracking-wider">LEPAN BAFT</span>
                </div>
              </div>
            )}

            <div className="flex-1 flex items-center justify-center relative z-10">
              <span className="text-[11px] text-gray-700 font-bold">{data.warehouseKeeperName || 'سرپرست انبار'}</span>
            </div>
            <div className="text-[9px] text-gray-400 font-mono relative z-10">توزین و تحویل شد</div>
          </div>

          {/* 3. Management */}
          <div className="border border-gray-300 rounded-lg p-3 relative h-36 flex flex-col justify-between bg-white shadow-xs">
            <span className="font-bold text-gray-800 border-b pb-1">مدیریت</span>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[11px] text-gray-600 font-medium">{data.managerName || 'مدیریت کارخانه'}</span>
            </div>
            <div className="text-[9px] text-gray-400 font-mono">امضاء و تایید نهایی</div>
          </div>

          {/* 4. Security with Official Blue Oval Stamp & Exit Time */}
          <div className="border border-gray-300 rounded-lg p-3 relative h-36 flex flex-col justify-between bg-white shadow-xs overflow-hidden">
            <span className="font-bold text-gray-800 border-b pb-1">انتظامات</span>
            
            {showStamps && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-85 rotate-[6deg]">
                <div className="w-28 h-18 border-2 border-blue-700 rounded-[50%] flex flex-col items-center justify-center p-1 text-blue-800 font-mono text-[9px] font-black leading-tight border-dashed shadow-xs bg-blue-50/20">
                  <span className="tracking-widest font-black text-[10px]">SECURITY</span>
                  <span className="font-sans font-black text-[11px] text-blue-900">انتظامات لپان بافت</span>
                  <span className="text-[8px] tracking-wider">LEPAN BAFT</span>
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center relative z-10">
              <span className="text-[11px] text-gray-700 font-bold">{data.securityGuardName || 'نگهبانی و خروج'}</span>
              {data.exitTime && (
                <span className="text-[10px] text-blue-900 font-mono font-black mt-1 bg-blue-100/80 px-1.5 py-0.5 rounded">
                  ساعت: {data.exitTime}
                </span>
              )}
            </div>
            <div className="text-[9px] text-gray-400 font-mono relative z-10">کنترل و خروج بار</div>
          </div>

        </div>
      </div>

      {/* Document Footer Verification */}
      <div className="mt-6 pt-2 border-t border-gray-200 flex justify-between items-center text-[9px] text-gray-400 font-mono">
        <span>Sayan ERP Automated Sales Remittance Sync</span>
        <span>ID: {data.archiveCode || data.remittanceNumber} | REF: {data.subCode || 'SYS'}</span>
      </div>
    </div>
  );
};

export default SayanSalesRemittanceDoc;
