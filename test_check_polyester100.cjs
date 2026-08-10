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
      t10.Field_001 as DocId,
      t10.Field_006 as InvoiceNum,
      t10.Field_008 as Date,
      t10.Field_010 as CustomerCode,
      t07.Field_006 as CustomerName,
      t10.Field_029 as HeaderNotes,
      t11.Field_031 as ItemNotes,
      TRY_CAST(t11.Field_006 AS FLOAT) as Qty,
      TRY_CAST(t11.Field_007 AS FLOAT) as Amt,
      TRY_CAST(t11.Field_007 AS FLOAT) / NULLIF(TRY_CAST(t11.Field_006 AS FLOAT), 0) as PricePerKg
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    LEFT JOIN ACT_TBL_007 t07 ON RTRIM(LTRIM(t10.Field_010)) = RTRIM(LTRIM(t07.Field_005)) AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
    WHERE t10.Field_008 >= '2026-03-21T00:00:00.000Z' AND t10.Field_008 <= '2026-08-08T23:59:59.000Z'
      AND t10.Field_009 = '12' AND t11.Field_036 = '12'
      AND RTRIM(LTRIM(t11.Field_005)) = '010301011001'
    ORDER BY PricePerKg ASC
  `;

  const rows = await query(sql);
  console.log("Polyester 100 Lines Count:", rows.length);
  rows.forEach(r => {
    console.log(`Invoice #${r.InvoiceNum} | Date: ${r.Date.substring(0,10)} | Customer: ${(r.CustomerName||'').padEnd(20)} | Qty: ${r.Qty.toFixed(2).padStart(8)} | Price: ${Math.round(r.PricePerKg).toLocaleString().padStart(10)} | Notes: ${r.HeaderNotes||''} ${r.ItemNotes||''}`);
  });
}

main().catch(console.error);
