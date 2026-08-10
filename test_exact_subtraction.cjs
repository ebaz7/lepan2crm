const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];

  console.log("=== Finding exact combination of items matching 437,398.63 kg ===");

  const items = await query(`
    SELECT 
      t11.Field_005 as ItemCode,
      COALESCE(t22.Field_004, t02.Field_003, t11.Field_005) as ItemName,
      SUM(TRY_CAST(t11.Field_006 AS FLOAT)) as Qty,
      SUM(TRY_CAST(t11.Field_007 AS FLOAT)) as Amt,
      SUM(TRY_CAST(t11.Field_007 AS FLOAT)) / NULLIF(SUM(TRY_CAST(t11.Field_006 AS FLOAT)), 0) as AvgUnitPrice
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    LEFT JOIN (SELECT Field_005, MAX(Field_004) as Field_004 FROM IND_TBL_022 GROUP BY Field_005) t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN (
      SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as Field_003
      FROM IND_TBL_021 t21_sub 
      LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008)) 
      GROUP BY t21_sub.Field_004
    ) t02 ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t02.ItemCode))
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND t10.Field_009 = '12'
      AND t11.Field_036 = '12'
      AND TRY_CAST(t11.Field_007 AS FLOAT) > TRY_CAST(t11.Field_006 AS FLOAT) * 1000
    GROUP BY t11.Field_005, COALESCE(t22.Field_004, t02.Field_003, t11.Field_005)
    ORDER BY AvgUnitPrice ASC
  `);

  console.log("Items sorted by AvgUnitPrice:");
  items.forEach(i => {
    console.log(`${i.ItemCode} | ${i.ItemName.padEnd(35)} | Qty: ${i.Qty.toFixed(2).padStart(10)} | AvgPrice: ${Math.round(i.AvgUnitPrice).toLocaleString().padStart(12)}`);
  });
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
