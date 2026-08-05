const fs = require('fs');
let code = fs.readFileSync('components/AccountingReports.tsx', 'utf8');
code = code.replace(/ORDER BY COALESCE\(t22\.Field_004, t11\.Field_031, t_name\.ItemName, t11\.Field_005, 'کالای بدون نام'\)/g, "ORDER BY COALESCE(t_name.ItemName, t11.Field_005, 'کالای بدون نام')");
fs.writeFileSync('components/AccountingReports.tsx', code);

let serverCode = fs.readFileSync('server.js', 'utf8');
serverCode = serverCode.replace(/ORDER BY COALESCE\(t22\.Field_004, t11\.Field_031, t_name\.ItemName, t11\.Field_005, 'کالای بدون نام'\)/g, "ORDER BY COALESCE(t_name.ItemName, t11.Field_005, 'کالای بدون نام')");
fs.writeFileSync('server.js', serverCode);
