const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function runReport(dFrom, dTo) {
  const sql = `
    SELECT 
      t10.Field_009 as OpCode,
      t11.Field_005 as ItemCode,
      TRY_CAST(t11.Field_006 AS FLOAT) as Quantity,
      TRY_CAST(t11.Field_007 AS FLOAT) as Amount,
      COALESCE(TRY_CAST(t11.Field_010 AS FLOAT), 0) as VAT,
      COALESCE(NULLIF(TRY_CAST(t11.Field_012 AS FLOAT), 0), TRY_CAST(t11.Field_007 AS FLOAT) + COALESCE(TRY_CAST(t11.Field_010 AS FLOAT), 0), TRY_CAST(t11.Field_007 AS FLOAT)) as FinalAmount
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${dFrom}T00:00:00.000Z' AND t10.Field_008 <= '${dTo}T23:59:59.000Z'
      AND (
        (t10.Field_009 = '12' AND t11.Field_036 = '12')
        OR
        (t10.Field_009 = '13' AND t11.Field_036 = '13')
      )
      AND TRY_CAST(t11.Field_007 AS FLOAT) > TRY_CAST(t11.Field_006 AS FLOAT) * 1000
      AND RTRIM(LTRIM(t11.Field_005)) NOT IN ('050101', '02020302')
  `;

  const rows = await query(sql);

  let salesQty = 0, salesAmtNoVat = 0, salesVat = 0, salesAmtWithVat = 0;
  let retQty = 0, retAmtNoVat = 0, retVat = 0, retAmtWithVat = 0;

  rows.forEach(r => {
    const qty = r.Quantity || 0;
    const amt = r.Amount || 0;
    const vat = r.VAT || 0;
    const finalAmt = r.FinalAmount || (amt + vat);

    if (r.OpCode === '12') {
      salesQty += qty;
      salesAmtNoVat += amt;
      salesVat += vat;
      salesAmtWithVat += finalAmt;
    } else if (r.OpCode === '13') {
      retQty += qty;
      retAmtNoVat += amt;
      retVat += vat;
      retAmtWithVat += finalAmt;
    }
  });

  return {
    salesQty, salesAmtNoVat, salesVat, salesAmtWithVat,
    retQty, retAmtNoVat, retVat, retAmtWithVat,
    netQty: salesQty - retQty,
    netAmtNoVat: salesAmtNoVat - retAmtNoVat,
    netVat: salesVat - retVat,
    netAmtWithVat: salesAmtWithVat - retAmtWithVat
  };
}

async function main() {
  console.log("=== Testing 1405 Report (doc1.pdf target) ===");
  const r1405 = await runReport('2026-03-21', '2026-08-08');
  console.log("1405 Results:", {
    "Sales Qty (kg)": r1405.salesQty.toFixed(2),
    "Target Sales Qty": "437398.63",
    "Sales Amt with VAT": Math.round(r1405.salesAmtWithVat).toLocaleString(),
    "Target Sales Amt": "2,392,474,573,191",
    "Net Qty (kg)": r1405.netQty.toFixed(2),
    "Target Net Qty": "436147.92",
    "Net Amt with VAT": Math.round(r1405.netAmtWithVat).toLocaleString(),
    "Target Net Amt": "2,384,184,338,936"
  });

  console.log("\n=== Testing 1404 Report (doc2.pdf target) ===");
  const r1404 = await runReport('2025-03-21', '2025-08-08');
  console.log("1404 Results:", {
    "Net Qty (kg)": r1404.netQty.toFixed(2),
    "Target Net Qty": "621014.68",
    "Net Amt with VAT": Math.round(r1404.netAmtWithVat).toLocaleString(),
    "Target Net Amt": "31,259,201,479,120"
  });
}

main().catch(console.error);
