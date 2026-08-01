const fs = require('fs');

const sayanPath = 'components/SayanReports.tsx';
let content = fs.readFileSync(sayanPath, 'utf8');

// Update Report Queries
content = content.replace(
  "if (activeTable === 'REPORT_SALES') {",
  `if (activeTable === 'REPORT_CUSTOMER_STATEMENT') {\n             sqlQuery = "SELECT TOP 1000 Field_008 as [Date], Field_006 as [Description], Field_010 as [Debit], Field_011 as [Credit] FROM ACT_TBL_003 WHERE Field_006 IS NOT NULL ORDER BY Field_008 DESC";\n          } else if (activeTable === 'REPORT_DEBTORS') {\n             sqlQuery = "SELECT TOP 500 Field_006 as [AccountName], Field_010 as [Debit], Field_011 as [Credit] FROM ACT_TBL_003 WHERE (Field_010 > 0 OR Field_011 > 0) ORDER BY Field_001 DESC";\n          } else if (activeTable === 'REPORT_SALES') {`
);

content = content.replace(
  /\} else if \(activeTable === 'REPORT_DEBTORS'\) \{[\s\S]*?\} else if \(activeTable === 'REPORT_BANKS'\) \{/,
  `} else if (activeTable === 'REPORT_BANKS') {`
);

fs.writeFileSync(sayanPath, content);
console.log("Patched queries");
