const axios = require('axios');

const dateTo = '2026-08-22';

const sqlFiltered = `
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
    WHERE t10.Field_008 <= '${dateTo}T23:59:59.000Z'
      AND (t11.Field_005 LIKE '01%' OR t11.Field_005 LIKE '04%')
`;

async function run() {
  try {
    console.log("Running filtered query (01% and 04%)...");
    const start = Date.now();
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sqlFiltered }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log(`Finished in ${Date.now() - start}ms`);
    console.log("Rows returned:", res.data.data ? res.data.data.length : 'error');
    if (res.data.data && res.data.data.length > 0) {
      console.log("Sample rows:", res.data.data.slice(0, 3));
    }
  } catch(e) {
    if (e.response && e.response.data) {
      console.error("Error from API:", e.response.data);
    } else {
      console.error("Error:", e.message);
    }
  }
}
run();
