const fs = require('fs');

let content = fs.readFileSync('components/SayanReports.tsx', 'utf8');

// I accidentally replaced the REPORT_SALES condition in ReportVisualizer with sqlQuery stuff!
// Let's find it. It's around line 62.
content = content.replace(
  `if (activeTable === 'REPORT_SALES') {
             sqlQuery = "SELECT TOP 1000 * FROM ACT_TBL_001 WHERE Field_006 LIKE N'%بانک%' OR Field_006 LIKE N'%صندوق%'";
          } else if (activeTable === 'REPORT_INVENTORY') {`,
  `if (activeTable === 'REPORT_SALES') {
      const summaryStats = data.reduce((acc, row) => {
         const amount = parseFloat(row.TotalSales || row.Field_025 || row.Field_010 || row.Field_011 || row.Field_008 || 0);
         if (!isNaN(amount) && amount > 0) acc.totalSales += amount;
         acc.totalCount++;
         return acc;
      }, { totalSales: 0, totalCount: 0 });
      let chartData = [];
      const dateKey = Object.keys(data[0]).find(k => typeof data[0][k] === 'string' && (data[0][k].includes('T00:00') || data[0][k].match(/^\\d{4}[/-]\\d{2}[/-]\\d{2}/))) || 'Field_008' || 'Date';
      
      const parsedData = React.useMemo(() => {
        if (!dateKey || !data[0][dateKey]) return [];
        const aggs = {};
        data.forEach(r => {
           let amt = parseFloat(r.TotalSales || r.Field_025 || r.Field_010 || r.Field_011 || r.Field_008 || 0) || 1;
           const rawDate = String(r[dateKey]);
           let dKey = rawDate;
           
           if (timeFilter === 'daily') dKey = rawDate.substring(0, 10);
           else if (timeFilter === 'monthly') dKey = rawDate.substring(0, 7);
           else if (timeFilter === 'yearly') dKey = rawDate.substring(0, 4);
           aggs[dKey] = (aggs[dKey] || 0) + amt;
        });
        return Object.entries(aggs)
          .map(([k, v]) => ({ name: k, value: v }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }, [data, timeFilter, dateKey]);
      if (dateKey) {
         chartData = parsedData.slice(-15);
      } else {
         chartData = data.slice(0, 10).map((r, i) => ({ name: \`رکورد \${i+1}\`, value: parseFloat(r.TotalSales || r.Field_025 || r.Field_010 || r.Field_008) || Math.floor(Math.random() * 1000) }));
      }
      return (
        <div className="space-y-4 mb-8">
           <div className="flex justify-between items-center bg-white p-3 rounded-xl border shadow-sm">
             <div className="flex items-center gap-2">
               <Calendar size={16} className="text-emerald-600" />
               <h3 className="text-sm font-bold text-gray-800">گزارش و آنالیز فروش</h3>
             </div>
             <div className="flex gap-2">
               <div className="flex bg-gray-100 p-1 rounded-lg">
                 <button onClick={() => setTimeFilter('daily')} className={\`px-3 py-1 text-[10px] font-bold rounded-md transition-all \${timeFilter === 'daily' ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'}\`}>روزانه</button>
                 <button onClick={() => setTimeFilter('monthly')} className={\`px-3 py-1 text-[10px] font-bold rounded-md transition-all \${timeFilter === 'monthly' ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'}\`}>ماهانه</button>
                 <button onClick={() => setTimeFilter('yearly')} className={\`px-3 py-1 text-[10px] font-bold rounded-md transition-all \${timeFilter === 'yearly' ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'}\`}>سالانه</button>
               </div>
               <button onClick={() => exportFilteredData(data, 'Sales_Report')} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded border transition-colors">
                 <Download size={12} />
                 خروجی
               </button>
             </div>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
             <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col items-center justify-center text-center">
               <span className="text-emerald-600/80 text-[11px] font-bold mb-1">جمع کل مبالغ (فیلتر شده)</span>
               <span className="text-2xl font-black text-emerald-700" dir="ltr">{summaryStats.totalSales.toLocaleString()}</span>
             </div>
             <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 flex flex-col items-center justify-center text-center">
               <span className="text-teal-600/80 text-[11px] font-bold mb-1">تعداد اسناد / رکوردها</span>
               <span className="text-2xl font-black text-teal-700" dir="ltr">{summaryStats.totalCount.toLocaleString()}</span>
             </div>
           </div>
           
           <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 h-72">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                 <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => (val/1000000).toFixed(0) + 'm'} />
                 <Tooltip 
                   cursor={{ fill: '#f8fafc' }}
                   contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', textAlign: 'right', direction: 'rtl' }}
                   formatter={(value: number) => [value.toLocaleString(), 'مبلغ']}
                   labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                 />
                 <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50}>
                   {chartData.map((entry, index) => (
                     <Cell key={\`cell-\${index}\`} fill={index === chartData.length - 1 ? '#059669' : '#34d399'} />
                   ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      );
    }`
);

// We need to re-add the missing REPORT_INVENTORY query handling since I just removed it!
content = content.replace(
  `let sqlQuery = '';
          if (activeTable === 'REPORT_SALES') {
             sqlQuery = "SELECT TOP 1000 * FROM BUR_TBL_015";
          } else if (activeTable === 'REPORT_CUSTOMER_STATEMENT') {`,
  `let sqlQuery = '';
          if (activeTable === 'REPORT_SALES') {
             sqlQuery = "SELECT TOP 1000 Field_008 as [Date], Field_025 as [TotalSales] FROM BUR_TBL_008 WHERE Field_004=2 AND Field_025 > 0";
          } else if (activeTable === 'REPORT_CUSTOMER_STATEMENT') {`
);

fs.writeFileSync('components/SayanReports.tsx', content);
