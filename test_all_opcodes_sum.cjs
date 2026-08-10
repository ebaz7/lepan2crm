const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1404 = ['2025-03-21T00:00:00.000Z', '2025-08-08T23:59:59.000Z'];
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];

  console.log("=== Testing OpCode combinations for 1404 and 1405 ===");

  // Let's get all HeaderOps in 1404 with their sums
  const ops1404 = await query(`
    SELECT 
      t10.Field_009 as HeaderOp,
      SUM(TRY_CAST(t11.Field_006 AS FLOAT)) as Qty,
      SUM(TRY_CAST(t11.Field_007 AS FLOAT)) as Amt,
      SUM(TRY_CAST(t11.Field_010 AS FLOAT)) as VAT,
      SUM(TRY_CAST(COALESCE(NULLIF(t11.Field_012, '0'), TRY_CAST(t11.Field_007 AS FLOAT) + COALESCE(TRY_CAST(t11.Field_010 AS FLOAT), 0)) AS FLOAT)) as FinalAmt
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${d1404[0]}' AND t10.Field_008 <= '${d1404[1]}'
      AND TRY_CAST(t11.Field_007 AS FLOAT) > TRY_CAST(t11.Field_006 AS FLOAT) * 1000
    GROUP BY t10.Field_009
    ORDER BY FinalAmt DESC
  `);

  console.log("1404 Breakdown by HeaderOp (where Amt > Qty * 1000):");
  console.table(ops1404);

  let sum1404_Amt = 0;
  let sum1404_Final = 0;
  let sum1404_Qty = 0;
  ops1404.forEach(r => {
    sum1404_Amt += r.Amt || 0;
    sum1404_Final += r.FinalAmt || 0;
    sum1404_Qty += r.Qty || 0;
  });
  console.log(`1404 SUM ALL OPS: Qty=${sum1404_Qty}, Amt=${sum1404_Amt}, FinalAmt=${sum1404_Final}`);
  console.log("1404 TARGET in doc2.pdf: Qty = 621014.68, Amt = 31,259,201,479,120");

  // Let's also check 1405
  const ops1405 = await query(`
    SELECT 
      t10.Field_009 as HeaderOp,
      SUM(TRY_CAST(t11.Field_006 AS FLOAT)) as Qty,
      SUM(TRY_CAST(t11.Field_007 AS FLOAT)) as Amt,
      SUM(TRY_CAST(t11.Field_010 AS FLOAT)) as VAT,
      SUM(TRY_CAST(COALESCE(NULLIF(t11.Field_012, '0'), TRY_CAST(t11.Field_007 AS FLOAT) + COALESCE(TRY_CAST(t11.Field_010 AS FLOAT), 0)) AS FLOAT)) as FinalAmt
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND TRY_CAST(t11.Field_007 AS FLOAT) > TRY_CAST(t11.Field_006 AS FLOAT) * 1000
    GROUP BY t10.Field_009
    ORDER BY FinalAmt DESC
  `);

  console.log("\n1405 Breakdown by HeaderOp (where Amt > Qty * 1000):");
  console.table(ops1405);
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
