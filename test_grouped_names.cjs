const axios = require('axios');

const dateTo = '2026-08-22';

const sqlGroupedWithNames = `
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
                    -- We can parse the exact number of cartons in SQL Server!
                    CASE 
                        -- Check if there is a number after "تعداد کارتن:"
                        WHEN PATINDEX(N'%تعداد کارتن:[0-9]%', t11.Field_031) > 0 THEN
                            -- Simple estimation or fallback if exact extraction is complex
                            1
                        ELSE 0
                    END
                ELSE 0
            END) as CartonsQtyDummy
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
        COALESCE(
            NULLIF(RTRIM(LTRIM(s04.Field_003)), ''),
            NULLIF(RTRIM(LTRIM(t22.Field_004)), ''),
            NULLIF(RTRIM(LTRIM(t02_exact.Field_003)), ''),
            NULLIF(RTRIM(LTRIM(t_name.ItemName)), ''),
            NULLIF(RTRIM(LTRIM(t_group.GroupName)), ''),
            NULLIF(RTRIM(LTRIM(c01.Field_003)), ''),
            RTRIM(LTRIM(gs.ItemCode)),
            N'کالای بدون نام'
        ) as ItemName,
        t_group.GroupName,
        t_group.SubGroupName
    FROM GroupedStock gs
    LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(gs.ItemCode))
    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(gs.ItemCode))
    LEFT JOIN IND_TBL_002 t02_exact ON RTRIM(LTRIM(t02_exact.Field_008)) = RTRIM(LTRIM(gs.ItemCode))
    LEFT JOIN COM_TBL_001 c01 ON RTRIM(LTRIM(c01.Field_004)) = RTRIM(LTRIM(gs.ItemCode))
    LEFT JOIN (
        SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
        FROM IND_TBL_021 t21_sub
        LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
        GROUP BY t21_sub.Field_004
    ) t_name ON RTRIM(LTRIM(gs.ItemCode)) = RTRIM(LTRIM(t_name.ItemCode))
    LEFT JOIN (
        SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, 
               MIN(t02_sub.Field_003) as SubGroupName,
               MIN(COALESCE(t02_grandparent.Field_003, t02_parent.Field_003, t02_sub.Field_003)) as GroupName
        FROM IND_TBL_021 t21_sub
        LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
        LEFT JOIN IND_TBL_002 t02_parent ON RTRIM(LTRIM(t02_sub.Field_009)) = RTRIM(LTRIM(t02_parent.Field_008))
        LEFT JOIN IND_TBL_002 t02_grandparent ON RTRIM(LTRIM(t02_parent.Field_009)) = RTRIM(LTRIM(t02_grandparent.Field_008))
        GROUP BY t21_sub.Field_004
    ) t_group ON RTRIM(LTRIM(gs.ItemCode)) = RTRIM(LTRIM(t_group.ItemCode))
`;

async function run() {
  try {
    console.log("Running grouped query with names...");
    const start = Date.now();
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sqlGroupedWithNames }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
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
