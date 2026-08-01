const fs = require('fs');
let code = fs.readFileSync('components/AccountingReports.tsx', 'utf8');
console.log(code.slice(-200));
