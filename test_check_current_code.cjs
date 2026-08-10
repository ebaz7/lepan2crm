const fs = require('fs');

const file = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

// Find sqlA query in AccountingReports.tsx
const startIdx = file.indexOf('const sqlA = `');
if (startIdx !== -1) {
  console.log("=== sqlA query in AccountingReports.tsx ===");
  console.log(file.substring(startIdx, startIdx + 2000));
}
