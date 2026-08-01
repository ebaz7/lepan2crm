const fs = require('fs');
let content = fs.readFileSync('components/SayanReports.tsx', 'utf8');

const visualizerNew = `
    if (activeTable === 'REPORT_CUSTOMER_STATEMENT' || activeTable === 'REPORT_DEBTORS') {
      return (
        <div className="space-y-4 mb-8">
           <div className="flex justify-between items-center bg-white p-3 rounded-xl border shadow-sm">
             <div className="flex items-center gap-2">
               <Database size={16} className="text-rose-600" />
               <h3 className="text-sm font-bold text-gray-800">{activeTable === 'REPORT_CUSTOMER_STATEMENT' ? 'صورتحساب مشتری' : 'گزارش بدهکاران و بستانکاران'}</h3>
             </div>
             <button onClick={() => exportFilteredData(data, activeTable)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded border transition-colors">
               <Download size={12} />
               خروجی اکسل
             </button>
           </div>
           
           <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
             <table className="w-full text-sm text-right">
               <thead className="bg-gray-50 text-gray-500 font-bold border-b text-[11px]">
                 <tr>
                   <th className="px-4 py-3">تاریخ</th>
                   <th className="px-4 py-3">شرح</th>
                   <th className="px-4 py-3 text-left">بدهکار</th>
                   <th className="px-4 py-3 text-left">بستانکار</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {data.slice(0, 100).map((row, i) => (
                   <tr key={i} className="hover:bg-rose-50/50 transition-colors">
                     <td className="px-4 py-2.5 font-mono text-xs" dir="ltr">{row.Date || row.Field_008 || '-'}</td>
                     <td className="px-4 py-2.5 text-xs">{row.Description || row.AccountName || row.Field_006 || '-'}</td>
                     <td className="px-4 py-2.5 font-mono text-left text-emerald-600 font-bold">{parseFloat(row.Debit || row.Field_010 || 0).toLocaleString()}</td>
                     <td className="px-4 py-2.5 font-mono text-left text-rose-600 font-bold">{parseFloat(row.Credit || row.Field_011 || 0).toLocaleString()}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      );
    }
`;

content = content.replace(
  `if (activeTable === 'REPORT_SALES') {`,
  `${visualizerNew}\n    if (activeTable === 'REPORT_SALES') {`
);

fs.writeFileSync('components/SayanReports.tsx', content);
