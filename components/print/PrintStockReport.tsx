
import React, { useEffect, useState, useRef } from 'react';
import { X, Printer, FileDown, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator'; 

interface PrintStockReportProps {
  data: any[];
  onClose: () => void;
}

const PrintStockReport: React.FC<PrintStockReportProps> = ({ data, onClose }) => {
  const [processing, setProcessing] = useState(false);
  const reportData = data && data.length > 0 ? data : [];

  // Scaling & Zoom States
  const [scale, setScale] = useState(1);
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const style = document.getElementById('page-size-style');
    if (style) {
      style.innerHTML = '@page { size: A4 landscape; margin: 0; }';
    }
  }, []);

  // Auto-Scale Logic
  useEffect(() => {
    const handleResize = () => {
        if (userZoom !== null) return;
        const wrapper = containerWrapperRef.current;
        if (wrapper) {
            const wrapperWidth = wrapper.clientWidth;
            const targetWidth = 1100; // A4 Landscape Width in px (approx)
            
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
              const targetWidth = 1100;
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
          elementId: 'stock-report-content',
          filename: `Stock_Report_${new Date().toISOString().slice(0,10)}.pdf`,
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
                    width: 290mm !important; 
                    margin: 0 !important;
                    padding: 5mm !important;
                    border: none !important;
                    box-shadow: none !important;
                }
                .no-print { display: none !important; }
            }
          `;
      }
      window.print();
  };

  const content = (
      <div id="stock-report-content" className="printable-content glass-panel shadow-2xl relative text-black" 
        style={{ 
            width: '290mm',
            minHeight: '200mm', 
            direction: 'rtl',
            padding: '5mm', 
            boxSizing: 'border-box',
            margin: '0 auto'
        }}>
            <div style={{ textAlign: 'center', backgroundColor: '#fde047', border: '2px solid black', padding: '8px', marginBottom: '10px', fontWeight: '900', fontSize: '20px' }}>موجودی کلی انبارها</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black', tableLayout: 'fixed' }}>
                <thead>
                    <tr>
                        {reportData.map((group, index) => {
                            const headerColor = index === 0 ? '#d8b4fe' : index === 1 ? '#fdba74' : '#93c5fd';
                            return (
                                <th key={group.company} style={{ borderLeft: '2px solid black', verticalAlign: 'top', padding: 0 }}>
                                    <div style={{ backgroundColor: headerColor, color: 'black', padding: '8px', borderBottom: '2px solid black', fontSize: '14px', fontWeight: '900' }}>{group.company}</div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f3f4f6' }}>
                                                <th style={{ width: '40%', borderLeft: '1px solid black', borderBottom: '1px solid black', padding: '4px' }}>نخ / کالا</th>
                                                <th style={{ width: '20%', borderLeft: '1px solid black', borderBottom: '1px solid black', padding: '4px' }}>کارتن</th>
                                                <th style={{ width: '20%', borderLeft: '1px solid black', borderBottom: '1px solid black', padding: '4px' }}>وزن</th>
                                                <th style={{ width: '20%', borderBottom: '1px solid black', padding: '4px' }}>کانتینر</th>
                                            </tr>
                                        </thead>
                                    </table>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        {reportData.map((group, index) => (
                            <td key={group.company} style={{ borderLeft: '2px solid black', verticalAlign: 'top', padding: 0 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                    <tbody>
                                        {group.items.map((item: any, i: number) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #d1d5db' }}>
                                                <td style={{ width: '40%', borderLeft: '1px solid black', padding: '4px', textAlign: 'right', fontWeight: 'bold', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.name}</td>
                                                <td style={{ width: '20%', borderLeft: '1px solid black', padding: '4px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>{item.quantity ? Number(item.quantity).toFixed(2) : '0.00'}</td>
                                                <td style={{ width: '20%', borderLeft: '1px solid black', padding: '4px', textAlign: 'center', fontFamily: 'monospace' }}>{item.weight > 0 ? Number(item.weight).toFixed(2) : '0.00'}</td>
                                                <td style={{ width: '20%', padding: '4px', textAlign: 'center', fontFamily: 'monospace', color: '#6b7280' }}>
                                                    {item.containerCount > 0 ? Number(item.containerCount).toFixed(2) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                        {group.items.length > 0 && (
                                            <tr style={{ backgroundColor: '#f9fafb', borderTop: '2px solid black' }}>
                                                <td style={{ width: '40%', borderLeft: '1px solid black', padding: '6px', textAlign: 'right', fontWeight: '900', fontSize: '12px' }}>جمع کل موجودی</td>
                                                <td style={{ width: '20%', borderLeft: '1px solid black', padding: '6px', textAlign: 'center', fontWeight: '900', fontSize: '12px', borderBottom: '2px double black' }}>
                                                    {group.items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0).toFixed(2)}
                                                </td>
                                                <td style={{ width: '20%', borderLeft: '1px solid black', padding: '6px', textAlign: 'center', fontWeight: '900', fontSize: '12px', borderBottom: '2px double black' }}>
                                                    {group.items.reduce((sum: number, i: any) => sum + (i.weight || 0), 0).toFixed(2)}
                                                </td>
                                                <td style={{ width: '20%', padding: '6px', textAlign: 'center' }}></td>
                                            </tr>
                                        )}
                                        {group.items.length === 0 && <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>موجودی صفر</td></tr>}
                                    </tbody>
                                </table>
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>
            <div style={{ textAlign: 'center', backgroundColor: '#fde047', border: '2px solid black', borderTop: 'none', padding: '4px', fontWeight: 'bold', fontSize: '12px' }}>
                گزارش سیستم مدیریت انبار - تاریخ چاپ: {new Date().toLocaleDateString('fa-IR')}
            </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-start p-4 animate-fade-in safe-pb">
      <div className="relative z-50 flex flex-col gap-2 no-print w-full max-w-4xl mb-4">
         <div className="glass-panel p-3 rounded-xl shadow-lg flex justify-between items-center gap-4 bg-white dark:bg-zinc-950 flex-wrap">
             <span className="font-bold text-sm">پیش‌نمایش انبار</span>

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
                <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white p-2 px-3 rounded-lg text-xs flex items-center gap-1 font-bold shadow-sm"><Printer size={16}/> چاپ</button>
                <button onClick={onClose} className="bg-gray-100 dark:bg-zinc-900 text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-800"><X size={18}/></button>
             </div>
         </div>
      </div>
      
      {/* Responsive Wrapper */}
      <div className="w-full flex justify-center pb-10 overflow-hidden" ref={containerWrapperRef}>
          <div style={{ 
            width: '290mm', 
            minHeight: '200mm',
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

export default PrintStockReport;
