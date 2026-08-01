
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PaymentOrder, OrderStatus, PaymentMethod, SystemSettings } from '../types';
import { formatCurrency, formatDate, getStatusLabel, numberToPersianWords, formatNumberString, getShamsiDateFromIso } from '../constants';
import { X, Printer, FileDown, Loader2, CheckCircle, XCircle, Pencil, Share2, Users, Search, RotateCcw, AlertTriangle, FileText, LayoutTemplate, EyeOff, Eye, Settings2, ChevronLeft, ChevronRight, Calendar, MapPin, Layers } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { generatePdf } from '../utils/pdfGenerator'; 
import html2canvas from 'html2canvas';

interface PrintVoucherProps {
  order: PaymentOrder;
  onClose?: () => void;
  settings?: SystemSettings;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  onRevoke?: () => void; 
  embed?: boolean; 
}

const PrintVoucher: React.FC<PrintVoucherProps> = ({ order, onClose, settings, onApprove, onReject, onEdit, onRevoke, embed }) => {
  const [processing, setProcessing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sharePlatform, setSharePlatform] = useState<'whatsapp' | 'telegram' | 'bale' | null>(null);
  const [contactSearch, setContactSearch] = useState('');
  
  // Toggle between Internal Receipt and Bank Form Fill
  const [printMode, setPrintMode] = useState<'receipt' | 'bank_form'>('receipt');
  
  // Default: Background OFF (User wants to print on pre-printed paper)
  const [showFormBackground, setShowFormBackground] = useState(false);
  
  // Calibration State
  const [calibration, setCalibration] = useState({ x: 0, y: 0 }); // mm
  const [showCalibration, setShowCalibration] = useState(false);

  // Line Selection for Multi-Payment Orders
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  
  // NEW: Dual Print Mode State (full, withdrawal, deposit)
  const [dualPrintMode, setDualPrintMode] = useState<'full' | 'withdrawal' | 'deposit'>('full');

  // Scale State for Mobile Fit
  const [scale, setScale] = useState(1);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  // Determine which line to show
  const paymentLines = order.paymentDetails;
  const currentLine = paymentLines[currentLineIndex];

  // --- TEMPLATE LOGIC ---
  const company = settings?.companies?.find(c => c.name === order.payingCompany);
  const sourceBankConfig = company?.banks?.find(b => currentLine.bankName?.includes(b.bankName));
  
  // Logic to pick correct template based on method and DUAL PRINT mode
  let effectiveTemplateId = sourceBankConfig?.formLayoutId;
  const isInternalTransfer = currentLine.method === PaymentMethod.INTERNAL_TRANSFER;
  const isDualPrintEnabled = isInternalTransfer && sourceBankConfig?.enableDualPrint;

  if (isInternalTransfer) {
      if (isDualPrintEnabled) {
          if (dualPrintMode === 'withdrawal' && sourceBankConfig?.internalWithdrawalTemplateId) {
              effectiveTemplateId = sourceBankConfig.internalWithdrawalTemplateId;
          } else if (dualPrintMode === 'deposit' && sourceBankConfig?.internalDepositTemplateId) {
              effectiveTemplateId = sourceBankConfig.internalDepositTemplateId;
          } else if (sourceBankConfig?.internalTransferTemplateId) {
              // Fallback to legacy single internal template if dual specific isn't set
              effectiveTemplateId = sourceBankConfig.internalTransferTemplateId;
          }
      } else if (sourceBankConfig?.internalTransferTemplateId) {
          effectiveTemplateId = sourceBankConfig.internalTransferTemplateId;
      }
  }

  const dynamicTemplate = settings?.printTemplates?.find(t => t.id === effectiveTemplateId);
  const canPrintBankForm = !!dynamicTemplate;

  // -- NEW: Manual Override State for Date and Place --
  const [overrideDate, setOverrideDate] = useState({ year: '', month: '', day: '' });
  const [overridePlace, setOverridePlace] = useState('');

  // Auto-Scale Logic
  useEffect(() => {
    const handleResize = () => {
        if (embed) return; 
        const wrapper = containerWrapperRef.current;
        if (wrapper) {
            const wrapperWidth = wrapper.clientWidth;
            const targetWidth = 794; 
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
  }, [embed, printMode]);

  // Reset Dual Print Mode when line changes
  useEffect(() => {
      setDualPrintMode('full');
  }, [currentLineIndex]);

  // Effect to set default override values when current line changes
  useEffect(() => {
      let yStr = '', mStr = '', dStr = '';
      if (currentLine.method === PaymentMethod.CHEQUE && currentLine.chequeDate) {
          const parts = currentLine.chequeDate.split('/');
          if (parts.length === 3) {
              yStr = parts[0]; mStr = parts[1]; dStr = parts[2];
          }
      } 
      if (!yStr) {
          const shamsi = getShamsiDateFromIso(order.date);
          yStr = shamsi.year.toString();
          mStr = shamsi.month.toString();
          dStr = shamsi.day.toString();
      }
      setOverrideDate({ year: yStr, month: mStr, day: dStr });
      setOverridePlace(''); 
  }, [currentLineIndex, order.date, currentLine]);

  useEffect(() => {
      if (dynamicTemplate) {
          const saved = localStorage.getItem(`print_calib_${dynamicTemplate.id}`);
          if (saved) {
              setCalibration(JSON.parse(saved));
          } else {
              setCalibration({ x: 0, y: 0 });
          }
      }
  }, [dynamicTemplate]);

  const updateCalibration = (dx: number, dy: number) => {
      const newCal = { x: calibration.x + dx, y: calibration.y + dy };
      setCalibration(newCal);
      if (dynamicTemplate) {
          localStorage.setItem(`print_calib_${dynamicTemplate.id}`, JSON.stringify(newCal));
      }
  };

  useEffect(() => {
      const style = document.getElementById('page-size-style');
      if (style && !embed) { 
          if (printMode === 'bank_form' && dynamicTemplate) {
              const size = dynamicTemplate.pageSize || 'A4';
              const orient = dynamicTemplate.orientation || 'portrait';
              style.innerHTML = `@page { size: ${size} ${orient}; margin: 0; }`;
          } else {
              style.innerHTML = '@page { size: A5 landscape; margin: 0; }';
          }
      }
  }, [embed, printMode, dynamicTemplate]);

  const isCompact = order.paymentDetails.length > 1 || (order.description && order.description.length > 70);
  const printAreaId = `print-voucher-${order.id}`;

  const isRevocationProcess = [
      OrderStatus.REVOCATION_PENDING_FINANCE,
      OrderStatus.REVOCATION_PENDING_MANAGER,
      OrderStatus.REVOCATION_PENDING_CEO
  ].includes(order.status);
  
  const isRevoked = order.status === OrderStatus.REVOKED;

  const Stamp = ({ name, title }: { name: string; title: string }) => (
    <div className={`border-[2px] border-blue-800 text-blue-800 rounded-lg ${isCompact ? 'py-0.2 px-1' : 'py-1 px-3'} rotate-[-5deg] opacity-90 mix-blend-multiply print:bg-transparent shadow-sm inline-block`}>
      <div className={`${isCompact ? 'text-[7px]' : 'text-[9px]'} font-bold border-b border-blue-800 mb-0.5 text-center pb-0.5`}>{title}</div>
      <div className={`${isCompact ? 'text-[8px]' : 'text-[10px]'} text-center font-bold whitespace-nowrap`}>{name}</div>
    </div>
  );

  const handlePrint = () => { 
      const style = document.getElementById('page-size-style');
      if (style) {
          const isBankForm = printMode === 'bank_form' && dynamicTemplate;
          const w = isBankForm ? (dynamicTemplate?.width || 210) : 210;
          const h = isBankForm ? (dynamicTemplate?.height || 297) : 148;
          const size = isBankForm ? `${dynamicTemplate?.pageSize || 'A4'} ${dynamicTemplate?.orientation || 'portrait'}` : 'A5 landscape';
          
          style.innerHTML = `
            @page { 
                size: ${size}; 
                margin: 0; 
            }
            @media print {
                html, body { height: 100vh !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; background: white !important; }
                /* Hide all direct children of body except the printing modal */
                body > *:not(.printing-modal) { display: none !important; }
                
                /* Ensure modal is visible and positioned correctly */
                .printing-modal {
                    display: block !important;
                    visibility: visible !important;
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    z-index: 9999999 !important;
                }
                
                /* Ensure only the specific printed div is visible and correctly positioned */
                #${printAreaId} { 
                    display: block !important;
                    visibility: visible !important;
                    position: fixed !important; 
                    left: 0 !important; 
                    top: 0 !important; 
                    width: ${w}mm !important; 
                    height: ${h}mm !important;
                    margin: 0 !important;
                    padding: ${isBankForm ? '0' : '10mm'} !important;
                    border: none !important;
                    box-shadow: none !important;
                    background: white !important;
                    z-index: 9999999 !important;
                    overflow: hidden !important;
                }
                #${printAreaId} * { visibility: visible !important; }
            }
          `;
      }
      
      // We temporary append the element to body for print if it's nested
      const el = document.getElementById(printAreaId);
      if (el) {
          window.print();
      }
  };

  const handleDownloadPDF = async () => {
      setProcessing(true);
      const isBankForm = printMode === 'bank_form' && !!dynamicTemplate;
      let opts: any = {
          elementId: printAreaId,
          filename: `Voucher_${order.trackingNumber}.pdf`,
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
      };
      if (isBankForm && dynamicTemplate) {
          opts.width = `${dynamicTemplate.width}mm`;
          opts.height = `${dynamicTemplate.height}mm`;
      } else {
          opts.format = 'A5';
          opts.orientation = 'landscape';
      }
      await generatePdf(opts);
  };

  const handleShare = async (targetId: string) => {
      if (!targetId || !sharePlatform) return;
      setProcessing(true);
      const element = document.getElementById(printAreaId);
      if (!element) { setProcessing(false); return; }
      try {
          const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
          const base64 = canvas.toDataURL('image/png').split(',')[1];
          const caption = `🧾 *رسید پرداخت وجه*\n🏢 شرکت: ${order.payingCompany}\n👤 ذینفع: ${order.payee}\n💰 مبلغ: ${formatCurrency(order.totalAmount)}`;
          if (sharePlatform === 'whatsapp') {
              await apiCall('/send-whatsapp', 'POST', {
                  number: targetId,
                  message: caption,
                  mediaData: { data: base64, mimeType: 'image/png', filename: `Order_${order.trackingNumber}.png` }
              });
          } else {
              await apiCall('/send-bot-message', 'POST', {
                  platform: sharePlatform,
                  chatId: targetId,
                  caption: caption,
                  mediaData: { data: base64, filename: `Order_${order.trackingNumber}.png` }
              });
          }
          if (!embed) alert('ارسال شد.');
          setSharePlatform(null);
      } catch(e) { alert('خطا در ارسال'); } finally { setProcessing(false); }
  };

  const filteredContacts = settings?.savedContacts?.filter(c => 
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) || 
    c.number.includes(contactSearch)
  ) || [];

  const DynamicBankFormOverlay = () => {
      if (!currentLine || !dynamicTemplate) return null;
      const yStr = overrideDate.year;
      const mStr = overrideDate.month.padStart(2, '0');
      const dStr = overrideDate.day.padStart(2, '0');
      const dateFull = `${yStr}/${mStr}/${dStr}`;
      const amountStr = formatNumberString(currentLine.amount);
      const amountWords = numberToPersianWords(currentLine.amount);

      const getValue = (key: string) => {
          switch(key) {
              case 'date_year': return yStr;
              case 'date_month': return mStr;
              case 'date_day': return dStr;
              case 'date_full': return dateFull;
              case 'amount_num': return amountStr;
              case 'amount_word': return amountWords;
              case 'payee': return order.payee;
              case 'description': return currentLine.description || order.description;
              case 'place': return overridePlace;
              case 'source_account': return sourceBankConfig?.accountNumber || '';
              case 'source_sheba': return sourceBankConfig?.sheba || '';
              case 'dest_account': return currentLine.destinationAccount || ''; 
              case 'dest_sheba': return currentLine.sheba || '';
              case 'dest_bank': return currentLine.recipientBank || '';
              case 'dest_owner': return currentLine.destinationOwner || '';
              case 'payment_id': return currentLine.paymentId || '';
              case 'cheque_no': return currentLine.chequeNumber || '';
              case 'company_name': return order.payingCompany;
              case 'company_id': return company?.nationalId || '';
              case 'company_reg': return company?.registrationNumber || '';
              case 'company_address': return company?.address || '';
              case 'company_postal': return company?.postalCode || '';
              case 'company_tel': return company?.phone || '';
              case 'company_fax': return company?.fax || '';
              case 'company_eco_code': return company?.economicCode || '';
              default: return '';
          }
      };

      const w = dynamicTemplate.width || 210;
      const h = dynamicTemplate.height || 297;

      return (
          <div className="printable-content relative w-full h-full text-black font-sans" 
               style={{ width: `${w}mm`, height: `${h}mm`, margin: '0 auto', overflow: 'hidden', padding: 0, position: 'relative' }}>
              {showFormBackground && dynamicTemplate.backgroundImage && (
                  <img src={dynamicTemplate.backgroundImage} className="absolute inset-0 w-full h-full object-contain opacity-50 z-0 pointer-events-none" style={{ transform: `translate(${calibration.x}mm, ${calibration.y}mm)` }} />
              )}
              {dynamicTemplate.fields.map(field => {
                  if (dualPrintMode === 'withdrawal' && ['dest_account', 'dest_sheba', 'dest_bank', 'dest_owner'].includes(field.key)) return null;
                  if (dualPrintMode === 'deposit' && ['source_account', 'source_sheba'].includes(field.key)) return null;
                  const val = getValue(field.key);
                  if (field.key.includes('sheba') && (field.letterSpacing || 0) > 0) {
                      const cleanSheba = val.replace(/[^0-9]/g, '');
                      return (
                          <div key={field.id} style={{ position: 'absolute', top: `${field.y + calibration.y}mm`, left: `${field.x + calibration.x}mm`, width: field.width ? `${field.width}mm` : 'auto', fontSize: `${field.fontSize}px`, fontWeight: field.isBold ? 'bold' : 'normal', letterSpacing: `${field.letterSpacing}px`, fontFamily: 'monospace', direction: 'ltr', textAlign: 'left', whiteSpace: 'nowrap' }}>{cleanSheba}</div>
                      );
                  }
                  return (
                    <div key={field.id} style={{ position: 'absolute', top: `${field.y + calibration.y}mm`, left: `${field.x + calibration.x}mm`, width: field.width ? `${field.width}mm` : 'auto', fontSize: `${field.fontSize}px`, fontWeight: field.isBold ? 'bold' : 'normal', textAlign: field.align || 'right', whiteSpace: 'nowrap', direction: 'rtl', border: (!showFormBackground) ? '1px dashed rgba(0,0,0,0.05)' : 'none', lineHeight: '1.2' }} className="print:border-none">{val}</div>
                  );
              })}
          </div>
      );
  };

  const receiptContent = (
      <div 
        id={printAreaId} 
        className="printable-content bg-white print:bg-white border-2 border-gray-800 print:border-black print:!border-solid relative text-gray-900 flex flex-col justify-between overflow-hidden" 
        style={{ direction: 'rtl', width: '210mm', height: '148mm', padding: isCompact ? '4mm 6mm' : '8mm 10mm', boxSizing: 'border-box', margin: '0 auto', maxHeight: '148mm', overflow: 'hidden' }}
      >
        {order.status === OrderStatus.REJECTED && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-8 border-red-600/30 text-red-600/30 font-black text-9xl rotate-[-25deg] p-4 rounded-3xl select-none z-0 pointer-events-none">REJECTED</div>
        )}
        {isRevoked && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-8 border-gray-400/40 text-gray-400/40 font-black text-8xl rotate-[-25deg] p-6 rounded-3xl select-none z-0 pointer-events-none whitespace-nowrap">باطل شد</div>
        )}
        {isRevocationProcess && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-8 border-red-200/50 text-red-200/50 font-black text-6xl rotate-[-25deg] p-6 rounded-3xl select-none z-0 pointer-events-none whitespace-nowrap">در حال ابطال</div>
        )}
        <div className="relative z-10">
            <div className={`border-b-2 border-gray-800 print:border-black ${isCompact ? 'pb-1.5 mb-2' : 'pb-2 mb-3'} flex justify-between items-center`}>
                <div className="flex items-center gap-4 w-2/3">
                    {company?.logo ? <img src={company.logo} alt="Company Logo" className={`${isCompact ? 'h-11 w-11' : 'h-16 w-16'} object-contain mix-blend-multiply`} /> : <div className={`${isCompact ? 'h-11 w-11 text-[9px]' : 'h-16 w-16 text-xs'} bg-gray-100 text-gray-800 flex items-center justify-center rounded text-center border border-dashed border-gray-300`}>بدون لوگو</div>}
                    <div className="flex flex-col">
                        <h1 className={`${isCompact ? 'text-base' : 'text-xl'} font-bold text-gray-900 print:text-black`}>{order.payingCompany || 'شرکت بازرگانی'}</h1>
                        <p className="text-[10px] text-gray-500 font-bold mt-0.5 print:text-gray-800">سیستم مدیریت مالی و پرداخت</p>
                    </div>
                </div>
                <div className="text-left flex flex-col items-end gap-1 w-1/3">
                    <h2 className={`${isCompact ? 'text-xs px-2 py-0.5' : 'text-base px-3 py-1'} font-black bg-gray-100 print:bg-transparent border border-gray-200/50 print:border-black text-gray-800 print:text-black rounded-lg mb-1 whitespace-nowrap`}>رسید پرداخت وجه</h2>
                    <div className="flex items-center gap-2 text-[10px]"><span className="font-bold text-gray-500 print:text-gray-700">شماره:</span><span className="font-mono font-bold text-sm print:text-black">{order.trackingNumber}</span></div>
                    <div className="flex items-center gap-2 text-[10px]"><span className="font-bold text-gray-500 print:text-gray-700">تاریخ:</span><span className="font-bold text-gray-800 print:text-black">{formatDate(order.date)}</span></div>
                </div>
            </div>
            <div className={`${isCompact ? 'space-y-1.5' : 'space-y-3'}`}>
                <div className="grid grid-cols-2 gap-3">
                    <div className={`bg-gray-100/50 border-2 border-black print:bg-transparent print:border-black print:!border-solid ${isCompact ? 'p-1 px-1.5' : 'p-2'} rounded print:rounded-none`} style={{borderStyle: 'solid', borderWidth: '2px'}}><span className="block text-gray-600 print:text-black text-[9px] mb-0.5 font-bold underline underline-offset-2">در وجه (ذینفع):</span><span className={`font-bold text-gray-900 print:text-black ${isCompact ? 'text-xs' : 'text-base'}`}>{order.payee}</span></div>
                    <div className={`bg-gray-100/50 border-2 border-black print:bg-transparent print:border-black print:!border-solid ${isCompact ? 'p-1 px-1.5' : 'p-2'} rounded print:rounded-none`} style={{borderStyle: 'solid', borderWidth: '2px'}}><span className="block text-gray-600 print:text-black text-[9px] mb-0.5 font-bold underline underline-offset-2">مبلغ کل پرداختی:</span><span className={`font-bold text-gray-900 print:text-black ${isCompact ? 'text-xs' : 'text-base'}`}>{formatCurrency(order.totalAmount)}</span></div>
                </div>
                <div className={`bg-gray-100/50 border-2 border-black print:border-black print:!border-solid ${isCompact ? 'p-1 px-1.5 min-h-[22px]' : 'p-2 min-h-[45px]'} rounded print:rounded-none`} style={{borderStyle: 'solid', borderWidth: '2px'}}><span className="block text-gray-600 print:text-black text-[9px] mb-0.5 font-bold underline underline-offset-2">بابت (شرح پرداخت):</span><p className={`text-gray-800 print:text-black text-justify font-medium leading-tight ${isCompact ? 'text-[9px]' : 'text-xs'}`}>{order.description}</p></div>
                <div className="border-2 border-black print:border-black print:!border-solid rounded print:rounded-none overflow-hidden" style={{borderStyle: 'solid', borderWidth: '2px'}}>
                    <table className={`w-full text-right ${isCompact ? 'text-[8.5px]' : 'text-[10px]'}`}>
                        <thead className="bg-gray-200 print:bg-transparent border-b border-black print:border-black" style={{borderBottomStyle: 'solid', borderBottomWidth: '2px'}}><tr><th className={`${isCompact ? 'p-0.5 px-1' : 'p-1.5'} font-bold text-gray-600 print:text-black w-6 text-center`}>#</th><th className={`${isCompact ? 'p-0.5 px-1' : 'p-1.5'} font-bold text-gray-600 print:text-black`}>نوع پرداخت</th><th className={`${isCompact ? 'p-0.5 px-1' : 'p-1.5'} font-bold text-gray-600 print:text-black`}>مبلغ</th><th className={`${isCompact ? 'p-0.5 px-1' : 'p-1.5'} font-bold text-gray-600 print:text-black`}>بانک / چک / شبا</th><th className={`${isCompact ? 'p-0.5 px-1' : 'p-1.5'} font-bold text-gray-600 print:text-black`}>توضیحات</th></tr></thead>
                        <tbody className="divide-y divide-black">{order.paymentDetails.map((detail, idx) => (
                            <tr key={detail.id}>
                                <td className={`${isCompact ? 'p-0.5 px-1' : 'p-1.5'} text-center`}>{idx + 1}</td>
                                <td className={`${isCompact ? 'p-0.5 px-1' : 'p-1.5'} font-bold`}>{detail.method}</td>
                                <td className={`${isCompact ? 'p-0.5 px-1' : 'p-1.5'} font-mono`}>{formatCurrency(detail.amount)}</td>
                                <td className={`${isCompact ? 'p-0.5 px-1' : 'p-1.5'} truncate`}>
                                    {detail.method === PaymentMethod.CHEQUE ? `چک: ${detail.chequeNumber}` : detail.method === PaymentMethod.SHEBA || detail.method === PaymentMethod.SATNA || detail.method === PaymentMethod.PAYA ? `شبا: IR-${detail.sheba}` : detail.method === PaymentMethod.INTERNAL_TRANSFER ? `به حساب: ${detail.destinationAccount} (${detail.destinationOwner})` : detail.method === PaymentMethod.TRANSFER ? `بانک: ${detail.bankName}` : '-'}
                                </td>
                                <td className={`${isCompact ? 'p-0.5 px-1' : 'p-1.5'} text-gray-600`}>{detail.description || '-'}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </div>
        </div>
        <div className={`mt-auto ${isCompact ? 'pt-0.5' : 'pt-2'} border-t-2 border-gray-800 relative z-10`}>
            <div className="grid grid-cols-4 gap-2 text-center">
                <div className={`flex flex-col items-center justify-end ${isCompact ? 'min-h-[35px]' : 'min-h-[60px]'}`}><div className="mb-0.5 flex items-center justify-center h-full"><Stamp name={order.requester} title="درخواست کننده" /></div><div className="w-full border-t border-gray-400 pt-0.5"><span className="text-[8px] font-bold text-gray-600">درخواست کننده</span></div></div>
                <div className={`flex flex-col items-center justify-end ${isCompact ? 'min-h-[35px]' : 'min-h-[60px]'}`}><div className="mb-0.5 flex items-center justify-center h-full">{(order.approverFinancial || [OrderStatus.APPROVED_FINANCE, OrderStatus.APPROVED_MANAGER, OrderStatus.APPROVED_CEO, OrderStatus.PAID].includes(order.status)) ? <Stamp name={order.approverFinancial || 'تایید شده'} title="تایید مالی" /> : <span className="text-gray-300 text-[8px]">امضا نشده</span>}</div><div className="w-full border-t border-gray-400 pt-0.5"><span className="text-[8px] font-bold text-gray-600">مدیر مالی</span></div></div>
                <div className={`flex flex-col items-center justify-end ${isCompact ? 'min-h-[35px]' : 'min-h-[60px]'}`}><div className="mb-0.5 flex items-center justify-center h-full">{(order.approverManager || [OrderStatus.APPROVED_MANAGER, OrderStatus.APPROVED_CEO, OrderStatus.PAID].includes(order.status)) ? <Stamp name={order.approverManager || 'تایید شده'} title="تایید مدیریت" /> : <span className="text-gray-300 text-[8px]">امضا نشده</span>}</div><div className="w-full border-t border-gray-400 pt-0.5"><span className="text-[8px] font-bold text-gray-600">مدیریت</span></div></div>
                <div className={`flex flex-col items-center justify-end ${isCompact ? 'min-h-[35px]' : 'min-h-[60px]'}`}><div className="mb-0.5 flex items-center justify-center h-full">{(order.approverCeo || [OrderStatus.APPROVED_CEO, OrderStatus.PAID].includes(order.status)) ? <Stamp name={order.approverCeo || 'تایید شده'} title="مدیر عامل" /> : <span className="text-gray-300 text-[8px]">امضا نشده</span>}</div><div className="w-full border-t border-gray-400 pt-0.5"><span className="text-[8px] font-bold text-gray-600">مدیر عامل</span></div></div>
            </div>
        </div>
      </div>
  );

  const [approveLoading, setApproveLoading] = useState(false);

  const contentToRender = (printMode === 'bank_form' && canPrintBankForm) ? <DynamicBankFormOverlay /> : receiptContent;
  if (embed) return contentToRender;

  return createPortal(
    <div className="printing-modal fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex flex-col items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-start p-2 animate-fade-in safe-pb">
      <div className="w-full max-w-4xl mx-auto z-[210] no-print mb-2 shrink-0">
         <div className="bg-white p-2 rounded-xl shadow-lg flex flex-col gap-2 w-full border border-gray-200">
             <div className="flex items-center justify-between border-b pb-1">
                 <h3 className="font-bold text-gray-800 text-[10px] flex items-center gap-1">
                     {isRevocationProcess ? <span className="text-red-600 flex items-center gap-1 animate-pulse"><AlertTriangle size={12}/> چرخه ابطال</span> : 'عملیات'}
                 </h3>
                 <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={16}/></button>
             </div>
             
             {(onApprove || onReject || onEdit || onRevoke) && (
                <div className="flex items-center justify-center gap-2 mb-1">
                    {onApprove && (
                        <button 
                            onClick={async () => {
                                setApproveLoading(true);
                                try { await onApprove(); } finally { setApproveLoading(false); }
                            }} 
                            disabled={approveLoading}
                            className={`px-3 py-1 rounded-lg flex items-center gap-1 text-[10px] font-bold transition-all active:scale-95 shadow-sm ${isRevocationProcess ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-green-600 text-white hover:bg-green-700'}`}
                        >
                            {approveLoading ? <Loader2 size={12} className="animate-spin"/> : (isRevocationProcess ? <XCircle size={12}/> : <CheckCircle size={12} />)}
                            {isRevocationProcess ? 'تایید ابطال' : 'تایید نهایی'}
                        </button>
                    )}
                    {onReject && <button onClick={onReject} className="px-3 py-1 bg-white border border-red-200 text-red-600 rounded-lg flex items-center gap-1 text-[10px] font-bold transition-all active:scale-95 hover:bg-red-50"><XCircle size={12} /> رد</button>}
                    {onRevoke && !isRevocationProcess && !isRevoked && <button onClick={onRevoke} className="px-3 py-1 bg-white border border-orange-200 text-orange-600 rounded-lg flex items-center gap-1 text-[10px] font-bold transition-all active:scale-95 hover:bg-orange-50"><RotateCcw size={12} /> ابطال</button>}
                    {onEdit && !isRevocationProcess && <button onClick={onEdit} className="p-1 bg-white border border-gray-200 text-gray-600 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-all active:scale-95"><Pencil size={12} /></button>}
                </div>
             )}
             
             <div className="flex flex-wrap items-center justify-center gap-2">
                 <button onClick={handleDownloadPDF} disabled={processing} className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1 rounded-lg flex items-center gap-1 text-[10px] font-bold transition-colors">{processing ? <Loader2 size={12} className="animate-spin"/> : <FileDown size={12} />} PDF</button>
                 <button onClick={handlePrint} disabled={processing} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg flex items-center gap-1 text-[10px] font-bold transition-colors shadow-sm">{processing ? <Loader2 size={12} className="animate-spin"/> : <Printer size={12} />} چاپ</button>
                 <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
                 <button onClick={() => setSharePlatform(sharePlatform === 'whatsapp' ? null : 'whatsapp')} className={`px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-all ${sharePlatform === 'whatsapp' ? 'bg-green-500 text-white border-green-600' : 'bg-white border-gray-200 text-green-600 hover:bg-green-50'}`}><Share2 size={12}/> واتساپ</button>
                 <button onClick={() => setSharePlatform(sharePlatform === 'bale' ? null : 'bale')} className={`px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-all ${sharePlatform === 'bale' ? 'bg-green-500 text-white border-green-600' : 'bg-white border-gray-200 text-green-600 hover:bg-green-50'}`}><Share2 size={12}/> بله</button>
                 <button onClick={() => setSharePlatform(sharePlatform === 'telegram' ? null : 'telegram')} className={`px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-all ${sharePlatform === 'telegram' ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-gray-200 text-blue-600 hover:bg-blue-50'}`}><Share2 size={12}/> تلگرام</button>
                 {canPrintBankForm && (
                     <button onClick={() => setPrintMode(printMode === 'receipt' ? 'bank_form' : 'receipt')} className={`px-3 py-1 rounded-lg flex items-center gap-1 text-[10px] font-bold transition-colors border ${printMode === 'bank_form' ? 'bg-teal-100 text-teal-700 border-teal-200' : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'}`}><LayoutTemplate size={12}/> {printMode === 'receipt' ? `قالب بانکی` : 'رسید داخلی'}</button>
                 )}
             </div>

             {sharePlatform && (
                 <div className="mt-2 bg-gray-50 rounded-xl shadow-inner border border-gray-200 z-[60] overflow-hidden animate-scale-in">
                     <div className="p-2 border-b flex justify-between items-center"><span className="text-xs font-bold text-gray-600">انتخاب مخاطب {sharePlatform === 'whatsapp' ? 'واتساپ' : sharePlatform === 'bale' ? 'بله' : 'تلگرام'}</span><button onClick={() => setSharePlatform(null)}><X size={14}/></button></div>
                     <div className="p-2 border-b"><input className="w-full text-xs p-1 border rounded" placeholder="جستجو..." value={contactSearch} onChange={e=>setContactSearch(e.target.value)} autoFocus/></div>
                     <div className="max-h-40 overflow-y-auto">{filteredContacts.map(c => {
                         let targetId = c.number;
                         if (sharePlatform === 'telegram') targetId = (c.telegramId || '').trim() || c.number;
                         if (sharePlatform === 'bale') targetId = (c.baleId || '').trim() || c.number;
                         return (
                           <div key={c.id} className="w-full text-right p-2 hover:bg-blue-50 text-xs flex justify-between items-center border-b border-gray-50 last:border-0"><span className="font-bold text-gray-800">{c.name}</span><button onClick={() => { if(!targetId){alert("آیدی تنظیم نشده");return;} handleShare(targetId); }} className="bg-green-600 text-white px-3 py-1 rounded text-[10px]">ارسال</button></div>
                         );
                     })}</div>
                 </div>
             )}

             {printMode === 'bank_form' && (
                 <div className="col-span-2 md:col-span-4 flex flex-col gap-2 mt-2 bg-gray-50 p-2 rounded border animate-fade-in">
                     {paymentLines.length > 1 && (
                         <div className="flex items-center justify-between glass-panel p-2 rounded border border-gray-200 mb-2">
                             <button onClick={() => setCurrentLineIndex(prev => Math.max(0, prev - 1))} disabled={currentLineIndex === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={16}/></button>
                             <span className="text-xs font-bold text-gray-700">ردیف {currentLineIndex + 1} از {paymentLines.length} - {currentLine.method} ({formatCurrency(currentLine.amount)})</span>
                             <button onClick={() => setCurrentLineIndex(prev => Math.min(paymentLines.length - 1, prev + 1))} disabled={currentLineIndex === paymentLines.length - 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={16}/></button>
                         </div>
                     )}
                     <div className="bg-blue-50 p-2 rounded border border-blue-100 mb-2">
                         <div className="text-xs font-bold text-blue-800 mb-1 flex items-center gap-1"><Pencil size={12}/> ویرایش اطلاعات چاپ (دستی):</div>
                         <div className="flex gap-2 mb-1"><div className="flex items-center gap-1 flex-1"><Calendar size={12} className="text-gray-500"/><input className="w-10 text-center border rounded text-xs p-0.5" value={overrideDate.day} onChange={e=>setOverrideDate({...overrideDate, day: e.target.value})} placeholder="روز"/><span className="text-gray-400">/</span><input className="w-10 text-center border rounded text-xs p-0.5" value={overrideDate.month} onChange={e=>setOverrideDate({...overrideDate, month: e.target.value})} placeholder="ماه"/><span className="text-gray-400">/</span><input className="w-12 text-center border rounded text-xs p-0.5" value={overrideDate.year} onChange={e=>setOverrideDate({...overrideDate, year: e.target.value})} placeholder="سال"/></div></div>
                         <div className="flex gap-1 items-center"><MapPin size={12} className="text-gray-500"/><input className="w-full border rounded text-xs p-1" placeholder="محل صدور (شهر)..." value={overridePlace} onChange={e=>setOverridePlace(e.target.value)}/></div>
                     </div>
                     {isDualPrintEnabled && (
                         <div className="flex gap-1 glass-panel p-1 rounded border border-orange-200 mb-2">
                             <button onClick={() => setDualPrintMode('full')} className={`flex-1 text-[10px] font-bold py-1 rounded ${dualPrintMode === 'full' ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:bg-gray-50'}`}>کامل</button>
                             <button onClick={() => setDualPrintMode('withdrawal')} className={`flex-1 text-[10px] font-bold py-1 rounded ${dualPrintMode === 'withdrawal' ? 'bg-red-100 text-red-700' : 'text-gray-500 hover:bg-gray-50'}`}>نسخه برداشت</button>
                             <button onClick={() => setDualPrintMode('deposit')} className={`flex-1 text-[10px] font-bold py-1 rounded ${dualPrintMode === 'deposit' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}>نسخه واریز</button>
                         </div>
                     )}
                     <label className="flex items-center gap-2 text-xs cursor-pointer select-none"><input type="checkbox" checked={showFormBackground} onChange={e => setShowFormBackground(e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/>چاپ زمینه (عکس فرم خام)</label>
                     <div className="flex items-center justify-between"><button onClick={() => setShowCalibration(!showCalibration)} className="text-xs flex items-center gap-1 text-blue-600 font-bold"><Settings2 size={12}/> کالیبراسیون چاپ</button>{showCalibration && <div className="text-[10px] text-gray-500">X: {calibration.x} | Y: {calibration.y}</div>}</div>
                     {showCalibration && (
                         <div className="grid grid-cols-4 gap-1">
                             <button onClick={() => updateCalibration(0, -1)} className="glass-panel border rounded p-1 hover:bg-gray-100">⬆️</button>
                             <button onClick={() => updateCalibration(0, 1)} className="glass-panel border rounded p-1 hover:bg-gray-100">⬇️</button>
                             <button onClick={() => updateCalibration(-1, 0)} className="glass-panel border rounded p-1 hover:bg-gray-100">⬅️</button>
                             <button onClick={() => updateCalibration(1, 0)} className="glass-panel border rounded p-1 hover:bg-gray-100">➡️</button>
                         </div>
                     )}
                 </div>
             )}
         </div>
      </div>
      <div className="flex-1 w-full overflow-y-auto flex justify-center pb-10" ref={containerWrapperRef}>
          <div style={{ width: (printMode === 'bank_form' && dynamicTemplate) ? `${dynamicTemplate.width || 210}mm` : '210mm', height: (printMode === 'bank_form' && dynamicTemplate) ? `${dynamicTemplate.height || 297}mm` : '148mm', backgroundColor: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transform: `scale(${scale})`, transformOrigin: 'top center', marginBottom: `${(1 - scale) * -100}px` }}>{contentToRender}</div>
      </div>
    </div>,
    document.body
  );
};

export default PrintVoucher;
