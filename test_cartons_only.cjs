const axios = require('axios');

const dateTo = '2026-08-22';

const sqlCartonsOnly = `
    SELECT 
        t11.Field_005 as ItemCode,
        SUM(CASE 
            WHEN t10.Field_009 IN ('10', '13') THEN
                TRY_CAST(
                    LEFT(
                        LTRIM(SUBSTRING(t11.Field_031, CHARINDEX(N'تعداد کارتن:', t11.Field_031) + 12, 10)),
                        PATINDEX('%[^0-9]%', LTRIM(SUBSTRING(t11.Field_031, CHARINDEX(N'تعداد کارتن:', t11.Field_031) + 12, 10)) + 'X') - 1
                    ) as float
                )
            WHEN t10.Field_009 IN ('3', '12', '23') THEN
                -TRY_CAST(
                    LEFT(
                        LTRIM(SUBSTRING(t11.Field_031, CHARINDEX(N'تعداد کارتن:', t11.Field_031) + 12, 10)),
                        PATINDEX('%[^0-9]%', LTRIM(SUBSTRING(t11.Field_031, CHARINDEX(N'تعداد کارتن:', t11.Field_031) + 12, 10)) + 'X') - 1
                    ) as float
                )
            ELSE 0
        END) as CartonsQty
    FROM STR_TBL_011 t11
    INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                              AND t11.Field_003 = t10.Field_004 
                              AND t11.Field_012 = t10.Field_018
    WHERE t10.Field_008 <= '${dateTo}T23:59:59.000Z'
      AND t11.Field_031 LIKE N'%تعداد کارتن:%'
      AND (t11.Field_005 LIKE '01%' OR t11.Field_005 LIKE '04%')
    GROUP BY t11.Field_005
`;

async function run() {
  try {
    console.log("Running cartons-only query...");
    const start = Date.now();
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sqlCartonsOnly }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log(`Finished in ${Date.now() - start}ms`);
    console.log("Rows returned:", res.data.data ? res.data.data.length : 'error');
    if (res.data.data && res.data.data.length > 0) {
      console.log("First 5 rows:", res.data.data.slice(0, 5));
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
