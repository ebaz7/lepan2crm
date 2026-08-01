const fs = require('fs');
const file = 'components/AccountingReports.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace sqlB columns to include OpCode
content = content.replace(
    /t10\.Field_008 as Date,\s*t10\.Field_029 as Notes,\s*t11\.Field_005 as ItemCode,/g,
    `t10.Field_008 as Date,
                        t10.Field_029 as Notes,
                        t10.Field_009 as OpCode,
                        t11.Field_005 as ItemCode,`
);

// Replace sqlB WHERE clause
content = content.replace(
    /WHERE t10\.Field_009 IN \('3', '12', '23'\)\s*AND t11\.Field_036 = t10\.Field_009\s*AND t11\.Field_007 IS NOT NULL AND t11\.Field_007 > 0/g,
    `WHERE (
                        (t10.Field_009 IN ('3', '12', '23') AND t11.Field_036 = t10.Field_009 AND t11.Field_007 > 0)
                        OR
                        (t10.Field_009 = '13' AND t11.Field_036 IN ('3', '12', '23', '13'))
                      )`
);

fs.writeFileSync(file, content);
