const fs = require('fs');
let content = fs.readFileSync('components/SayanReports.tsx', 'utf8');

// Modify the REPORT_DEBTORS button text
content = content.replace(
    `<span className="font-bold text-[11px] leading-relaxed">بدهکاران و بستانکاران (اشخاص)</span>`,
    `<span className="font-bold text-[11px] leading-relaxed">جمع کل بدهکاران و بستانکاران</span>`
);

// Add REPORT_CUSTOMER_STATEMENT button
const btnSales = `              <button
                onClick={() => {
                  setCustomMode(false);
                  setReportMode(true);
                  setActiveTable('REPORT_SALES');
                }}`;
                
const btnCustomer = `              <button
                onClick={() => {
                  setCustomMode(false);
                  setReportMode(true);
                  setActiveTable('REPORT_CUSTOMER_STATEMENT');
                }}
                className={\`w-full text-right p-3 rounded-lg transition-all flex flex-col \${
                  !customMode && activeTable === 'REPORT_CUSTOMER_STATEMENT'
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'bg-white border border-rose-200 text-rose-800 hover:bg-rose-50'
                }\`}
              >
                <span className="font-bold text-[11px] leading-relaxed">صورتحساب مشتریان</span>
                <span className="text-[9px] opacity-70 font-mono mt-1" dir="ltr">ACT_TBL_003 (تراکنش‌ها)</span>
              </button>
`;

content = content.replace(btnSales, btnCustomer + btnSales);

fs.writeFileSync('components/SayanReports.tsx', content);
