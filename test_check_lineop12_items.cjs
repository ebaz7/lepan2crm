const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];

  console.log("=== Checking items under LineOp 12 & HeaderOp 12 in 1405 ===");

  const items = await query(`
    SELECT 
      t11.Field_005 as ItemCode,
      COALESCE(t22.Field_004, t02.Field_003, t11.Field_005) as ItemName,
      SUM(TRY_CAST(t11.Field_006 AS FLOAT)) as Qty,
      SUM(TRY_CAST(t11.Field_007 AS FLOAT)) as Amt,
      SUM(TRY_CAST(t11.Field_010 AS FLOAT)) as VAT,
      SUM(TRY_CAST(COALESCE(NULLIF(t11.Field_012, '0'), TRY_CAST(t11.Field_007 AS FLOAT) + COALESCE(TRY_CAST(t11.Field_010 AS FLOAT), 0)) AS FLOAT)) as FinalAmt
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
    ORDER BY Qty DESC
  `);

  console.log("Unique item count:", items.length);
  let totalQty = 0;
  let totalAmt = 0;
  let totalVAT = 0;
  let totalFinal = 0;

  items.forEach(i => {
    totalQty += i.Qty;
    totalAmt += i.Amt;
    totalVAT += i.VAT || 0;
    totalFinal += i.FinalAmt;
  });

  console.log(`TOTALS: Qty = ${totalQty.toFixed(2)}, Amt = ${totalAmt.toLocaleString()}, VAT = ${totalVAT.toLocaleString()}, Final = ${totalFinal.toLocaleString()}`);

  console.log("\nTop 15 Items:");
  console.table(items.slice(0, 15));
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
