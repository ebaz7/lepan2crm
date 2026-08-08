import React, { useState, useEffect, useRef } from 'react';
import { TradeRecord, SystemSettings } from '../../types';
import { formatNumberString, formatCurrency } from '../../constants';
import { X, Printer, Loader2, FileDown, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator';

interface PrintProformaProps {
  record: TradeRecord;
  settings: SystemSettings | null;
  onClose: () => void;
}

const PrintProforma: React.FC<PrintProformaProps> = ({ record, settings, onClose }) => {
  const [processing, setProcessing] = useState(false);
  const totalWeight = record.items.reduce((sum, item) => sum + item.weight, 0);
  const totalAmount = record.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const company = settings?.companies?.find(c => c.name === record.company);

  // Scaling & Zoom States
  const [scale, setScale] = useState(1);
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const style = document.getElementById('page-size-style');
    if (style) {
      style.innerHTML = '@page { size: A4 portrait; margin: 0; }';
    }
  }, []);

  // Auto-Scale Logic (A4 Portrait target width is 794px)
  useEffect(() => {
    const handleResize = () => {
        if (userZoom !== null) return;
        const wrapper = containerWrapperRef.current;
        if (wrapper) {
            const wrapperWidth = wrapper.clientWidth;
            const targetWidth = 794; // A4 Portrait Width in px
            
            if (wrapperWidth < targetWidth + 40) {
                const newScale = (wrapperWidth - 32) / targetWidth;
                setScale(newScale);
            } else {
                setScale(1);
            }
        }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [userZoom]);

  const handleZoomIn = () => {
      const currentScale = userZoom !== null ? userZoom : scale;
      const nextScale = Math.min(2.5, currentScale + 0.15);
      setUserZoom(nextScale);
      setScale(nextScale);
  };

  const handleZoomOut = () => {
      const currentScale = userZoom !== null ? userZoom : scale;
      const nextScale = Math.max(0.3, currentScale - 0.15);
      setUserZoom(nextScale);
      setScale(nextScale);
  };

  const handleResetZoom = () => {
      setUserZoom(null);
      setTimeout(() => {
          const wrapper = containerWrapperRef.current;
          if (wrapper) {
              const wrapperWidth = wrapper.clientWidth;
              const targetWidth = 794;
              if (wrapperWidth < targetWidth + 40) {
                  setScale((wrapperWidth - 32) / targetWidth);
              } else {
                  setScale(1);
              }
          }
      }, 50);
  };

  const handleDownloadPDF = async () => {
      setProcessing(true);
      await generatePdf({
          elementId: 'proforma-print-area',
          filename: `Proforma_${record.fileNumber || 'Invoice'}.pdf`,
          format: 'A4',
          orientation: 'portrait',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
      });
  };

  const content = (
    <div id="proforma-print-area" className="printable-content p-8 bg-white text-gray-900 flex flex-col font-sans" dir="rtl" style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-gray-900">پیش‌فاکتور (Proforma Invoice)</h1>
          <p className="text-sm font-bold text-gray-600">شرکت {record.company}</p>
        </div>
        {company?.logo && <img src={company.logo} alt="Logo" className="h-16 w-auto object-contain" referrerPolicy="no-referrer" />}
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-start p-4 animate-fade-in safe-pb">
      <div className="relative z-50 flex flex-col gap-2 no-print w-full max-w-4xl mb-4">
         <div className="glass-panel p-3 rounded-xl shadow-lg flex justify-between items-center gap-4 bg-white dark:bg-zinc-950 flex-wrap">
             <span className="font-bold text-sm">پیش‌نمایش پروفرما</span>

             {/* Interactive Zoom Toolbar */}
             <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800">
                 <button onClick={handleZoomOut} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors" title="کوچک‌نمایی"><ZoomOut size={16}/></button>
                 <span className="text-xs font-mono font-bold text-gray-600 dark:text-gray-400 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
                 <button onClick={handleZoomIn} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors" title="بزرگ‌نمایی"><ZoomIn size={16}/></button>
                 {userZoom !== null && (
                     <button onClick={handleResetZoom} className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded transition-colors" title="بازنشانی"><RotateCcw size={14}/></button>
                 )}
             </div>

             <div className="flex gap-2">
                <button onClick={handleDownloadPDF} disabled={processing} className="bg-red-600 hover:bg-red-700 text-white p-2 px-3 rounded-lg text-xs flex items-center gap-1 font-bold shadow-sm">{processing ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} دانلود PDF</button>
                <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white p-2 px-3 rounded-lg text-xs flex items-center gap-1 font-bold shadow-sm"><Printer size={16}/> چاپ</button>
                <button onClick={onClose} className="bg-gray-100 dark:bg-zinc-900 text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-800"><X size={18}/></button>
             </div>
         </div>
      </div>
      
      {/* Responsive Wrapper */}
      <div className="w-full flex justify-center pb-10 overflow-hidden" ref={containerWrapperRef}>
          <div style={{ 
            width: '210mm', 
            minHeight: '297mm',
            backgroundColor: 'white', 
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            marginBottom: `${(scale - 1) * 1120}px` 
          }} className="printable-content">
              {content}
          </div>
      </div>
    </div>
  );
};

export default PrintProforma;
