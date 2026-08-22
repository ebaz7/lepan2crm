const axios = require('axios');

const dateTo = '2026-08-22';

const sqlGroupedNotes = `
    SELECT 
        t11.Field_005 as ItemCode,
        t10.Field_009 as DocType,
        t11.Field_031 as DetailNote,
        SUM(t11.Field_006) as NetQty
    FROM STR_TBL_011 t11
    INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                              AND t11.Field_003 = t10.Field_004 
                              AND t11.Field_012 = t10.Field_018
    WHERE t10.Field_008 <= '${dateTo}T23:59:59.000Z'
      AND (t11.Field_005 LIKE '01%' OR t11.Field_005 LIKE '04%')
    GROUP BY t11.Field_005, t10.Field_009, t11.Field_031
`;

async function run() {
  try {
    console.log("Running grouped notes query...");
    const start = Date.now();
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sqlGroupedNotes }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log(`Finished in ${Date.now() - start}ms`);
    console.log("Rows returned:", res.data.data ? res.data.data.length : 'error');
    if (res.data.data && res.data.data.length > 0) {
      console.log("First 3 rows:", res.data.data.slice(0, 3));
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
