const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const sql = `
    SELECT 
      t11.Field_005 as ItemCode,
      COALESCE(t22.Field_004, t02.Field_003, t11.Field_005) as ItemName,
      SUM(TRY_CAST(t11.Field_006 AS FLOAT)) as Qty,
      SUM(TRY_CAST(t11.Field_007 AS FLOAT)) as Amt
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    LEFT JOIN (SELECT Field_005, MAX(Field_004) as Field_004 FROM IND_TBL_022 GROUP BY Field_005) t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN (
      SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as Field_003
      FROM IND_TBL_021 t21_sub 
      LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008)) 
      GROUP BY t21_sub.Field_004
    ) t02 ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t02.ItemCode))
    WHERE t10.Field_008 >= '2026-03-21T00:00:00.000Z' AND t10.Field_008 <= '2026-08-08T23:59:59.000Z'
      AND t10.Field_009 = '12' AND t11.Field_036 = '12'
      AND TRY_CAST(t11.Field_007 AS FLOAT) > TRY_CAST(t11.Field_006 AS FLOAT) * 1000
      AND RTRIM(LTRIM(t11.Field_005)) NOT IN ('050101', '02020302')
    GROUP BY t11.Field_005, COALESCE(t22.Field_004, t02.Field_003, t11.Field_005)
  `;

  const dbItems = await query(sql);

  // Target Qty from doc1.pdf:
  // POY 160/48 سفید = 21,967.10
  // POY 160/48 مشکی = 7,369.60
  // POY 500/96 سفید = 11,668.59
  // POY total = 41,005.29
  // ...
  console.log("DB Items count:", dbItems.length);
  let totalQty = 0;
  dbItems.forEach(i => {
    totalQty += i.Qty;
    console.log(`${i.ItemCode.padEnd(20)} | ${i.ItemName.padEnd(30)} | Qty: ${i.Qty.toFixed(2).padStart(10)}`);
  });
  console.log("Total Qty:", totalQty.toFixed(2));
}

main().catch(console.error);
