const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1404 = ['2025-03-21T00:00:00.000Z', '2025-08-08T23:59:59.000Z'];

  console.log("=== Searching Sayan DB for 1404 Sales Tables & Sums ===");

  const str11Sum = await query(`
    SELECT 
      t10.Field_009 as HeaderOp,
      t11.Field_036 as LineOp,
      SUM(TRY_CAST(t11.Field_006 AS FLOAT)) as Qty,
      SUM(TRY_CAST(t11.Field_007 AS FLOAT)) as Amt,
      SUM(TRY_CAST(t11.Field_008 AS FLOAT)) as Discount,
      SUM(TRY_CAST(t11.Field_010 AS FLOAT)) as VAT,
      SUM(TRY_CAST(t11.Field_012 AS FLOAT)) as FinalAmt
    FROM STR_TBL_011 t11
    JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${d1404[0]}' AND t10.Field_008 <= '${d1404[1]}'
    GROUP BY t10.Field_009, t11.Field_036
    ORDER BY Amt DESC
  `);
  console.log("STR_TBL_011 sums in 1404:");
  console.table(str11Sum);
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
