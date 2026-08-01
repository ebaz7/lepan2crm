const fs = require('fs');

const sayanPath = 'components/SayanReports.tsx';
let content = fs.readFileSync(sayanPath, 'utf8');

// I need to fix the mess I made!
// First find the REPORT_CUSTOMER_STATEMENT block
content = content.replace(
  `if (activeTable === 'REPORT_CUSTOMER_STATEMENT') {
             sqlQuery = "SELECT TOP 1000 Field_008 as [Date], Field_006 as [Description], Field_010 as [Debit], Field_011 as [Credit] FROM ACT_TBL_003 WHERE Field_006 IS NOT NULL ORDER BY Field_008 DESC";
          } else if (activeTable === 'REPORT_BANKS') {`,
  `if (activeTable === 'REPORT_SALES') {`
);

// We need to inject the queries correctly where `let sqlQuery = '';` is defined
content = content.replace(
  `let sqlQuery = '';
          if (activeTable === 'REPORT_SALES') {
             sqlQuery = "SELECT TOP 1000 * FROM BUR_TBL_015";
          } else if (activeTable === 'REPORT_DEBTORS') {
             sqlQuery = "SELECT TOP 1000 * FROM ACT_TBL_001 WHERE Field_006 LIKE N'%بدهکار%' OR Field_006 LIKE N'%بستانکار%'";
          }`,
  `let sqlQuery = '';
          if (activeTable === 'REPORT_SALES') {
             sqlQuery = "SELECT TOP 1000 * FROM BUR_TBL_015";
          } else if (activeTable === 'REPORT_CUSTOMER_STATEMENT') {
             sqlQuery = "SELECT TOP 1000 Field_008 as [Date], Field_006 as [Description], Field_010 as [Debit], Field_011 as [Credit] FROM ACT_TBL_003 WHERE Field_006 IS NOT NULL ORDER BY Field_008 DESC";
          } else if (activeTable === 'REPORT_DEBTORS') {
             sqlQuery = "SELECT TOP 500 Field_006 as [AccountName], Field_010 as [Debit], Field_011 as [Credit] FROM ACT_TBL_003 WHERE (Field_010 > 0 OR Field_011 > 0) ORDER BY Field_001 DESC";
          }`
);

fs.writeFileSync(sayanPath, content);
console.log("Restored and patched properly");
