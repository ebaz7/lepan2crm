const axios = require('axios');

const lastYearDateTo = '2026-03-20'; // 1404-12-29
const currentYearDateTo = '2026-08-22'; // 1405-05-31

const sqlCurrentFast = `
    SELECT 
        t11.Field_005 as ItemCode,
        COALESCE(
            NULLIF(s04.Field_003, ''),
            NULLIF(t22.Field_004, ''),
            NULLIF(t02_exact.Field_003, ''),
            t11.Field_005,
            N'کالای بدون نام'
        ) as ItemName,
        t11.Field_031 as DetailNote,
        CASE 
            WHEN t10.Field_009 IN ('10', '13') THEN t11.Field_006 
            WHEN t10.Field_009 IN ('3', '12', '23') THEN -t11.Field_006 
            ELSE 0 
        END as NetQty,
        t10.Field_009 as DocType
    FROM STR_TBL_011 t11
    INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                              AND t11.Field_003 = t10.Field_004 
                              AND t11.Field_012 = t10.Field_018
    LEFT JOIN STR_TBL_004 s04 ON s04.Field_004 = t11.Field_005
    LEFT JOIN IND_TBL_022 t22 ON t22.Field_005 = t11.Field_005
    LEFT JOIN IND_TBL_002 t02_exact ON t02_exact.Field_008 = t11.Field_005
    WHERE t10.Field_008 <= '${currentYearDateTo}T23:59:59.000Z'
`;

async function run() {
  try {
    console.log("Running optimized query...");
    const start = Date.now();
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sqlCurrentFast }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log(`Finished in ${Date.now() - start}ms`);
    console.log("Rows returned:", res.data.data ? res.data.data.length : 'error');
    if (res.data.data && res.data.data.length > 0) {
      console.log("First 3 rows:", res.data.data.slice(0, 3));
    }
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
