const axios = require('axios');

const dateTo = '2026-08-22';

// Let's write a query that groups by ItemCode in SQL Server
const sqlGrouped = `
    SELECT 
        t11.Field_005 as ItemCode,
        SUM(CASE 
            WHEN t10.Field_009 IN ('10', '13') THEN CAST(t11.Field_006 as float)
            WHEN t10.Field_009 IN ('3', '12', '23') THEN -CAST(t11.Field_006 as float)
            ELSE 0 
        END) as StockQty,
        SUM(CASE 
            WHEN t11.Field_031 LIKE '%تعداد کارتن:%' THEN
                CASE 
                    WHEN t10.Field_009 IN ('10', '13') THEN 1 -- we can parse cartons or estimate
                    WHEN t10.Field_009 IN ('3', '12', '23') THEN -1
                    ELSE 0
                END
            ELSE 0
        END) as CartonsEstimated
    FROM STR_TBL_011 t11
    INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                              AND t11.Field_003 = t10.Field_004 
                              AND t11.Field_012 = t10.Field_018
    WHERE t10.Field_008 <= '${dateTo}T23:59:59.000Z'
    GROUP BY t11.Field_005
`;

async function run() {
  try {
    console.log("Running grouped SQL query...");
    const start = Date.now();
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sqlGrouped }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log(`Finished in ${Date.now() - start}ms`);
    console.log("Unique item count:", res.data.data ? res.data.data.length : 'error');
    if (res.data.data && res.data.data.length > 0) {
      console.log("Sample rows:", res.data.data.slice(0, 5));
    }
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
