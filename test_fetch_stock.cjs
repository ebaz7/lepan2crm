const axios = require('axios');

const lastYearDateTo = '2026-03-20'; // 1404-12-29
const currentYearDateTo = '2026-08-22'; // 1405-05-31

const sqlLastYear = `
    SELECT 
        RTRIM(LTRIM(t11.Field_005)) as ItemCode,
        COALESCE(
            NULLIF(RTRIM(LTRIM(s04.Field_003)), ''),
            NULLIF(RTRIM(LTRIM(t22.Field_004)), ''),
            RTRIM(LTRIM(t11.Field_005)),
            N'کالای بدون نام'
        ) as ItemName,
        t11.Field_031 as DetailNote,
        CASE 
            WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '13') THEN t11.Field_006 
            WHEN RTRIM(LTRIM(t10.Field_009)) IN ('3', '12', '23') THEN -t11.Field_006 
            ELSE 0 
        END as NetQty,
        RTRIM(LTRIM(t10.Field_009)) as DocType
    FROM STR_TBL_011 t11
    INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                              AND t11.Field_003 = t10.Field_004 
                              AND t11.Field_012 = t10.Field_018
    LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    WHERE t10.Field_008 <= '${lastYearDateTo}T23:59:59.000Z'
`;

const sqlCurrent = `
    SELECT 
        RTRIM(LTRIM(t11.Field_005)) as ItemCode,
        COALESCE(
            NULLIF(RTRIM(LTRIM(s04.Field_003)), ''),
            NULLIF(RTRIM(LTRIM(t22.Field_004)), ''),
            RTRIM(LTRIM(t11.Field_005)),
            N'کالای بدون نام'
        ) as ItemName,
        t11.Field_031 as DetailNote,
        CASE 
            WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '13') THEN t11.Field_006 
            WHEN RTRIM(LTRIM(t10.Field_009)) IN ('3', '12', '23') THEN -t11.Field_006 
            ELSE 0 
        END as NetQty,
        RTRIM(LTRIM(t10.Field_009)) as DocType
    FROM STR_TBL_011 t11
    INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                              AND t11.Field_003 = t10.Field_004 
                              AND t11.Field_012 = t10.Field_018
    LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    WHERE t10.Field_008 <= '${currentYearDateTo}T23:59:59.000Z'
`;

async function run() {
  try {
    const resLast = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sqlLastYear }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    const resCurr = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sqlCurrent }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    
    console.log("Last Year Rows count:", resLast.data.data ? resLast.data.data.length : 'error');
    console.log("Current Year Rows count:", resCurr.data.data ? resCurr.data.data.length : 'error');
    
    if (resCurr.data.data && resCurr.data.data.length > 0) {
      console.log("Sample Current Year Row:", resCurr.data.data[0]);
    }
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
