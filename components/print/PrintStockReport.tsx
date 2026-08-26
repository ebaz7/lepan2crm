import React, { useEffect, useState, useRef, useMemo } from 'react';
import { X, Printer, FileDown, Loader2, ZoomIn, ZoomOut, RotateCcw, Building2, Eye, LayoutGrid, ListFilter } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator'; 
import { formatNumberString } from '../../constants';

interface StockGroup {
  company: string;
  items: {
    id: string;
    name: string;
    code?: string;
    unit?: string;
    quantity: number;
    weight: number;
    containerCount?: number;
    weightPerCarton?: number;
  }[];
}

interface PrintStockReportProps {
  data: StockGroup[];
  onClose: () => void;
}

const PrintStockReport: React.FC<PrintStockReportProps> = ({ data, onClose }) => {
  const [processing, setProcessing] = useState(false);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'side_by_side' | 'detailed_tables'>('side_by_side');
  const [onlyPositiveStock, setOnlyPositiveStock] = useState<boolean>(true);

  // Scaling & Zoom States
  const [scale, setScale] = useState(1);
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  // Touch pinch-to-zoom tracking
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef<number>(1);
  const lastTapRef = useRef<number>(0);

  const rawData = data && Array.isArray(data) ? data : [];

  // Filtered & Sanitized Data
  const reportData = useMemo(() => {
    return rawData
      .filter(group => selectedCompanyFilter === 'ALL' || group.company === selectedCompanyFilter)
      .map(group => {
        const filteredItems = (group.items || []).filter(item => {
          if (!onlyPositiveStock) return true;
          return (item.quantity > 0.001 || item.weight > 0.001);
        });
        return {
          ...group,
          items: filteredItems
        };
      })
      .filter(group => group.items.length > 0 || selectedCompanyFilter !== 'ALL');
  }, [rawData, selectedCompanyFilter, onlyPositiveStock]);

  const companyList = useMemo(() => {
    return Array.from(new Set(rawData.map(g => g.company)));
  }, [rawData]);

  useEffect(() => {
    const style = document.getElementById('page-size-style');
    if (style) {
      style.innerHTML = '@page { size: A4 landscape; margin: 0; }';
    }
  }, []);

  // Auto-Scale Logic to fit screen width initially
  useEffect(() => {
    const handleResize = () => {
      if (userZoom !== null) return;
      const wrapper = containerWrapperRef.current;
      if (wrapper) {
        const wrapperWidth = wrapper.clientWidth;
        const targetWidth = 1120; // A4 Landscape width in px approx
        
        if (wrapperWidth < targetWidth + 40) {
          const newScale = Math.max(0.25, (wrapperWidth - 32) / targetWidth);
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
    const nextScale = Math.min(3.0, currentScale + 0.15);
    setUserZoom(nextScale);
    setScale(nextScale);
  };

  const handleZoomOut = () => {
    const currentScale = userZoom !== null ? userZoom : scale;
    const nextScale = Math.max(0.25, currentScale - 0.15);
    setUserZoom(nextScale);
    setScale(nextScale);
  };

  const handleSetZoom = (newScale: number) => {
    const clamped = Math.min(3.0, Math.max(0.25, newScale));
    setUserZoom(clamped);
    setScale(clamped);
  };

  const handleResetZoom = () => {
    setUserZoom(null);
    setTimeout(() => {
      const wrapper = containerWrapperRef.current;
      if (wrapper) {
        const wrapperWidth = wrapper.clientWidth;
        const targetWidth = 1120;
        if (wrapperWidth < targetWidth + 40) {
          setScale(Math.max(0.25, (wrapperWidth - 32) / targetWidth));
        } else {
          setScale(1);
        }
      }
    }, 50);
  };

  // Mobile Touch Gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        if (scale > 1.1) {
          handleResetZoom();
        } else {
          handleSetZoom(1.35);
        }
      }
      lastTapRef.current = now;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / touchStartDistRef.current;
      const targetScale = Math.min(3.0, Math.max(0.25, touchStartScaleRef.current * ratio));
      setScale(targetScale);
      setUserZoom(targetScale);
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(3.0, Math.max(0.25, scale * zoomFactor));
      setScale(newScale);
      setUserZoom(newScale);
    }
  };

  const handleDownloadPDF = async () => {
    setProcessing(true);
    await generatePdf({
      elementId: 'stock-report-content',
      filename: `Stock_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      format: 'A4',
      orientation: 'landscape',
      onComplete: () => setProcessing(false),
      onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
    });
  };

  const handlePrint = () => {
    const style = document.getElementById('page-size-style');
    if (style) {
      style.innerHTML = `
        @page { size: A4 landscape; margin: 0; }
        @media print {
            body * { visibility: hidden; }
            #stock-report-content, #stock-report-content * { visibility: visible; }
            #stock-report-content { 
                position: absolute; 
                left: 0; 
                top: 0; 
                width: 287mm !important; 
                margin: 0 !important;
                padding: 4mm !important;
                border: none !important;
                box-shadow: none !important;
                background-color: #ffffff !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .no-print { display: none !important; }
        }
      `;
    }
    window.print();
  };

  const companyColors = ['#e9d5ff', '#fed7aa', '#bae6fd', '#bbf7d0', '#fbcfe8'];

  const content = (
    <div 
      id="stock-report-content" 
      className="relative text-black" 
      style={{ 
        width: '287mm',
        minHeight: '200mm', 
        direction: 'rtl',
        padding: '5mm', 
        boxSizing: 'border-box',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        fontFamily: 'IRANSans, Tahoma, Arial, sans-serif'
      }}
    >
      {/* Yellow Top Header */}
      <div style={{ 
        textAlign: 'center', 
        backgroundColor: '#fde047', 
        border: '2px solid #000000', 
        padding: '7px 10px', 
        marginBottom: '8px', 
        fontWeight: '900', 
        fontSize: '18px',
        color: '#000000',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
          {selectedCompanyFilter === 'ALL' ? 'گزارش تجمیعی تمامی انبارها' : `انبار شرکت: ${selectedCompanyFilter}`}
        </span>
        <span style={{ fontSize: '18px', letterSpacing: '0.5px' }}>
          موجودی کلی انبارها
        </span>
        <span style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace' }}>
          تاریخ: {new Date().toLocaleDateString('fa-IR')}
        </span>
      </div>

      {/* Main Stock Content Layout */}
      {viewMode === 'side_by_side' && reportData.length > 0 ? (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'row',
          gap: '0px', 
          border: '2px solid #000000',
          backgroundColor: '#000000',
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}>
          {reportData.map((group, index) => {
            const headerColor = companyColors[index % companyColors.length];
            const isLast = index === reportData.length - 1;
            const totQty = group.items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
            const totWeight = group.items.reduce((sum, i) => sum + (Number(i.weight) || 0), 0);
            const avgWPerC = totQty > 0 ? (totWeight / totQty).toFixed(2) : '-';
            const totContainers = group.items.reduce((sum, i) => sum + (Number(i.containerCount) || 0), 0);

            return (
              <div 
                key={group.company} 
                style={{ 
                  flex: '1 1 0px', 
                  minWidth: 0,
                  backgroundColor: '#ffffff',
                  borderLeft: isLast ? 'none' : '2px solid #000000',
                  display: 'flex',
                  flexDirection: 'column',
                  boxSizing: 'border-box'
                }}
              >
                {/* Company Name Banner */}
                <div style={{ 
                  backgroundColor: headerColor, 
                  color: '#000000', 
                  padding: '6px 4px', 
                  borderBottom: '2px solid #000000', 
                  fontSize: '13px', 
                  fontWeight: '900',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {group.company}
                </div>

                {/* Table for this company */}
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse', 
                  tableLayout: 'fixed',
                  fontSize: '9.5px',
                  boxSizing: 'border-box'
                }}>
                  <colgroup>
                    <col style={{ width: '34%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '16%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6', color: '#000000' }}>
                      <th style={{ borderBottom: '1.5px solid #000000', borderLeft: '1px solid #000000', padding: '4px 2px', textAlign: 'center', fontWeight: 'bold' }}>نخ / کالا</th>
                      <th style={{ borderBottom: '1.5px solid #000000', borderLeft: '1px solid #000000', padding: '4px 2px', textAlign: 'center', fontWeight: 'bold' }}>کارتن</th>
                      <th style={{ borderBottom: '1.5px solid #000000', borderLeft: '1px solid #000000', padding: '4px 2px', textAlign: 'center', fontWeight: 'bold' }}>وزن (KG)</th>
                      <th style={{ borderBottom: '1.5px solid #000000', borderLeft: '1px solid #000000', padding: '4px 2px', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#fef3c7' }}>وزن/کارتن</th>
                      <th style={{ borderBottom: '1.5px solid #000000', padding: '4px 2px', textAlign: 'center', fontWeight: 'bold' }}>کانتینر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item, i) => {
                      const qty = Number(item.quantity) || 0;
                      const wt = Number(item.weight) || 0;
                      const wPerC = (qty > 0 && wt > 0) ? (wt / qty).toFixed(2) : '-';
                      const cont = Number(item.containerCount) || 0;

                      return (
                        <tr key={item.id || i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 1 ? '#fafafa' : '#ffffff' }}>
                          <td style={{ 
                            borderLeft: '1px solid #d1d5db', 
                            padding: '3.5px 3px', 
                            textAlign: 'right', 
                            fontWeight: 'bold', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: '#111827'
                          }} title={item.name}>
                            {item.name}
                          </td>
                          <td style={{ 
                            borderLeft: '1px solid #d1d5db', 
                            padding: '3.5px 2px', 
                            textAlign: 'center', 
                            fontFamily: 'monospace', 
                            fontWeight: '900', 
                            direction: 'ltr',
                            color: qty < 0 ? '#dc2626' : '#1d4ed8',
                            fontSize: '9.5px'
                          }}>
                            {formatNumberString(qty)}
                          </td>
                          <td style={{ 
                            borderLeft: '1px solid #d1d5db', 
                            padding: '3.5px 2px', 
                            textAlign: 'center', 
                            fontFamily: 'monospace', 
                            direction: 'ltr',
                            fontWeight: 'bold',
                            color: wt < 0 ? '#dc2626' : '#374151',
                            fontSize: '9.5px'
                          }}>
                            {formatNumberString(wt)}
                          </td>
                          <td style={{ 
                            borderLeft: '1px solid #d1d5db', 
                            padding: '3.5px 2px', 
                            textAlign: 'center', 
                            fontFamily: 'monospace', 
                            fontWeight: '900', 
                            direction: 'ltr', 
                            color: '#b45309', 
                            backgroundColor: '#fffbeb',
                            fontSize: '9.5px'
                          }}>
                            {wPerC}
                          </td>
                          <td style={{ 
                            padding: '3.5px 2px', 
                            textAlign: 'center', 
                            fontFamily: 'monospace', 
                            color: cont > 0 ? '#ea580c' : '#9ca3af',
                            fontWeight: cont > 0 ? 'bold' : 'normal',
                            fontSize: '9.5px'
                          }}>
                            {cont > 0 ? cont.toFixed(2) : '-'}
                          </td>
                        </tr>
                      );
                    })}

                    {group.items.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontWeight: 'bold' }}>
                          موجودی این شرکت صفر می‌باشد
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {group.items.length > 0 && (
                    <tfoot>
                      <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #000000', color: '#000000' }}>
                        <td style={{ borderLeft: '1px solid #000000', padding: '5px 3px', textAlign: 'right', fontWeight: '900', fontSize: '10px' }}>
                          جمع کل موجودی
                        </td>
                        <td style={{ borderLeft: '1px solid #000000', padding: '5px 2px', textAlign: 'center', fontWeight: '900', fontSize: '10px', fontFamily: 'monospace', color: '#1d4ed8' }}>
                          {formatNumberString(totQty)}
                        </td>
                        <td style={{ borderLeft: '1px solid #000000', padding: '5px 2px', textAlign: 'center', fontWeight: '900', fontSize: '10px', fontFamily: 'monospace' }}>
                          {formatNumberString(totWeight)}
                        </td>
                        <td style={{ borderLeft: '1px solid #000000', padding: '5px 2px', textAlign: 'center', fontWeight: '900', fontSize: '10px', fontFamily: 'monospace', color: '#b45309', backgroundColor: '#fef3c7' }}>
                          {avgWPerC}
                        </td>
                        <td style={{ padding: '5px 2px', textAlign: 'center', fontWeight: '900', fontSize: '10px', fontFamily: 'monospace', color: totContainers > 0 ? '#ea580c' : '#6b7280' }}>
                          {totContainers > 0 ? totContainers.toFixed(2) : '-'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detailed Full Width Tables View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {reportData.map((group, index) => {
            const headerColor = companyColors[index % companyColors.length];
            const totQty = group.items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
            const totWeight = group.items.reduce((sum, i) => sum + (Number(i.weight) || 0), 0);
            const avgWPerC = totQty > 0 ? (totWeight / totQty).toFixed(2) : '-';
            const totContainers = group.items.reduce((sum, i) => sum + (Number(i.containerCount) || 0), 0);

            return (
              <div key={group.company} style={{ border: '2px solid #000000', backgroundColor: '#ffffff', overflow: 'hidden' }}>
                <div style={{ 
                  backgroundColor: headerColor, 
                  color: '#000000', 
                  padding: '6px 12px', 
                  borderBottom: '2px solid #000000', 
                  fontSize: '13px', 
                  fontWeight: '900',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{group.company}</span>
                  <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{group.items.length} ردیف کالا</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      <th style={{ borderBottom: '1.5px solid #000000', borderLeft: '1px solid #000000', padding: '5px 8px', textAlign: 'right', width: '40%' }}>نام و شرح کالا</th>
                      <th style={{ borderBottom: '1.5px solid #000000', borderLeft: '1px solid #000000', padding: '5px', textAlign: 'center', width: '15%' }}>موجودی کارتن</th>
                      <th style={{ borderBottom: '1.5px solid #000000', borderLeft: '1px solid #000000', padding: '5px', textAlign: 'center', width: '15%' }}>وزن کل (کیلوگرم)</th>
                      <th style={{ borderBottom: '1.5px solid #000000', borderLeft: '1px solid #000000', padding: '5px', textAlign: 'center', width: '15%', backgroundColor: '#fef3c7' }}>میانگین وزن هر کارتن</th>
                      <th style={{ borderBottom: '1.5px solid #000000', padding: '5px', textAlign: 'center', width: '15%' }}>تخمین کانتینر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item, i) => {
                      const qty = Number(item.quantity) || 0;
                      const wt = Number(item.weight) || 0;
                      const wPerC = (qty > 0 && wt > 0) ? (wt / qty).toFixed(2) : '-';
                      const cont = Number(item.containerCount) || 0;

                      return (
                        <tr key={item.id || i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 1 ? '#fafafa' : '#ffffff' }}>
                          <td style={{ borderLeft: '1px solid #d1d5db', padding: '4px 8px', textAlign: 'right', fontWeight: 'bold' }}>{item.name}</td>
                          <td style={{ borderLeft: '1px solid #d1d5db', padding: '4px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: qty < 0 ? '#dc2626' : '#1d4ed8' }}>{formatNumberString(qty)}</td>
                          <td style={{ borderLeft: '1px solid #d1d5db', padding: '4px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>{formatNumberString(wt)}</td>
                          <td style={{ borderLeft: '1px solid #d1d5db', padding: '4px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: '#b45309', backgroundColor: '#fffbeb' }}>{wPerC}</td>
                          <td style={{ padding: '4px', textAlign: 'center', fontFamily: 'monospace', color: cont > 0 ? '#ea580c' : '#6b7280', fontWeight: cont > 0 ? 'bold' : 'normal' }}>{cont > 0 ? cont.toFixed(2) : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #000000', fontWeight: '900' }}>
                      <td style={{ borderLeft: '1px solid #000000', padding: '6px 8px', textAlign: 'right' }}>جمع کل موجودی {group.company}</td>
                      <td style={{ borderLeft: '1px solid #000000', padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#1d4ed8' }}>{formatNumberString(totQty)}</td>
                      <td style={{ borderLeft: '1px solid #000000', padding: '6px', textAlign: 'center', fontFamily: 'monospace' }}>{formatNumberString(totWeight)}</td>
                      <td style={{ borderLeft: '1px solid #000000', padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#b45309', backgroundColor: '#fef3c7' }}>{avgWPerC}</td>
                      <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', color: totContainers > 0 ? '#ea580c' : '#6b7280' }}>{totContainers > 0 ? totContainers.toFixed(2) : '-'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Yellow Bottom Footer */}
      <div style={{ 
        textAlign: 'center', 
        backgroundColor: '#fde047', 
        border: '2px solid #000000', 
        borderTop: 'none', 
        padding: '5px 10px', 
        fontWeight: 'bold', 
        fontSize: '11px',
        color: '#000000',
        marginTop: '0px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>گزارش رسمی موجودی انبار - نرم‌افزار مدیریت انبار و حسابداری بازرگانی</span>
        <span>صفحه ۱ از ۱</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex flex-col p-0 m-0 overflow-hidden animate-fade-in safe-top safe-bottom" dir="rtl">
      {/* Sticky Top Header Bar with Controls */}
      <header className="sticky top-0 z-50 bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-3 py-2.5 md:px-6 md:py-3 shadow-md flex items-center justify-between gap-3 flex-wrap shrink-0 no-print">
        {/* Title */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center font-bold text-xs shadow-xs">
            📦
          </div>
          <span className="font-black text-sm md:text-base text-gray-800 dark:text-gray-100">پیش‌نمایش چاپ موجودی انبار</span>
        </div>

        {/* Center Controls: Filter & View Mode */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Company Filter */}
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-zinc-900 px-2.5 py-1 rounded-xl border border-gray-200 dark:border-zinc-800 text-xs">
            <Building2 size={14} className="text-gray-500" />
            <select 
              value={selectedCompanyFilter} 
              onChange={e => setSelectedCompanyFilter(e.target.value)}
              className="bg-transparent font-bold text-gray-800 dark:text-gray-200 outline-none text-xs cursor-pointer"
            >
              <option value="ALL">همه شرکت‌ها ({companyList.length})</option>
              {companyList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-gray-200 dark:border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('side_by_side')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${viewMode === 'side_by_side' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
              title="نمای ستونی مقایسه‌ای در یک صفحه"
            >
              <LayoutGrid size={13} />
              <span>ستونی</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detailed_tables')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${viewMode === 'detailed_tables' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
              title="نمای جداول تفکیکی عریض"
            >
              <ListFilter size={13} />
              <span>تفکیکی</span>
            </button>
          </div>

          {/* Zoom Toolbar */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-900 px-2 py-1 rounded-xl border border-gray-200 dark:border-zinc-800">
            <button 
              onClick={handleZoomOut} 
              className="p-1 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded hover:bg-gray-200 dark:hover:bg-zinc-800" 
              title="کوچک‌نمایی (-)"
            >
              <ZoomOut size={14} />
            </button>
            <button 
              onClick={() => handleSetZoom(1)} 
              className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300 px-1 py-0.5 rounded min-w-[36px] text-center" 
              title="تنظیم به ۱۰۰٪"
            >
              {Math.round(scale * 100)}%
            </button>
            <button 
              onClick={handleZoomIn} 
              className="p-1 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded hover:bg-gray-200 dark:hover:bg-zinc-800" 
              title="بزرگ‌نمایی (+)"
            >
              <ZoomIn size={14} />
            </button>
            <button 
              onClick={handleResetZoom} 
              className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded" 
              title="تناسب با صفحه"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 md:gap-2">
          <button 
            onClick={handleDownloadPDF} 
            disabled={processing} 
            className="bg-red-600 hover:bg-red-700 active:scale-95 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs flex items-center gap-1.5 font-bold shadow-md transition-all disabled:opacity-50"
          >
            {processing ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
            <span>دانلود PDF</span>
          </button>
          
          <button 
            onClick={handlePrint} 
            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs flex items-center gap-1.5 font-bold shadow-md transition-all"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">چاپ</span>
          </button>
          
          <button 
            onClick={onClose} 
            className="bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 p-2 rounded-xl transition-colors" 
            title="بستن"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Main Canvas Container */}
      <main 
        className="flex-1 w-full overflow-auto p-3 md:p-6 flex flex-col items-center justify-start overscroll-contain bg-zinc-900/90"
        ref={containerWrapperRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <div 
          style={{ 
            width: `${287 * 3.779527559 * scale}px`,
            minHeight: `${200 * 3.779527559 * scale}px`,
            position: 'relative',
            flexShrink: 0
          }}
        >
          <div 
            style={{ 
              width: '287mm', 
              minHeight: '200mm',
              backgroundColor: '#ffffff', 
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: 0,
              left: 0,
              overflow: 'hidden',
              borderRadius: '4px'
            }} 
            className="rounded-sm"
          >
            {content}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrintStockReport;
