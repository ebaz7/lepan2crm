import React, { useState, useEffect, useRef } from 'react';
import { ExitPermit, ExitPermitItem, SystemSettings } from '../types';
import { Save, X, Package, Calculator, Plus, Trash2, RefreshCw, CheckCircle2, FileText, ArrowDownToLine, Eye, AlertCircle } from 'lucide-react';
import { generateUUID } from '../constants';
import { lookupSayanSalesRemittance, SayanSalesRemittanceResult, captureElementToDataUrl } from '../services/sayanExitService';
import SayanSalesRemittanceDoc, { SayanRemittanceData } from './SayanSalesRemittanceDoc';
import { getSettings } from '../services/storageService';

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  onConfirm: (updatedItems: ExitPermitItem[], sayanRemittanceData?: SayanSalesRemittanceResult | null, attachmentDataUrl?: string) => void;
}

const WarehouseFinalizeModal: React.FC<Props> = ({ permit, onClose, onConfirm }) => {
  const [items, setItems] = useState<ExitPermitItem[]>(
    permit.items && permit.items.length > 0 
      ? permit.items.map(i => ({
          ...i,
          deliveredCartonCount: i.deliveredCartonCount !== undefined && i.deliveredCartonCount !== null ? i.deliveredCartonCount : 0,
          deliveredWeight: i.deliveredWeight !== undefined && i.deliveredWeight !== null ? i.deliveredWeight : 0
        })) 
      : [{ id: generateUUID(), goodsName: permit.goodsName || '', cartonCount: permit.cartonCount || 0, weight: permit.weight || 0, deliveredCartonCount: 0, deliveredWeight: 0 }]
  );

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loadingSayan, setLoadingSayan] = useState(false);
  const [sayanRemittance, setSayanRemittance] = useState<SayanSalesRemittanceResult | null>(permit.sayanRemittanceDoc || null);
  const [sayanError, setSayanError] = useState<string | null>(null);
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getSettings().then(st => {
      setSettings(st);
      if (st.sayanOnlineExitPermitsEnabled) {
        fetchSayanRemittance();
      }
    }).catch(console.error);
  }, []);

  const fetchSayanRemittance = async () => {
    setLoadingSayan(true);
    setSayanError(null);
    try {
      const personCode = permit.sayanPersonCode || permit.destinations?.[0]?.sayanPersonCode;
      const recipientName = permit.recipientName || permit.destinations?.[0]?.recipientName;

      const res = await lookupSayanSalesRemittance({
        personCode,
        recipientName,
        permitDate: permit.date,
        permitNumber: permit.permitNumber
      });

      if (res) {
        setSayanRemittance(res);
      } else {
        setSayanError('حواله فروشی برای این مشتری در سایان یافت نشد');
      }
    } catch (e: any) {
      setSayanError(e.message || 'خطا در ارتباط با سایان');
    } finally {
      setLoadingSayan(false);
    }
  };

  const applySayanValuesToItems = () => {
    if (!sayanRemittance || !sayanRemittance.items || sayanRemittance.items.length === 0) return;

    const newItems: ExitPermitItem[] = sayanRemittance.items.map((it, idx) => ({
      id: generateUUID(),
      goodsName: it.goodsName || `کالا ${idx + 1}`,
      cartonCount: it.cartonCount || 0,
      weight: it.netQty || 0,
      deliveredCartonCount: it.cartonCount || 0,
      deliveredWeight: it.netQty || 0,
      grossWeight: it.grossQty || it.netQty || 0,
      bobbinCount: it.bobbinCount || 0,
      grade: it.grade || 'AA',
      twistDirection: it.twistDirection || 'Z',
      itemCode: it.itemCode || '',
      description: it.description || ''
    }));

    setItems(newItems);
  };

  const handleUpdateItem = (index: number, field: keyof ExitPermitItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, { id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0, deliveredCartonCount: 0, deliveredWeight: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return alert("حداقل یک ردیف کالا باید وجود داشته باشد.");
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const totalRequestedCount = items.reduce((sum, i) => sum + (Number(i.cartonCount) || 0), 0);
  const totalDeliveredCount = items.reduce((sum, i) => sum + (Number(i.deliveredCartonCount) || 0), 0);
  const totalRequestedWeight = items.reduce((sum, i) => sum + (Number(i.weight) || 0), 0);
  const totalDeliveredWeight = items.reduce((sum, i) => sum + (Number(i.deliveredWeight) || 0), 0);

  const handleSave = async () => {
    if (items.some(i => !i.goodsName)) return alert("نام کالا نمی‌تواند خالی باشد.");
    if (items.some(i => i.deliveredCartonCount === undefined || i.deliveredCartonCount === null || i.deliveredCartonCount <= 0)) {
      return alert("وارد کردن تعداد کارتن خروجی معتبر برای تمامی ردیف‌ها الزامی است.");
    }
    if (items.some(i => !i.deliveredWeight || i.deliveredWeight <= 0)) return alert("وارد کردن وزن خروجی برای تمامی ردیف‌ها الزامی است.");
    
    setIsSubmitting(true);
    let attachmentDataUrl: string | undefined = undefined;

    // Capture Sayan Sales Remittance Doc image if active
    if (settings?.sayanOnlineExitPermitsEnabled || sayanRemittance) {
      try {
        const elId = 'hidden-sayan-remittance-capture';
        attachmentDataUrl = await captureElementToDataUrl(elId);
      } catch (err) {
        console.warn('Could not generate Sayan remittance image attachment:', err);
      }
    }

    const finalizedItems = items.map(i => ({
        ...i,
        cartonCount: Number(i.cartonCount), 
        weight: Number(i.weight),
        deliveredCartonCount: Number(i.deliveredCartonCount),
        deliveredWeight: Number(i.deliveredWeight)
    }));

    onConfirm(finalizedItems, sayanRemittance, attachmentDataUrl);
  };

  // Prepare data for Sayan Document Rendering
  const sayanDocData: SayanRemittanceData = {
    companyTitle: permit.company || 'شرکت لپان بافت',
    remittanceNumber: sayanRemittance?.remittanceNumber || permit.permitNumber || '---',
    subCode: sayanRemittance?.subCode || '---',
    archiveCode: sayanRemittance?.archiveCode || '---',
    shamsiDate: sayanRemittance?.shamsiDate || permit.date || '---',
    recipientName: sayanRemittance?.personFullName || permit.recipientName || permit.destinations?.[0]?.recipientName || '---',
    recipientCode: sayanRemittance?.personCode || permit.sayanPersonCode || permit.destinations?.[0]?.sayanPersonCode,
    tafsiliCode: permit.sayanTafsiliCode || permit.destinations?.[0]?.sayanTafsiliCode,
    recipientAddress: sayanRemittance?.personAddress || permit.destinationAddress || permit.destinations?.[0]?.address,
    recipientPhone: sayanRemittance?.personPhone || permit.driverPhone || permit.destinations?.[0]?.phone,
    items: (sayanRemittance?.items && sayanRemittance.items.length > 0 ? sayanRemittance.items : items).map((it: any, idx) => ({
      rowNo: idx + 1,
      goodsName: it.goodsName || '---',
      netQty: Number(it.deliveredWeight || it.netQty || it.weight || 0),
      grossQty: Number(it.grossWeight || it.grossQty || it.deliveredWeight || it.netQty || 0),
      cartonCount: Number(it.deliveredCartonCount || it.cartonCount || 0),
      bobbinCount: Number(it.bobbinCount || 0),
      grade: it.grade || 'AA',
      twistDirection: it.twistDirection || 'Z',
      description: it.description || ''
    })),
    notes: permit.description || '',
    creatorName: permit.requester || 'مسئول فروش',
    warehouseKeeperName: permit.approverWarehouse || 'سرپرست انبار',
    managerName: permit.approverFactory || 'مدیریت کارخانه',
    securityGuardName: permit.approverSecurity || 'انتظامات'
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-start pt-12 md:pt-16 pb-28 overflow-y-auto overflow-x-hidden justify-center p-4 animate-fade-in">
      <div className="glass-panel rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><Package size={24} /></div>
            <div>
              <h3 className="font-bold text-lg text-gray-800">تایید نهایی انبار و توزین خروج</h3>
              <p className="text-xs text-gray-500">
                {settings?.sayanOnlineExitPermitsEnabled 
                  ? 'یکپارچه با حواله فروش آنلاین سایان ERP' 
                  : 'لطفاً مقدار دقیق خروجی را وارد کنید.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} data-close-modal="true" className="text-gray-400 hover:text-red-500 transition-colors"><X size={24} /></button>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 flex-1 min-h-0 space-y-4">
          
          {/* Sayan ERP Live Banner */}
          {settings?.sayanOnlineExitPermitsEnabled && (
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-mono font-bold text-xs">
                    ERP
                  </div>
                  <span>استعلام و اتصال حواله فروش سایان:</span>
                  <span className="text-xs text-indigo-700 font-mono">
                    {permit.recipientName || permit.destinations?.[0]?.recipientName}
                    {(permit.sayanPersonCode || permit.destinations?.[0]?.sayanPersonCode) && ` (کد: ${permit.sayanPersonCode || permit.destinations?.[0]?.sayanPersonCode})`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchSayanRemittance}
                    disabled={loadingSayan}
                    className="text-xs bg-white text-indigo-700 border border-indigo-300 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 hover:bg-indigo-50 transition-colors shadow-2xs"
                  >
                    <RefreshCw size={14} className={loadingSayan ? "animate-spin" : ""} />
                    {loadingSayan ? "در حال استعلام..." : "بروزرسانی از سایان"}
                  </button>
                  {sayanRemittance && (
                    <button
                      type="button"
                      onClick={() => setShowDocPreview(true)}
                      className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 hover:bg-indigo-700 transition-colors shadow-xs"
                    >
                      <Eye size={14} /> مشاهده پیش‌نمایش حواله
                    </button>
                  )}
                </div>
              </div>

              {sayanRemittance ? (
                <div className="bg-white p-3.5 rounded-xl border border-indigo-100 flex items-center justify-between flex-wrap gap-3">
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span>حواله فروش شماره {sayanRemittance.remittanceNumber} در سایان یافت شد</span>
                      {sayanRemittance.shamsiDate && <span className="text-gray-500 font-mono">({sayanRemittance.shamsiDate})</span>}
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      شامل <b>{sayanRemittance.items?.length || 0} ردیف کالا</b> | جمع وزن خالص: <b>{sayanRemittance.totalNetWeight} کیلوگرم</b> | کارتن: <b>{sayanRemittance.totalCartons}</b> | بوبین: <b>{sayanRemittance.totalBobbins}</b>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={applySayanValuesToItems}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <ArrowDownToLine size={16} /> جایگذاری اقلام سایان در جدول
                  </button>
                </div>
              ) : sayanError ? (
                <div className="bg-amber-50 text-amber-800 p-2.5 rounded-xl text-xs flex items-center gap-2 border border-amber-200">
                  <AlertCircle size={16} className="text-amber-600" />
                  <span>{sayanError}</span>
                </div>
              ) : null}
            </div>
          )}

          {/* Table */}
          <div className="glass-panel rounded-xl border border-gray-200/50 dark:border-white/10 shadow-sm overflow-x-auto w-full max-w-full block" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full min-w-[700px] text-sm text-center">
              <thead className="bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 text-gray-700 font-bold whitespace-nowrap">
                <tr>
                  <th className="p-3 w-10">#</th>
                  <th className="p-3 text-right">شرح کالا</th>
                  <th className="p-3 w-24 bg-blue-50 text-blue-800 border-l border-white">عدد/کارتن (درخواست)</th>
                  <th className="p-3 w-24 bg-green-50 text-green-800">کارتن خروجی</th>
                  <th className="p-3 w-32 bg-blue-50 text-blue-800 border-l border-white">وزن درخواستی</th>
                  <th className="p-3 w-32 bg-green-50 text-green-800">وزن خروجی (خالص)</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-3 text-gray-500 font-mono">{idx + 1}</td>
                    <td className="p-3">
                      <input className="w-full border rounded-lg p-2 text-sm font-bold" value={item.goodsName} onChange={e => handleUpdateItem(idx, 'goodsName', e.target.value)} placeholder="نام کالا"/>
                      {(item.bobbinCount || item.grade || item.twistDirection) && (
                        <div className="text-[10px] text-gray-500 mt-1 flex gap-2">
                          {item.bobbinCount ? <span>بوبین: {item.bobbinCount}</span> : null}
                          {item.grade ? <span>گرید: {item.grade}</span> : null}
                          {item.twistDirection ? <span>تاب: {item.twistDirection}</span> : null}
                        </div>
                      )}
                    </td>
                    <td className="p-3 bg-blue-50/30 font-mono text-gray-500 border-l border-gray-100">{item.cartonCount}</td>
                    <td className="p-3 bg-green-50/30"><input type="number" className="w-full border rounded-lg p-2 text-center font-mono font-bold text-green-700 outline-none glass-panel" value={item.deliveredCartonCount || ''} onChange={e => handleUpdateItem(idx, 'deliveredCartonCount', e.target.value === '' ? 0 : Number(e.target.value))}/></td>
                    <td className="p-3 bg-blue-50/30 font-mono text-gray-500 border-l border-gray-100">{Number(item.weight || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</td>
                    <td className="p-3 bg-green-50/30"><input type="number" step="0.001" className="w-full border rounded-lg p-2 text-center font-mono font-bold text-green-700 outline-none glass-panel text-lg" value={item.deliveredWeight || ''} onChange={e => handleUpdateItem(idx, 'deliveredWeight', e.target.value === '' ? 0 : Number(e.target.value))}/></td>
                    <td className="p-3 text-center"><button onClick={() => handleRemoveItem(idx)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={18}/></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={2} className="p-3 text-left pl-6 font-bold text-gray-600 flex items-center justify-between">
                    <button onClick={handleAddItem} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 font-bold border border-blue-200">
                      <Plus size={14}/> افزودن کالا
                    </button>
                    <span className="flex items-center gap-2"><Calculator size={16}/> جمع کل:</span>
                  </td>
                  <td className="p-3 font-bold text-gray-500 font-mono text-lg bg-blue-50/30 border-l border-gray-200">{totalRequestedCount}</td>
                  <td className="p-3 font-black text-green-700 font-mono text-lg bg-green-50/30 border-l border-gray-200">{totalDeliveredCount}</td>
                  <td className="p-3 font-bold text-gray-500 font-mono text-lg bg-blue-50/30 border-l border-gray-200">{Number(totalRequestedWeight.toFixed(3))}</td>
                  <td className="p-3 font-black text-green-700 font-mono text-xl bg-green-50/30">{Number(totalDeliveredWeight.toFixed(3))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t glass-panel flex justify-between items-center flex-wrap gap-2">
          <div className="text-xs text-gray-500 font-medium">
            {settings?.sayanOnlineExitPermitsEnabled && (
              <span className="text-emerald-700 flex items-center gap-1 font-bold">
                <CheckCircle2 size={14} /> سند حواله فروش رسمی به صورت خودکار به برگه پیوست خواهد شد.
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-6 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50">انصراف</button>
            <button 
              onClick={handleSave} 
              disabled={isSubmitting}
              className="px-6 py-2 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={18} /> {isSubmitting ? "در حال ثبت و ارسال..." : "تایید نهایی و ارسال به انتظامات"}
            </button>
          </div>
        </div>
      </div>

      {/* Sayan Document Preview Modal */}
      {showDocPreview && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-4 relative shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" />
                سند رسمی حواله فروش سایان ERP
              </h3>
              <button onClick={() => setShowDocPreview(false)} className="text-gray-400 hover:text-red-500">
                <X size={22} />
              </button>
            </div>
            <div className="overflow-x-auto flex justify-center py-2">
              <SayanSalesRemittanceDoc data={sayanDocData} showStamps={true} />
            </div>
          </div>
        </div>
      )}

      {/* Hidden Offscreen Element for Automatic Capture on Save */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '820px' }}>
        <SayanSalesRemittanceDoc id="hidden-sayan-remittance-capture" data={sayanDocData} showStamps={true} />
      </div>
    </div>
  );
};

export default WarehouseFinalizeModal;
