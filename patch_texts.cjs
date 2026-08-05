const fs = require('fs');
let code = fs.readFileSync('components/sales/SayanSalesDashboard.tsx', 'utf8');

code = code.replace(/۱۵ گروه اصلی سایان/g, 'گروه‌های اصلی کالا');
code = code.replace(/15 MAJOR PRODUCT GROUPS REPORT/g, 'MAJOR PRODUCT GROUPS REPORT');
code = code.replace(/جدول عملکرد گروههای اصلی کالا \(15 گروه\)/g, 'جدول عملکرد گروه‌های اصلی کالا');

fs.writeFileSync('components/sales/SayanSalesDashboard.tsx', code);
