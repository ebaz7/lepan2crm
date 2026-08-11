
import React, { useState, useEffect, useRef } from 'react';
import { TradeRecord, SystemSettings } from '../../types';
import { X, Printer, Loader2, FileDown } from 'lucide-react';
import { formatNumberString } from '../../constants';
import { generatePdf } from '../../utils/pdfGenerator'; 

interface Props {
  record: TradeRecord;
  settings: SystemSettings;
  onClose: () => void;
  embed?: boolean;
}

const PrintClearanceDeclaration: React.FC<Props> = ({ record, settings, onClose, embed }) => {
  const [processing, setProcessing] = useState(false);
  
  // Local state for editable fields
  const [formData, setFormData] = useState({
      brokerName: 'جناب آقای محمد محمودیان',
      transportMode: 'Land' as 'Rail' | 'Land' | 'Sea',
      truckCount: '',
      wagonCount: '',
      containerCount: '',
      transportCompany: '',
      part: 'اول (نهایی)',
      sataCode: '',
      bankBranch: '',
      bankCode: '',
      packageType: 'کارتن',
      letterNumber: '',
      letterDate: new Date().toLocaleDateString('fa-IR'),
      attachment: 'دارد'
  });

  // Scaling State
  const [scale, setScale] = useState(1);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  const company = settings.companies?.find(c => c.name === record.company);
  const letterhead = company?.letterhead;

  const blDoc = record.shippingDocuments?.find(d => d.type === 'Bill of Lading');
  const packingList = record.shippingDocuments?.find(d => d.type === 'Packing List');
  const invoice = record.shippingDocuments?.find(d => d.type === 'Commercial Invoice');
  const warehouseReceipt = record.clearanceData?.receipts?.[0];

  const totalWeight = record.items.reduce((sum, i) => sum + i.weight, 0);
  const totalPackages = packingList?.packagesCount || 0;

  const elementId = embed ? `clearance-dec-embed-${record.id}` : 'clearance-declaration-print';

  useEffect(() => {
    const style = document.getElementById('page-size-style');
    if (style && !embed) {
      style.innerHTML = '@page { size: A4 portrait; margin: 0; }';
    }
  }, [embed]);

  // Auto-Scale Logic
  useEffect(() => {
    const handleResize = () => {
        if (embed) return;
        const wrapper = containerWrapperRef.current;
        if (wrapper) {
            const wrapperWidth = wrapper.clientWidth;
            const targetWidth = 794; // A4 Portrait
            
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
  }, [embed]);

  const handlePrint = () => {
      setProcessing(true);
      setTimeout(() => {
          window.print();
          setProcessing(false);
      }, 500);
  };

  const handleDownloadPDF = async () => {
      setProcessing(true);
      await generatePdf({
          elementId: elementId,
          filename: `Clearance_Declaration_${record.fileNumber}.pdf`,
          format: 'A4',
          orientation: 'portrait',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
      });
  };

  const Input = ({ value, onChange, className = "", placeholder = "................" }: any) => (
      <input 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className={`bg-transparent border-b border-gray-400 focus:border-blue-500 outline-none text-center font-bold text-gray-800 px-1 print:border-none print:placeholder-transparent ${className}`}
        placeholder={placeholder}
      />
  );

  const content = (
      <div id={elementId} className="printable-content glass-panel shadow-2xl relative text-black overflow-hidden" 
        style={{ 
            width: '210mm', 
            height: '296mm', 
            direction: 'rtl',
            boxSizing: 'border-box',
            padding: '0',
            margin: embed ? '0' : '0 auto',
            overflow: 'hidden' 
        }}>
        
        {/* Letterhead Background Image */}
        {letterhead && (
            <img 
                src={letterhead} 
                alt="Letterhead" 
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    zIndex: 0,
                    pointerEvents: 'none'
                }}
            />
        )}

        {/* Content Container */}
        <div style={{ position: 'relative', zIndex: 1, padding: '40mm 20mm 20mm 20mm', height: '100%', boxSizing: 'border-box' }}>
            
            {/* Header Info Overlay */}
            <div className="absolute top-[40mm] left-[20mm] text-left text-sm font-bold space-y-1 w-48" style={{ direction: 'ltr' }}>
               <div className="flex justify-end items-center gap-2">
                   <Input value={formData.letterDate} onChange={(v: string) => setFormData({...formData, letterDate: v})} className="w-24 text-center" />
                   <span>:تاريخ</span>
               </div>
               <div className="flex justify-end items-center gap-2">
                   <Input value={formData.letterNumber} onChange={(v: string) => setFormData({...formData, letterNumber: v})} className="w-24 text-center" />
                   <span>:شماره</span>
               </div>
               <div className="flex justify-end items-center gap-2">
                   <Input value={formData.attachment} onChange={(v: string) => setFormData({...formData, attachment: v})} className="w-24 text-center" />
                   <span>:پيوست</span>
               </div>
            </div>

            {/* Title */}
            <div className="text-center mb-8 mt-8">
                <h2 className="font-bold text-lg">بسمه تعالی</h2>
                <h1 className="font-black text-xl mt-2 border-b-2 border-black inline-block pb-1">
                    کارگزار رسمی گمرک ایران - <Input value={formData.brokerName} onChange={(v: string) => setFormData({...formData, brokerName: v})} className="w-64 text-center text-lg placeholder-gray-400" placeholder="نام کارگزار..." />
                </h1>
            </div>
            
            {/* Body */}
            <div className="text-justify leading-loose mb-6 font-medium text-sm">
                با سلام<br/>
                احتراماً، ورود یک محموله کالا از طریق 
                <label className="inline-flex items-center mx-2 cursor-pointer print:mx-1">
                    <input type="checkbox" checked={formData.transportMode === 'Rail'} onChange={() => setFormData({...formData, transportMode: 'Rail'})} className="mx-1"/> ریلی
                </label>
                <label className="inline-flex items-center mx-2 cursor-pointer print:mx-1">
                    <input type="checkbox" checked={formData.transportMode === 'Land'} onChange={() => setFormData({...formData, transportMode: 'Land'})} className="mx-1"/> زمینی
                </label>
                <label className="inline-flex items-center mx-2 cursor-pointer print:mx-1">
                    <input type="checkbox" checked={formData.transportMode === 'Sea'} onChange={() => setFormData({...formData, transportMode: 'Sea'})} className="mx-1"/> دریایی
                </label>
                بنام این شرکت با مشخصات ذیل اعلام میگردد. خواهشمند است دستور فرمائید نسبت به ترخیص آن اقدامات لازم معمول گردد. بدیهی است محل ارسال محموله مورد بحث متعاقباً اعلام خواهد شد.
            </div>

            {/* Details Grid */}
            <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-4 items-center">
                    <span className="font-bold">• تعداد کامیون:</span> <Input value={formData.truckCount} onChange={(v: string) => setFormData({...formData, truckCount: v})} className="w-16" />
                    <span className="font-bold">تعداد واگن:</span> <Input value={formData.wagonCount} onChange={(v: string) => setFormData({...formData, wagonCount: v})} className="w-16" />
                    <span className="font-bold">تعداد کانتینر:</span> <Input value={formData.containerCount} onChange={(v: string) => setFormData({...formData, containerCount: v})} className="w-16" />
                </div>

                <div className="flex items-center gap-2">
                    <span className="font-bold">• شرکت حمل و نقل:</span> <Input value={formData.transportCompany} onChange={(v: string) => setFormData({...formData, transportCompany: v})} className="flex-1 text-right" />
                </div>

                <div className="flex flex-wrap gap-4 items-center">
                    <span className="font-bold">• شماره سفارش کالا (Order):</span> <span className="font-mono font-bold border-b border-gray-400 px-2 min-w-[100px] text-center inline-block">{record.orderNumber || record.fileNumber}</span>
                    <span className="font-bold">پارت:</span> <Input value={formData.part} onChange={(v: string) => setFormData({...formData, part: v})} className="w-32" />
                </div>

                <div className="flex items-center gap-2">
                    <span className="font-bold">• شماره قبض انبار:</span> <span className="font-mono font-bold border-b border-gray-400 px-2 flex-1 text-center inline-block">{warehouseReceipt?.number || '........................'}</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="font-bold">• شماره بارنامه:</span> <span className="font-mono font-bold border-b border-gray-400 px-2 flex-1 text-center inline-block">{blDoc?.documentNumber || '........................'}</span>
                </div>

                <div className="flex flex-wrap gap-4 items-center">
                    <span className="font-bold">• شماره ثبت سفارش:</span> <span className="font-mono font-bold border-b border-gray-400 px-2 min-w-[150px] text-center inline-block">{record.registrationNumber || '................'}</span>
                    <span className="font-bold">تاريخ ثبت سفارش:</span> <span className="font-mono font-bold border-b border-gray-400 px-2 min-w-[100px] text-center inline-block">{record.registrationDate || '................'}</span>
                </div>

                <div className="flex gap-2 flex-wrap items-center">
                    <span className="font-bold">• نوع خريد:</span> <span className="font-bold border-b border-gray-400 px-2">{record.currencyAllocationType === 'Bank' ? 'بانکی' : 'غیربانکی'}</span>
                    <span className="font-bold">شماره حواله/برات:</span> <Input className="w-32 font-mono" />
                    <span className="font-bold">كدرهگيري بانك:</span> <Input className="w-32 font-mono" />
                </div>

                <div className="flex items-center gap-2">
                    <span className="font-bold">• کد ساتا:</span> <Input value={formData.sataCode} onChange={(v: string) => setFormData({...formData, sataCode: v})} className="flex-1 text-right" placeholder="متعاقباً اعلام خواهد شد" />
                </div>

                <div className="flex gap-2 flex-wrap items-center">
                    <span className="font-bold">• نام بانك عامل:</span> <span className="font-bold border-b border-gray-400 px-2 min-w-[150px] text-center">{record.operatingBank || '................'}</span>
                    <span className="font-bold">نام شعبه:</span> <Input value={formData.bankBranch} onChange={(v: string) => setFormData({...formData, bankBranch: v})} className="w-32" />
                    <span className="font-bold">كد بانك:</span> <Input value={formData.bankCode} onChange={(v: string) => setFormData({...formData, bankCode: v})} className="w-20 font-mono" />
                </div>

                <div className="flex gap-2 flex-wrap items-center">
                    <span className="font-bold">• وزن:</span> <span className="font-bold font-mono border-b border-gray-400 px-2 min-w-[80px] text-center">{formatNumberString(totalWeight)}</span> <span className="text-xs font-bold">کیلوگرم خالص</span>
                    <span className="font-bold mr-4">تعداد نگله - بسته – عدل-كارتن:</span> <span className="font-bold font-mono border-b border-gray-400 px-2 min-w-[60px] text-center">{formatNumberString(totalPackages)}</span> 
                    <Input value={formData.packageType} onChange={(v: string) => setFormData({...formData, packageType: v})} className="w-20" />
                </div>
            </div>

            {/* Attachments Checkboxes */}
            <div className="mt-6">
                <span className="font-bold block mb-2">• مدارک ضمیمه :</span>
                <div className="grid grid-cols-4 gap-y-2 gap-x-4 text-xs font-bold">
                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-black" defaultChecked={!!blDoc} /> ۱- بارنامه (بارنامه دستی)</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-black" defaultChecked={!!invoice} /> ۲- اینویس</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-black" defaultChecked={!!packingList} /> ۳- پکینگ لیست</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-black" /> ۴- پروفرما</label>
                    
                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-black" defaultChecked={!!record.registrationNumber} /> ۵- کپی ثبت سفارش</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-black" defaultChecked={!!record.shippingDocuments?.find(d=>d.type==='Certificate of Origin')} /> ۶- گواهی مبدا</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-black" defaultChecked={!!record.insuranceData?.policyNumber} /> ۷- بیمه نامه</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-black" defaultChecked={!!record.inspectionData?.certificates.length} /> ۸- گواهی بازرسی</label>
                    
                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-black" defaultChecked={!!warehouseReceipt} /> ۹- قبض انبار</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-black" /> ۱۰- تصویر ترخیصیه الکترونیک</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-black" defaultChecked={!!record.insuranceData?.endorsements?.length} /> ۱۱- الحاقیه بیمه نامه</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-black" /> ۱۲- اظهار نامه های صادراتی</label>
                    
                    <label className="flex items-center gap-1 cursor-pointer col-span-2"><input type="checkbox" className="w-4 h-4 accent-black" /> ۱۳- تصویر سی ام آر کامیون و یا بارنامه واگن</label>
                </div>
            </div>

            {/* Footer Signature */}
            <div className="mt-12 ml-10 text-left text-sm font-bold">
                <div>با احترام</div>
                <div className="mt-1">شرکت {record.company}</div>
            </div>

        </div>
    </div>
  );

  if (embed) return content;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[130] flex flex-col items-center justify-start p-4 md:p-6 overflow-y-auto animate-fade-in safe-pb">
        <div className="sticky top-2 z-50 flex justify-center w-full max-w-4xl no-print mb-4">
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 flex justify-between items-center gap-6 w-full md:w-auto">
                <span className="font-bold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <Printer size={18} className="text-blue-600"/> اعلام ورود کالا (ترخیصیه)
                </span>
                <div className="flex gap-2">
                    <button onClick={handleDownloadPDF} disabled={processing} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 font-bold transition-all shadow-sm active:scale-95">{processing ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} دانلود PDF</button>
                    <button onClick={handlePrint} disabled={processing} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 font-bold transition-all shadow-sm active:scale-95"><Printer size={16}/> چاپ</button>
                    <button onClick={onClose} className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"><X size={18}/></button>
                </div>
            </div>
        </div>

        {/* Responsive Container for Scaling */}
        <div className="w-full flex justify-center overflow-x-auto overflow-y-visible p-2 md:p-4 my-auto min-h-[300px]" ref={containerWrapperRef}>
          <div style={{ 
            width: `${210 * 3.779527559 * scale}px`,
            minHeight: `${296 * 3.779527559 * scale}px`,
            position: 'relative',
            flexShrink: 0
          }}>
            <div style={{ 
              width: '210mm', 
              minHeight: '296mm',
              backgroundColor: 'white', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: 0,
              left: 0
            }} className="printable-content rounded-sm">
                {content}
            </div>
          </div>
        </div>
    </div>
  );
};

export default PrintClearanceDeclaration;
