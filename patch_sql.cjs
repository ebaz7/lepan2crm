const fs = require('fs');
const file = 'components/AccountingReports.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
    /SELECT t21_sub\.Field_004 as ItemCode, MIN\(COALESCE\(t02_parent\.Field_003, t02_sub\.Field_003\)\) as GroupName\s*FROM IND_TBL_021 t21_sub\s*LEFT JOIN IND_TBL_002 t02_sub ON t21_sub\.Field_003 = t02_sub\.Field_008\s*LEFT JOIN IND_TBL_002 t02_parent ON t02_sub\.Field_009 = t02_parent\.Field_008\s*GROUP BY t21_sub\.Field_004/g,
    `SELECT t21_sub.Field_004 as ItemCode, MIN(COALESCE(t02_grandparent.Field_003, t02_parent.Field_003, t02_sub.Field_003)) as GroupName
                    FROM IND_TBL_021 t21_sub
                    LEFT JOIN IND_TBL_002 t02_sub ON t21_sub.Field_003 = t02_sub.Field_008
                    LEFT JOIN IND_TBL_002 t02_parent ON t02_sub.Field_009 = t02_parent.Field_008
                    LEFT JOIN IND_TBL_002 t02_grandparent ON t02_parent.Field_009 = t02_grandparent.Field_008
                    GROUP BY t21_sub.Field_004`
);
fs.writeFileSync(file, content);
