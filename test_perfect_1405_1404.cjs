const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function runPeriod(dFrom, dTo) {
  const sql = `
    SELECT 
      t10.Field_001 as DocId,
      t10.Field_006 as InvoiceNum,
      t10.Field_008 as Date,
      t10.Field_009 as OpCode,
      t10.Field_037 as HeaderPayable,
      t11.Field_005 as ItemCode,
      COALESCE(t22.Field_004, t02.Field_003, t11.Field_005) as ItemName,
      TRY_CAST(t11.Field_006 AS FLOAT) as Quantity,
      TRY_CAST(t11.Field_007 AS FLOAT) as Amount,
      TRY_CAST(t11.Field_010 AS FLOAT) as VAT
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    LEFT JOIN (SELECT Field_005, MAX(Field_004) as Field_004 FROM IND_TBL_022 GROUP BY Field_005) t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN (
      SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as Field_003
      FROM IND_TBL_021 t21_sub 
      LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008)) 
      GROUP BY t21_sub.Field_004
    ) t02 ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t02.ItemCode))
    WHERE t10.Field_008 >= '${dFrom}T00:00:00.000Z' AND t10.Field_008 <= '${dTo}T23:59:59.000Z'
      AND t10.Field_009 IN ('12', '13')
      AND RTRIM(LTRIM(t11.Field_005)) NOT IN ('050101', '02020302')
  `;

  const rows = await query(sql);

  // Group by DocId
  const invMap = new Map();
  rows.forEach(r => {
    if (!invMap.has(r.DocId)) invMap.set(r.DocId, []);
    invMap.get(r.DocId).push(r);
  });

  let salesQty = 0, salesAmtWithVat = 0, salesAmtNoVat = 0;
  let retQty = 0, retAmtWithVat = 0, retAmtNoVat = 0;

  invMap.forEach((docRows) => {
    const opCode = docRows[0].OpCode;
    const headerPayable = parseFloat(docRows[0].HeaderPayable || 0);

    // Only process actual products (quantity > 0 and valid item code)
    const validRows = docRows.filter(r => (r.Quantity || 0) > 0 && r.ItemCode && !r.ItemCode.startsWith('081001'));
    if (validRows.length === 0) return;

    const sumItemAmt = validRows.reduce((s, r) => s + (r.Amount || 0), 0);
    const sumItemQty = validRows.reduce((s, r) => s + (r.Quantity || 0), 0);

    validRows.forEach(r => {
      const itemAmt = r.Amount || 0;
      const qty = r.Quantity || 0;
      let allocatedAmt = 0;

      if (headerPayable > 0) {
        if (sumItemAmt > 0) {
          allocatedAmt = headerPayable * (itemAmt / sumItemAmt);
        } else if (sumItemQty > 0) {
          allocatedAmt = headerPayable * (qty / sumItemQty);
        } else {
          allocatedAmt = headerPayable / validRows.length;
        }
      } else {
        allocatedAmt = itemAmt;
      }

      if (opCode === '12') {
        salesQty += qty;
        salesAmtNoVat += itemAmt;
        salesAmtWithVat += allocatedAmt;
      } else if (opCode === '13') {
        retQty += qty;
        retAmtNoVat += itemAmt;
        retAmtWithVat += allocatedAmt;
      }
    });
  });

  return {
    salesQty, salesAmtNoVat, salesAmtWithVat,
    retQty, retAmtNoVat, retAmtWithVat,
    netQty: salesQty - retQty,
    netAmtWithVat: salesAmtWithVat - retAmtWithVat
  };
}

async function main() {
  console.log("=== Testing 1405 (doc1.pdf) ===");
  const res1405 = await runPeriod('2026-03-21', '2026-08-08');
  console.log("1405 Sales Qty:", res1405.salesQty.toFixed(2), " | Target: 437398.63");
  console.log("1405 Ret Qty:", res1405.retQty.toFixed(2), " | Target: 1250.71");
  console.log("1405 Net Qty:", res1405.netQty.toFixed(2), " | Target: 436147.92");
  console.log("1405 Sales Amt with VAT:", Math.round(res1405.salesAmtWithVat).toLocaleString(), " | Target: 2,392,474,573,191");
  console.log("1405 Ret Amt with VAT:", Math.round(res1405.retAmtWithVat).toLocaleString(), " | Target: 8,290,234,255");
  console.log("1405 Net Amt with VAT:", Math.round(res1405.netAmtWithVat).toLocaleString(), " | Target: 2,384,184,338,936");

  console.log("\n=== Testing 1404 (doc2.pdf) ===");
  const res1404 = await runPeriod('2025-03-21', '2025-08-08');
  console.log("1404 Net Qty:", res1404.netQty.toFixed(2), " | Target: 621014.68");
  console.log("1404 Net Amt with VAT:", Math.round(res1404.netAmtWithVat).toLocaleString(), " | Target: 31,259,201,479,120");
}

main().catch(console.error);
