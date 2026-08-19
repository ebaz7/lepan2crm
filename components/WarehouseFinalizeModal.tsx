import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExitPermit, ExitPermitItem, SystemSettings } from '../types';
import { Save, X, Package, Calculator, Plus, Trash2, RefreshCw, CheckCircle2, FileText, ArrowDownToLine, Eye, AlertCircle, Filter, Search } from 'lucide-react';
import { generateUUID } from '../constants';
import { lookupSayanSalesRemittance, fetchSayanSalesRemittances, SayanSalesRemittanceResult, captureElementToDataUrl } from '../services/sayanExitService';
import SayanSalesRemittanceDoc, { SayanRemittanceData } from './SayanSalesRemittanceDoc';
import { getSettings } from '../services/storageService';
import * as jalaali from 'jalaali-js';

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  onConfirm: (updatedItems: ExitPermitItem[], sayanRemittanceData?: SayanSalesRemittanceResult | null, attachmentDataUrl?: string, sayanRemittanceDocs?: SayanSalesRemittanceResult[]) => void;
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
  
  // Manage multiple attached remittances
  const [attachedRemittances, setAttachedRemittances] = useState<SayanSalesRemittanceResult[]>(
    permit.sayanRemittanceDocs || (permit.sayanRemittanceDoc ? [permit.sayanRemittanceDoc] : [])
  );
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingSayan, setSearchingSayan] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Shamsi Date Helpers for Sayan Reports Style
  const getTodayJalaliStr = () => {
    const d = new Date();
    const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
  };

  const getMonthStartJalaliStr = () => {
    const d = new Date();
    const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return `${j.jy}/${String(j.jm).padStart(2, '0')}/01`;
  };

  const [dateFrom, setDateFrom] = useState<string>(getMonthStartJalaliStr());
  const [dateTo, setDateTo] = useState<string>(getTodayJalaliStr());
  const [docType, setDocType] = useState<string>('all_exit');
  const [searchResults, setSearchResults] = useState<SayanSalesRemittanceResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const setQuickDate = (type: 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all') => {
    const now = new Date();
    const jToday = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const todayStr = `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;

    if (type === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (type === 'yesterday') {
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const jYest = jalaali.toJalaali(yest.getFullYear(), yest.getMonth() + 1, yest.getDate());
      const yestStr = `${jYest.jy}/${String(jYest.jm).padStart(2, '0')}/${String(jYest.jd).padStart(2, '0')}`;
      setDateFrom(yestStr);
      setDateTo(yestStr);
    } else if (type === 'week') {
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const jWeek = jalaali.toJalaali(lastWeek.getFullYear(), lastWeek.getMonth() + 1, lastWeek.getDate());
      const weekStr = `${jWeek.jy}/${String(jWeek.jm).padStart(2, '0')}/${String(jWeek.jd).padStart(2, '0')}`;
      setDateFrom(weekStr);
      setDateTo(todayStr);
    } else if (type === 'month') {
      setDateFrom(`${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/01`);
      setDateTo(todayStr);
    } else if (type === 'year') {
      setDateFrom(`${jToday.jy}/01/01`);
      setDateTo(todayStr);
    } else if (type === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  };

  const [sayanError, setSayanError] = useState<string | null>(null);
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to merge multiple Sayan sales remittances
  const getMergedRemittance = (remittances: SayanSalesRemittanceResult[]): SayanSalesRemittanceResult | null => {
    if (!remittances || remittances.length === 0) return null;
    if (remittances.length === 1) return remittances[0];

    const mergedItems: any[] = [];
    let totalNetWeight = 0;
    let totalGrossWeight = 0;
    let totalCartons = 0;
    let totalBobbins = 0;

    remittances.forEach(rem => {
      if (Array.isArray(rem.items)) {
        rem.items.forEach(it => {
          mergedItems.push({
            ...it,
            goodsName: `${it.goodsName} (حواله ${rem.remittanceNumber})`
          });
        });
      }
      totalNetWeight += Number(rem.totalNetWeight || 0);
      totalGrossWeight += Number(rem.totalGrossWeight || 0);
      totalCartons += Number(rem.totalCartons || 0);
      totalBobbins += Number(rem.totalBobbins || 0);
    });

    return {
      archiveCode: remittances.map(r => r.archiveCode).filter(Boolean).join('، '),
      remittanceNumber: remittances.map(r => r.remittanceNumber).filter(Boolean).join('، '),
      subCode: remittances.map(r => r.subCode).filter(Boolean).join('، '),
      docDate: remittances[0].docDate,
      shamsiDate: remittances.map(r => r.shamsiDate).filter(Boolean).join('، '),
      personCode: remittances[0].personCode,
      personFullName: remittances[0].personFullName,
      personAddress: remittances[0].personAddress,
      personPhone: remittances[0].personPhone,
      items: mergedItems,
      totalNetWeight: Number(totalNetWeight.toFixed(3)),
      totalGrossWeight: Number(totalGrossWeight.toFixed(3)),
      totalCartons,
      totalBobbins
    };
  };

  const sayanRemittance = getMergedRemittance(attachedRemittances);

  useEffect(() => {
    getSettings().then(st => {
      setSettings(st);
      if (st.sayanOnlineExitPermitsEnabled) {
        fetchSayanRemittance();
      }
    }).catch(console.error);
  }, []);

  const fetchSayanRemittance = async (forceOverwrite = false) => {
    setLoadingSayan(true);
    setSayanError(null);
    try {
      const personCode = permit.sayanPersonCode ? String(permit.sayanPersonCode) : (permit.destinations?.[0]?.sayanPersonCode ? String(permit.destinations?.[0]?.sayanPersonCode) : '');
      const recipientName = permit.recipientName || permit.destinations?.[0]?.recipientName || '';
      const permitNumberStr = permit.permitNumber ? String(permit.permitNumber) : '';

      let detectedTerm = '';
      if (personCode && personCode.trim() !== '' && personCode !== '0' && personCode !== '---') {
        detectedTerm = personCode.trim();
      } else if (recipientName && recipientName.trim() !== '') {
        detectedTerm = recipientName.replace(/\(.*\)/g, '').trim();
      } else if (permitNumberStr && permitNumberStr.trim() !== '') {
        detectedTerm = permitNumberStr.trim();
      }

      setSearchQuery(detectedTerm);

      // Perform deep automatic checking using fetchSayanSalesRemittances with relaxed date parameters
      const response = await fetchSayanSalesRemittances({
        dateFrom: '', // relaxed date from
        dateTo: '', // relaxed date to
        search: detectedTerm,
        docType: 'all_exit' // restricted only to sales (23) and exit (12)
      });

      if (response && response.success && response.remittances && response.remittances.length > 0) {
        const list = response.remittances;
        setSearchResults(list);
        setHasSearched(true);

        if (forceOverwrite || attachedRemittances.length === 0) {
          let toAttach: SayanSalesRemittanceResult[] = [];
          if (list.length === 1) {
            toAttach = [list[0]];
          } else {
            // Match Sayan Person Code if we have a match
            const matchCode = personCode ? personCode.trim() : '';
            if (matchCode) {
              toAttach = list.filter(r => r.personCode && String(r.personCode).trim() === matchCode);
            }
            // Match Name
            if (toAttach.length === 0 && recipientName) {
              const cleanRecipient = recipientName.replace(/\s+/g, '');
              toAttach = list.filter(r => r.personFullName && r.personFullName.replace(/\s+/g, '').includes(cleanRecipient));
            }
            // Fallback to first if still empty
            if (toAttach.length === 0) {
              toAttach = [list[0]];
            }
          }

          if (toAttach.length > 0) {
            setAttachedRemittances(toAttach);

            const merged = getMergedRemittance(toAttach);
            if (merged && merged.items && merged.items.length > 0) {
              const newItems: ExitPermitItem[] = merged.items.map((it, idx) => ({
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
            }
          }
        }
      } else {
        // Fallback check by Factory Exit Permit Number if we haven't searched for it yet
        if (permitNumberStr && permitNumberStr.trim() !== '' && detectedTerm !== permitNumberStr.trim()) {
          setSearchQuery(permitNumberStr.trim());
          const fallbackRes = await fetchSayanSalesRemittances({
            dateFrom: '',
            dateTo: '',
            search: permitNumberStr.trim(),
            docType: 'all_exit'
          });

          if (fallbackRes && fallbackRes.success && fallbackRes.remittances && fallbackRes.remittances.length > 0) {
            setSearchResults(fallbackRes.remittances);
            setHasSearched(true);

            if (forceOverwrite || attachedRemittances.length === 0) {
              setAttachedRemittances([fallbackRes.remittances[0]]);
              const merged = fallbackRes.remittances[0];
              if (merged.items && merged.items.length > 0) {
                const newItems: ExitPermitItem[] = merged.items.map((it, idx) => ({
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
              }
            }
            return;
          }
        }

        setSayanError('سیستم موفق به یافتن خودکار حواله متناظر در سایان نشد. لطفاً از کادر جستجوی زیر به صورت دستی استعلام بگیرید.');
      }
    } catch (e: any) {
      setSayanError(e.message || 'خطا در ارتباط با سایان');
    } finally {
      setLoadingSayan(false);
    }
  };

  const handleAttachRemittance = async () => {
    setSearchingSayan(true);
    setSearchError(null);
    setHasSearched(true);
    try {
      const response = await fetchSayanSalesRemittances({
        dateFrom,
        dateTo,
        search: searchQuery.trim(),
        docType
      });

      if (response && response.success) {
        setSearchResults(response.remittances || []);
      } else {
        setSearchError(response.message || 'خطا در دریافت اطلاعات از سایان');
        setSearchResults([]);
      }
    } catch (e: any) {
      setSearchError(e.message || 'خطا در ارتباط با سایان');
      setSearchResults([]);
    } finally {
      setSearchingSayan(false);
    }
  };

  const handleAttachRemittanceFromList = (rem: SayanSalesRemittanceResult) => {
    if (attachedRemittances.some(r => r.remittanceNumber === rem.remittanceNumber)) {
      setSearchError(`حواله شماره ${rem.remittanceNumber} قبلاً الحاق شده است`);
      return;
    }
    setAttachedRemittances([...attachedRemittances, rem]);
  };

  const handleDetachRemittance = (index: number) => {
    const next = [...attachedRemittances];
    next.splice(index, 1);
    setAttachedRemittances(next);
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

    onConfirm(finalizedItems, sayanRemittance, attachmentDataUrl, attachedRemittances);
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

  const modalContent = (
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
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 space-y-4 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-indigo-100">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-mono font-bold text-xs">
                    ERP
                  </div>
                  <span>استعلام و اتصال حواله‌های فروش سایان:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fetchSayanRemittance(true)}
                    disabled={loadingSayan}
                    className="text-xs bg-white text-indigo-700 border border-indigo-300 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 hover:bg-indigo-50 transition-colors shadow-2xs"
                  >
                    <RefreshCw size={14} className={loadingSayan ? "animate-spin" : ""} />
                    {loadingSayan ? "در حال استعلام خودکار..." : "استعلام خودکار اولیه"}
                  </button>
                  {sayanRemittance && (
                    <button
                      type="button"
                      onClick={() => setShowDocPreview(true)}
                      className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 hover:bg-indigo-700 transition-colors shadow-xs"
                    >
                      <Eye size={14} /> پیش‌نمایش حواله ادغامی
                    </button>
                  )}
                </div>
              </div>

              {/* List of Attached Remittances */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-indigo-950">حواله‌های متصل شده به این مجوز:</h4>
                {attachedRemittances.length === 0 ? (
                  <p className="text-xs text-indigo-600/70 italic">هیچ حواله‌ای متصل نشده است. از بخش جستجوی زیر برای یافتن و الصاق حواله‌ها استفاده کنید.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {attachedRemittances.map((rem, idx) => (
                      <div key={rem.remittanceNumber || idx} className="bg-white p-3 rounded-xl border border-indigo-100 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-indigo-900 font-bold">
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            <span>حواله شماره {rem.remittanceNumber}</span>
                            {rem.shamsiDate && <span className="text-[10px] text-gray-500 font-mono">({rem.shamsiDate})</span>}
                          </div>
                          <p className="text-[10px] text-gray-600">
                            مشتری: <b>{rem.personFullName}</b> | کالا: <b>{rem.items?.length || 0} ردیف</b> | وزن: <b>{rem.totalNetWeight} kg</b>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDetachRemittance(idx)}
                          className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-all"
                          title="حذف اتصال"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add/Search Section (Sayan Reports Style) */}
              <div className="bg-white/90 p-4 rounded-xl border border-indigo-100/80 space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-2 gap-2">
                  <h5 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Filter size={14} /> فیلترهای استعلام و جستجوی حواله‌ها در سایان (مشابه بخش گزارشات):
                  </h5>
                  {/* Quick Dates */}
                  <div className="flex flex-wrap gap-1 text-[10px] font-bold text-gray-500">
                    <button type="button" onClick={() => setQuickDate('today')} className="px-2 py-0.5 rounded bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 transition-all">امروز</button>
                    <button type="button" onClick={() => setQuickDate('yesterday')} className="px-2 py-0.5 rounded bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 transition-all">دیروز</button>
                    <button type="button" onClick={() => setQuickDate('week')} className="px-2 py-0.5 rounded bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 transition-all">۷ روز اخیر</button>
                    <button type="button" onClick={() => setQuickDate('month')} className="px-2 py-0.5 rounded bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 transition-all">ماه جاری</button>
                    <button type="button" onClick={() => setQuickDate('year')} className="px-2 py-0.5 rounded bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 transition-all">کل سال</button>
                    <button type="button" onClick={() => setQuickDate('all')} className="px-2 py-0.5 rounded bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 transition-all">همه</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Date From */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">از تاریخ (شمسی):</label>
                    <input
                      type="text"
                      placeholder="مثلاً ۱۴۰۳/۱۱/۰۱"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  {/* Date To */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">تا تاریخ (شمسی):</label>
                    <input
                      type="text"
                      placeholder="مثلاً ۱۴۰۳/۱۱/۳۰"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  {/* DocType */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">نوع سند:</label>
                    <select
                      value={docType}
                      onChange={e => setDocType(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-bold bg-white"
                    >
                      <option value="all_exit">همه اسناد خروج (فروش ۲۳ و خروج ۱۲)</option>
                      <option value="23">فقط حواله فروش (۲۳)</option>
                      <option value="12">فقط حواله خروج (۱۲)</option>
                    </select>
                  </div>

                  {/* Search Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">نام خریدار یا شماره حواله:</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="جستجو در فیلدها..."
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAttachRemittance(); } }}
                        className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-bold bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleAttachRemittance}
                        disabled={searchingSayan}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 text-xs"
                      >
                        {searchingSayan ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Search size={14} />
                        )}
                        <span>{searchingSayan ? "..." : "جستجو"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {searchError && (
                  <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1 bg-amber-50 p-1.5 rounded-lg border border-amber-100 mt-1">
                    <AlertCircle size={14} />
                    {searchError}
                  </p>
                )}

                {/* Search Results list of remittances inside Sayan banner */}
                {hasSearched && (
                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <h6 className="text-[11px] font-bold text-indigo-950 flex items-center gap-1.5">
                      🔍 نتایج جستجو در سایان ({searchResults.length} حواله یافت شد):
                    </h6>
                    {searchResults.length === 0 ? (
                      <p className="text-xs text-amber-600 italic bg-amber-50/50 p-3 rounded-lg border border-dashed border-amber-100">هیچ حواله‌ای منطبق با فیلترها و عبارت جستجوی بالا یافت نشد.</p>
                    ) : (
                      <div className="overflow-x-auto border border-gray-100 rounded-xl max-h-60">
                        <table className="w-full text-xs text-center border-collapse">
                          <thead className="bg-gray-50 text-gray-700 font-bold sticky top-0">
                            <tr className="border-b border-gray-100">
                              <th className="p-2 w-16">شماره حواله</th>
                              <th className="p-2 w-20">تاریخ سند</th>
                              <th className="p-2 text-right">خریدار / مشتری</th>
                              <th className="p-2 w-28">نوع سند</th>
                              <th className="p-2 w-20">وزن خالص (kg)</th>
                              <th className="p-2 w-20">اقلام</th>
                              <th className="p-2 w-24">عملیات اتصال</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {searchResults.map((rem) => {
                              const isAttached = attachedRemittances.some(r => r.remittanceNumber === rem.remittanceNumber);
                              return (
                                <tr key={rem.remittanceNumber} className="hover:bg-slate-50">
                                  <td className="p-2 font-mono font-bold text-indigo-900">{rem.remittanceNumber}</td>
                                  <td className="p-2 font-mono">{rem.shamsiDate || rem.docDate}</td>
                                  <td className="p-2 text-right font-bold text-gray-800">{rem.personFullName}</td>
                                  <td className="p-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      rem.docType === '23' ? 'bg-emerald-50 text-emerald-700' :
                                      rem.docType === '12' ? 'bg-blue-50 text-blue-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {rem.docTypeLabel || rem.docType}
                                    </span>
                                  </td>
                                  <td className="p-2 font-mono font-bold">{rem.totalNetWeight?.toLocaleString('fa-IR')}</td>
                                  <td className="p-2 text-gray-500">{rem.items?.length || 0} ردیف</td>
                                  <td className="p-2">
                                    {isAttached ? (
                                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg font-bold flex items-center justify-center gap-1">
                                        <CheckCircle2 size={12} /> متصل شده
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleAttachRemittanceFromList(rem)}
                                        className="bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white px-2.5 py-0.5 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1 mx-auto"
                                      >
                                        <Plus size={12} /> الحاق حواله
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button for Merged Items */}
              {sayanRemittance && (
                <div className="bg-indigo-600/5 p-3 rounded-xl border border-indigo-200/50 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-[11px] text-indigo-950">
                    جمع اقلام حواله‌های الصاقی: <b>{sayanRemittance.items?.length || 0} ردیف کالا</b> | کل وزن خالص: <b>{sayanRemittance.totalNetWeight} کیلوگرم</b> | کارتن: <b>{sayanRemittance.totalCartons}</b>
                  </div>
                  <button
                    type="button"
                    onClick={applySayanValuesToItems}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <ArrowDownToLine size={16} /> جایگذاری و ادغام اقلام سایان در جدول کالاها
                  </button>
                </div>
              )}

              {sayanError && !sayanRemittance && (
                <div className="bg-amber-50 text-amber-800 p-2.5 rounded-xl text-xs flex items-center gap-2 border border-amber-200">
                  <AlertCircle size={16} className="text-amber-600" />
                  <span>{sayanError}</span>
                </div>
              )}
            </div>
          )}

          {/* Table */}
          {/* Desktop Table */}
          <div className="hidden md:block glass-panel rounded-xl border border-gray-200/50 dark:border-white/10 shadow-sm overflow-x-auto w-full max-w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
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

          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-4">
            {items.map((item, idx) => (
              <div key={item.id || idx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/40 rounded-2xl p-4 shadow-sm relative space-y-3">
                {/* Header of Item */}
                <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
                  <span className="text-xs font-black text-gray-500">کالای شماره {idx + 1}</span>
                  <button type="button" onClick={() => handleRemoveItem(idx)} className="text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg">
                    <Trash2 size={18} />
                  </button>
                </div>

                {/* Goods Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400">شرح کالا:</label>
                  <input 
                    className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs font-black bg-zinc-50 dark:bg-zinc-900 focus:bg-white" 
                    value={item.goodsName} 
                    onChange={e => handleUpdateItem(idx, 'goodsName', e.target.value)} 
                    placeholder="نام کالا"
                  />
                  {(item.bobbinCount || item.grade || item.twistDirection) && (
                    <div className="text-[10px] text-gray-400 flex gap-2 flex-wrap font-bold bg-zinc-100 dark:bg-zinc-800/50 p-1.5 rounded-lg">
                      {item.bobbinCount ? <span>بوبین: {item.bobbinCount}</span> : null}
                      {item.grade ? <span>گرید: {item.grade}</span> : null}
                      {item.twistDirection ? <span>تاب: {item.twistDirection}</span> : null}
                    </div>
                  )}
                </div>

                {/* Carton Counts (Side-by-side) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50/50 dark:bg-blue-950/10 p-2.5 rounded-xl border border-blue-100/50 dark:border-blue-900/15">
                    <span className="text-[9px] font-bold text-blue-800 dark:text-blue-400 block mb-1">کارتن (درخواست):</span>
                    <span className="text-sm font-black font-mono text-blue-900 dark:text-blue-300">{item.cartonCount}</span>
                  </div>
                  <div className="bg-green-50/50 dark:bg-green-950/10 p-2.5 rounded-xl border border-green-100/50 dark:border-green-900/15">
                    <label className="text-[9px] font-bold text-green-800 dark:text-green-400 block mb-1">کارتن خروجی:</label>
                    <input 
                      type="number" 
                      className="w-full border border-green-200 dark:border-green-800/40 rounded-lg p-1.5 text-center font-mono font-black text-green-700 bg-white dark:bg-zinc-900 text-xs focus:ring-1 focus:ring-green-500 outline-none" 
                      value={item.deliveredCartonCount || ''} 
                      onChange={e => handleUpdateItem(idx, 'deliveredCartonCount', e.target.value === '' ? 0 : Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Weights (Side-by-side) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50/50 dark:bg-blue-950/10 p-2.5 rounded-xl border border-blue-100/50 dark:border-blue-900/15">
                    <span className="text-[9px] font-bold text-blue-800 dark:text-blue-400 block mb-1">وزن درخواستی (kg):</span>
                    <span className="text-sm font-black font-mono text-blue-900 dark:text-blue-300">
                      {Number(item.weight || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                    </span>
                  </div>
                  <div className="bg-green-50/50 dark:bg-green-950/10 p-2.5 rounded-xl border border-green-100/50 dark:border-green-900/15">
                    <label className="text-[9px] font-bold text-green-800 dark:text-green-400 block mb-1">وزن خروجی (خالص):</label>
                    <input 
                      type="number" 
                      step="0.001" 
                      className="w-full border border-green-200 dark:border-green-800/40 rounded-lg p-1.5 text-center font-mono font-black text-green-700 bg-white dark:bg-zinc-900 text-xs focus:ring-1 focus:ring-green-500 outline-none" 
                      value={item.deliveredWeight || ''} 
                      onChange={e => handleUpdateItem(idx, 'deliveredWeight', e.target.value === '' ? 0 : Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Mobile Add button & totals */}
            <div className="bg-zinc-100 dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/30 space-y-3">
              <button 
                type="button" 
                onClick={handleAddItem} 
                className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 hover:dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl text-xs flex items-center justify-center gap-1.5 font-bold border border-blue-200 dark:border-blue-900/30 transition-colors"
              >
                <Plus size={16}/> افزودن کالا جدید
              </button>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div className="space-y-1">
                  <div className="text-gray-400 text-[10px] font-bold">جمع کل کارتن درخواستی:</div>
                  <div className="font-black text-gray-700 dark:text-gray-300 font-mono text-sm">{totalRequestedCount}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-green-600 dark:text-green-400 text-[10px] font-bold">جمع کل کارتن خروجی:</div>
                  <div className="font-black text-green-700 dark:text-green-400 font-mono text-sm">{totalDeliveredCount}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-gray-400 text-[10px] font-bold">جمع کل وزن درخواستی:</div>
                  <div className="font-black text-gray-700 dark:text-gray-300 font-mono text-sm">{Number(totalRequestedWeight.toFixed(3))}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-green-600 dark:text-green-400 text-[10px] font-bold">جمع کل وزن خروجی:</div>
                  <div className="font-black text-green-700 dark:text-green-400 font-mono text-base">{Number(totalDeliveredWeight.toFixed(3))}</div>
                </div>
              </div>
            </div>
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

  return createPortal(modalContent, document.body);
};

export default WarehouseFinalizeModal;
