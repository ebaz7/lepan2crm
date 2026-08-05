const fs = require('fs');
let code = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

// Replace COALESCE in AccountingReports.tsx
code = code.replace(/COALESCE\(t22\.Field_004, t11\.Field_031, t_name\.ItemName, t11\.Field_005, 'کالای بدون نام'\) as ItemName/g, "COALESCE(t_name.ItemName, t11.Field_005, 'کالای بدون نام') as ItemName");

fs.writeFileSync('components/AccountingReports.tsx', code);

let serverCode = fs.readFileSync('server.js', 'utf8');
serverCode = serverCode.replace(/COALESCE\(t22\.Field_004, t11\.Field_031, t_name\.ItemName, t11\.Field_005, 'کالای بدون نام'\) as ItemName/g, "COALESCE(t_name.ItemName, t11.Field_005, 'کالای بدون نام') as ItemName");
serverCode = serverCode.replace(/COALESCE\(t22\.Field_004, t11\.Field_031, t_name\.ItemName, t11\.Field_005\) as ItemName/g, "COALESCE(t_name.ItemName, t11.Field_005) as ItemName");
fs.writeFileSync('server.js', serverCode);
