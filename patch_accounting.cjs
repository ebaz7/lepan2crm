const fs = require('fs');
let code = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

// Update SQL for Sales A
const sqlATarget = `                WHERE t10.Field_009 IN ('3', '12', '23')
                  AND t11.Field_036 = t10.Field_009
                  AND t11.Field_007 IS NOT NULL AND t11.Field_007 > 0`;

const sqlAReplace = `                WHERE (
                    (t10.Field_009 IN ('3', '12', '23') AND t11.Field_036 = t10.Field_009 AND t11.Field_007 > 0)
                    OR
                    (t10.Field_009 = '13' AND t11.Field_036 IN ('3', '12', '23', '13'))
                  )`;

code = code.replace(sqlATarget, sqlAReplace);

// Update SQL for Sales B
const sqlBTarget = `                WHERE t10.Field_009 IN ('3', '12', '23')
                  AND t11.Field_036 = t10.Field_009
                  AND t11.Field_007 IS NOT NULL AND t11.Field_007 > 0`;

code = code.replace(sqlBTarget, sqlAReplace);

// Also we need to select OpCode
code = code.replace('t10.Field_029 as Notes,', 't10.Field_029 as Notes,\n                    t10.Field_009 as OpCode,');
code = code.replace('t10.Field_029 as Notes,', 't10.Field_029 as Notes,\n                    t10.Field_009 as OpCode,'); // for both A and B if it replaces twice

fs.writeFileSync('components/AccountingReports.tsx', code);
console.log('patched');
