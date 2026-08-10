const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];

  console.log("=== Inspecting OpCode 12 rows where t11.Field_007 > 0 ===");

  const rows = await query(`
    SELECT 
      t10.Field_001 as DocId,
      t10.Field_006 as InvoiceNum,
      t10.Field_008 as Date,
      t10.Field_009 as HeaderOp,
      t11.Field_036 as LineOp,
      t11.Field_005 as ItemCode,
      COALESCE(t22.Field_004, t02.Field_003, t11.Field_005) as ItemName,
      t11.Field_006 as Qty,
      t11.Field_007 as Amt,
      t11.Field_010 as VAT,
      t11.Field_012 as FinalAmt
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_021 t21 ON RTRIM(LTRIM(t21.Field_004)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_002 t02 ON t02.Field_008 = t21.Field_003
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND t10.Field_009 = '12'
      AND t11.Field_007 > 0
  `);

  console.log("Total rows with Amt > 0 in Op 12:", rows.length);

  // Group by ItemName and print total Qty and Amt for each item!
  const itemMap = new Map();
  rows.forEach(r => {
    const name = r.ItemName;
    if (!itemMap.has(name)) itemMap.set(name, { count: 0, qty: 0, amt: 0 });
    const entry = itemMap.get(name);
    entry.count++;
    entry.qty += parseFloat(r.Qty || 0);
    entry.amt += parseFloat(r.Amt || 0);
  });

  const sortedItems = Array.from(itemMap.entries()).sort((a, b) => b[1].qty - a[1].qty);
  console.log("\nTop items in DB by Qty (when Amt > 0):");
  sortedItems.slice(0, 20).forEach(([name, data]) => {
    console.log(`${name}: Count=${data.count}, Qty=${data.qty.toFixed(2)}, Amt=${data.amt.toLocaleString()}`);
  });
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
