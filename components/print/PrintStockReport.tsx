
import React, { useEffect, useState, useRef } from 'react';
import { X, Printer, FileDown, Loader2 } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator'; 

interface PrintStockReportProps {
  data: any[];
  onClose: () => void;
}

const PrintStockReport: React.FC<PrintStockReportProps> = ({ data, onClose }) => {
  const [processing, setProcessing] = useState(false);
  const reportData = data && data.length > 0 ? data : [];

  // Scaling State
  const [scale, setScale] = useState(1);
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
  }, []);

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-start md:justify-center p-4 overflow-y-auto animate-fade-in safe-pb">
      <div className="relative md:absolute md:top-4 md:left-4 z-50 flex flex-col gap-2 no-print w-full md:w-auto mb-4 md:mb-0 order-1">
         <div className="glass-panel p-3 rounded-xl shadow-lg flex justify-between items-center gap-4">
             <span className="font-bold text-sm">پیش‌نمایش چاپ / PDF</span>
             <div className="flex gap-2">
                <button onClick={handleDownloadPDF} disabled={processing} className="bg-red-600 text-white p-2 rounded text-xs flex items-center gap-1">{processing ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} دانلود PDF</button>
                <button onClick={handlePrint} className="bg-blue-600 text-white p-2 rounded text-xs flex items-center gap-1"><Printer size={16}/> چاپ</button>
                <button onClick={onClose} className="bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 text-gray-700 p-2 rounded hover:bg-gray-200"><X size={18}/></button>
             </div>
         </div>
      </div>
      
      {/* Responsive Wrapper */}
      <div className="order-2 w-full flex justify-center pb-10" ref={containerWrapperRef}>
          <div style={{ 
            width: '290mm', 
            minHeight: '200mm',
            backgroundColor: 'white', 
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            marginBottom: `${(1 - scale) * -100}px` 
          }}>
              {content}
          </div>
      </div>
    </div>
  );
};

export default PrintStockReport;
