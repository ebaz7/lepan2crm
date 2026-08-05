const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const targetStr = `    if (salesRows.length > 0) {
        const title = \`گزارش رسمی فروش روزانه و مرجوعی سایان - مورخ \${shamsiDate} (\${labelSuffix})\`;
        const columns = ['ردیف', 'گروه / نام کالا', 'فروش ناخالص (ک‌گ / ریال)', 'مرجوعی کد ۱۳ (ک‌گ / ریال)', 'خالص (ک‌گ / ریال)', 'فی نهایی (ریال)'];
        
        const groupedMap = new Map();
        let totalSalesQty = 0;
        let totalSalesAmt = 0;
        let totalReturnQty = 0;
        let totalReturnAmt = 0;`;

if (content.includes(targetStr)) {
    console.log("Target found!");
} else {
    console.log("Target NOT found. Let's see what is there.");
    console.log(content.substring(content.indexOf('if (salesRows.length > 0) {'), content.indexOf('if (salesRows.length > 0) {') + 500));
}
