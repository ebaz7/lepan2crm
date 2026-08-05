const fs = require('fs');
let code = fs.readFileSync('components/sales/SayanSalesDashboard.tsx', 'utf8');

code = code.replaceAll("جمع کل عملکرد (۱۵ گروه اصلی):", "جمع کل عملکرد (گروه‌های اصلی):");

fs.writeFileSync('components/sales/SayanSalesDashboard.tsx', code);
