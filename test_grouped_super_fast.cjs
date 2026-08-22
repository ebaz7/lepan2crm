const axios = require('axios');

const dateTo = '2026-08-22';

const sqlSuperFast = `
    WITH GroupedStock AS (
        SELECT 
            t11.Field_005 as ItemCode,
            SUM(CASE 
                WHEN t10.Field_009 IN ('10', '13') THEN t11.Field_006 
                WHEN t10.Field_009 IN ('3', '12', '23') THEN -t11.Field_006 
                ELSE 0 
            END) as StockQty,
            SUM(CASE 
                WHEN t11.Field_031 LIKE N'%تعداد کارتن:%' THEN
                    CASE 
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
                    END
                ELSE 0
            END) as CartonsQty
        FROM STR_TBL_011 t11
        INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004 
                                  AND t11.Field_012 = t10.Field_018
        WHERE t10.Field_008 <= '${dateTo}T23:59:59.000Z'
          AND (t11.Field_005 LIKE '01%' OR t11.Field_005 LIKE '04%')
        GROUP BY t11.Field_005
    )
    SELECT 
        gs.ItemCode,
        gs.StockQty,
        COALESCE(gs.CartonsQty, 0) as CartonsQty,
        COALESCE(
            NULLIF(s04.Field_003, ''),
            NULLIF(t22.Field_004, ''),
            NULLIF(t02_exact.Field_003, ''),
            gs.ItemCode,
            N'کالای بدون نام'
        ) as ItemName
    FROM GroupedStock gs
    LEFT JOIN STR_TBL_004 s04 ON s04.Field_004 = gs.ItemCode
    LEFT JOIN IND_TBL_022 t22 ON t22.Field_005 = gs.ItemCode
    LEFT JOIN IND_TBL_002 t02_exact ON t02_exact.Field_008 = gs.ItemCode
`;

async function run() {
  try {
    console.log("Running super fast grouped query...");
    const start = Date.now();
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sqlSuperFast }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log(`Finished in ${Date.now() - start}ms`);
    console.log("Rows returned:", res.data.data ? res.data.data.length : 'error');
    if (res.data.data && res.data.data.length > 0) {
      console.log("Sample non-zero rows:", res.data.data.filter(r => r.StockQty > 0 || r.CartonsQty > 0).slice(0, 5));
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
