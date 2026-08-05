const fs = require('fs');
let code = fs.readFileSync('components/sales/SayanSalesDashboard.tsx', 'utf8');

code = code.replaceAll("const itemKey = row.ItemCode || row.ItemName || 'کالا';", "const itemKey = row.ItemName || 'کالا';");

fs.writeFileSync('components/sales/SayanSalesDashboard.tsx', code);
