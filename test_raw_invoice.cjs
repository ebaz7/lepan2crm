const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const sql = `
    SELECT TOP 10 
      t10.Field_001 as DocId,
      t10.Field_006 as InvoiceNum,
      t10.Field_008 as Date,
      t10.Field_037 as HeaderPayable,
      t11.Field_005 as ItemCode,
      t11.Field_006 as Qty,
      t11.Field_007 as Amt,
      t11.Field_008 as Disc,
      t11.Field_009 as NetAmt,
      t11.Field_010 as VAT,
      t11.Field_012 as FinalAmt
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '2026-03-21T00:00:00.000Z' AND t10.Field_008 <= '2026-08-08T23:59:59.000Z'
      AND t10.Field_009 = '12'
  `;
  const rows = await query(sql);
  console.log("Sample Invoice Rows:", rows);
}

main().catch(console.error);
