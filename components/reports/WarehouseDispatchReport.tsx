import React, { useState, useMemo, useRef } from 'react';
import { WarehouseTransaction, WarehouseTransactionItem } from '../../types';
import { formatDate, parsePersianDate } from '../../constants';
import * as XLSX from 'xlsx';
import { Download, FileText, Printer, Search } from 'lucide-react';

interface WarehouseDispatchReportProps {
    transactions: WarehouseTransaction[];
    companies: string[];
}

const WarehouseDispatchReport: React.FC<WarehouseDispatchReportProps> = ({ transactions, companies }) => {
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [selectedCompany, setSelectedCompany] = useState<string>('');
    const elementRef = useRef<HTMLDivElement>(null);

    const filteredData = useMemo(() => {
        let filtered = transactions.filter(tx => tx.type === 'OUT'); // Only dispatches (خروج)

        if (selectedCompany) {
            filtered = filtered.filter(tx => tx.company === selectedCompany);
        }

        if (dateRange.from) {
            const fromDate = parsePersianDate(dateRange.from);
            if (fromDate) {
                filtered = filtered.filter(tx => {
                    const txDate = new Date(tx.date);
                    return txDate.getTime() >= fromDate.getTime();
                });
            }
        }

        if (dateRange.to) {
            const toDate = parsePersianDate(dateRange.to);
            if (toDate) {
                // include the end of the day
                toDate.setHours(23, 59, 59, 999);
                filtered = filtered.filter(tx => {
                    const txDate = new Date(tx.date);
                    return txDate.getTime() <= toDate.getTime();
                });
            }
        }

        // Sort by date descending
        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Flatten items for table
        const flatList: { tx: WarehouseTransaction; item: WarehouseTransactionItem }[] = [];
        filtered.forEach(tx => {
            if (tx.items && tx.items.length > 0) {
                tx.items.forEach(item => {
                    flatList.push({ tx, item });
                });
            }
        });

        return { txs: filtered, flatList };
    }, [transactions, selectedCompany, dateRange]);

    const handlePrint = () => {
        const printContent = elementRef.current;
        if (!printContent) return;

        const originalContent = document.body.innerHTML;
        const style = `
            <style>
              @media print {
                  body { visibility: hidden; background: white; margin: 0; padding: 0; }
                  #dispatch-print-area { visibility: visible; position: absolute; left: 0; top: 0; width: 100%; height: 100%; direction: rtl; }
                  .no-print { display: none !important; }
                  table { width: 100%; border-collapse: collapse; font-family: Tahoma, 'Vazirmatn', sans-serif; font-size: 10px; }
                  th, td { border: 1px solid #000; padding: 4px; text-align: center; }
                  th { background-color: #f3f4f6 !important; font-weight: bold; -webkit-print-color-adjust: exact; }
              }
            </style>
        `;

        const printWindow = document.createElement('div');
        printWindow.innerHTML = style + `<div id="dispatch-print-area">${printContent.innerHTML}</div>`;
        document.body.appendChild(printWindow);
        window.print();
        document.body.removeChild(printWindow);
    };

    const handleExportExcel = () => {
        if (filteredData.flatList.length === 0) return alert('داده‌ای برای خروجی وجود ندارد.');

        const rows = filteredData.flatList.map((row, index) => ({
            'ردیف': index + 1,
            'تاریخ': formatDate(row.tx.date),
            'شماره بیجک': row.tx.number || '',
            'شرکت': row.tx.company || '',
            'کالا': row.item.itemName || '',
            'تعداد': row.item.quantity || 0,
            'وزن (kg)': row.item.weight || 0,
            'گیرنده': row.tx.recipientName || '',
            'راننده': row.tx.driverName || '',
            'پلاک خودرو': row.tx.plateNumber || '',
            'توضیحات': row.tx.description || ''
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);

        // adjust column widths roughly
        ws['!cols'] = [
            { wch: 5 }, // Row
            { wch: 12 }, // Date
            { wch: 10 }, // Bijak Num
            { wch: 15 }, // Company
            { wch: 25 }, // Item
            { wch: 10 }, // Qty
            { wch: 10 }, // Weight
            { wch: 20 }, // Recipient
            { wch: 15 }, // Driver
            { wch: 15 }, // Plate
            { wch: 30 }  // Desc
        ];

        XLSX.utils.book_append_sheet(wb, ws, "گزارش خروج");
        XLSX.writeFile(wb, `Dispatch_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Filters */}
            <div className="glass-panel p-4 rounded-xl shadow-sm border border-gray-200 dark:border-white/10 flex flex-wrap gap-4 items-end no-print">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">از تاریخ:</label>
                    <input 
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-white dark:bg-gray-800 dir-ltr text-left" 
                        placeholder="1403/01/01" 
                        value={dateRange.from} 
                        onChange={e => setDateRange({...dateRange, from: e.target.value})} 
                    />
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">تا تاریخ:</label>
                    <input 
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-white dark:bg-gray-800 dir-ltr text-left" 
                        placeholder="1403/12/29" 
                        value={dateRange.to} 
                        onChange={e => setDateRange({...dateRange, to: e.target.value})} 
                    />
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">شرکت:</label>
                    <select 
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-white dark:bg-gray-800"
                        value={selectedCompany}
                        onChange={e => setSelectedCompany(e.target.value)}
                    >
                        <option value="">همه شرکت‌ها</option>
                        {companies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="flex gap-2 min-w-[200px] mt-2 md:mt-0">
                    <button 
                        onClick={handleExportExcel}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-green-700 transition-colors"
                    >
                        <FileText size={16} />
                        اکسل
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-blue-700 transition-colors"
                    >
                        <Printer size={16} />
                        چاپ / PDF
                    </button>
                </div>
            </div>

            {/* Print Area / Table */}
            <div className="glass-panel p-4 rounded-xl shadow-sm border border-gray-200 dark:border-white/10 flex-1 overflow-auto bg-white dark:bg-gray-900" ref={elementRef}>
                <div className="hidden print:block text-center mb-6 border-b pb-4">
                    <h2 className="text-xl font-bold mb-2">گزارش خروج کالا (بیجک‌ها)</h2>
                    <div className="flex justify-between text-xs mt-4 px-8">
                        <div>
                            شرکت: <b>{selectedCompany || 'همه شرکت‌ها'}</b>
                        </div>
                        <div>
                            بازه تاریخ: <b>{dateRange.from || '---'}</b> تا <b>{dateRange.to || '---'}</b>
                        </div>
                        <div>
                            تاریخ گزارش: <b>{formatDate(Date.now())}</b>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-700">
                        <thead>
                            <tr className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                <th className="border border-gray-300 dark:border-gray-600 p-2 text-center w-12">ردیف</th>
                                <th className="border border-gray-300 dark:border-gray-600 p-2 text-center w-24">تاریخ</th>
                                <th className="border border-gray-300 dark:border-gray-600 p-2 text-center w-20">شماره بیجک</th>
                                <th className="border border-gray-300 dark:border-gray-600 p-2 text-center w-24">شرکت</th>
                                <th className="border border-gray-300 dark:border-gray-600 p-2 text-right">کالا</th>
                                <th className="border border-gray-300 dark:border-gray-600 p-2 text-center w-20">تعداد</th>
                                <th className="border border-gray-300 dark:border-gray-600 p-2 text-center w-20">وزن (kg)</th>
                                <th className="border border-gray-300 dark:border-gray-600 p-2 text-right w-32">گیرنده</th>
                                <th className="border border-gray-300 dark:border-gray-600 p-2 text-right w-24">راننده</th>
                                <th className="border border-gray-300 dark:border-gray-600 p-2 text-center w-24">پلاک</th>
                                <th className="border border-gray-300 dark:border-gray-600 p-2 text-right">توضیحات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.flatList.length > 0 ? (
                                filteredData.flatList.map((row, idx) => (
                                    <tr key={`${row.tx.id}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-mono">{idx + 1}</td>
                                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-mono">{formatDate(row.tx.date)}</td>
                                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-mono font-bold text-red-600">{row.tx.number || '-'}</td>
                                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center text-xs">{row.tx.company}</td>
                                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-right font-medium">{row.item.itemName}</td>
                                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-mono bg-blue-50/50 dark:bg-blue-900/10">{row.item.quantity || '-'}</td>
                                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-mono bg-green-50/50 dark:bg-green-900/10">{row.item.weight || '-'}</td>
                                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-right text-xs truncate max-w-[120px]" title={row.tx.recipientName}>{row.tx.recipientName || '-'}</td>
                                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-right text-xs">{row.tx.driverName || '-'}</td>
                                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-mono text-xs">{row.tx.plateNumber || '-'}</td>
                                        <td className="border border-gray-300 dark:border-gray-600 p-2 text-right text-xs text-gray-500 truncate max-w-[150px]" title={row.tx.description}>{row.tx.description || '-'}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={11} className="border border-gray-300 dark:border-gray-600 p-8 text-center text-gray-400">
                                        هیچ بیجک خروجی برای این بازه یافت نشد.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {/* Optionally add total footer */}
                        {filteredData.flatList.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-100 dark:bg-gray-800 font-bold">
                                    <td colSpan={5} className="border border-gray-300 dark:border-gray-600 p-2 text-center">مجموع</td>
                                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-mono">
                                        {filteredData.flatList.reduce((sum, row) => sum + (row.item.quantity || 0), 0)}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-center font-mono">
                                        {filteredData.flatList.reduce((sum, row) => sum + (row.item.weight || 0), 0)}
                                    </td>
                                    <td colSpan={4} className="border border-gray-300 dark:border-gray-600 p-2"></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WarehouseDispatchReport;
