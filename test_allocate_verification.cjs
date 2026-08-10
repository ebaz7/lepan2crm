const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const dFrom = '2026-03-21';
  const dTo = '2026-08-08';

  const sql = `
    SELECT 
      t10.Field_001 as DocId,
      t10.Field_009 as OpCode,
      t10.Field_037 as HeaderPayable,
      t11.Field_005 as ItemCode,
      TRY_CAST(t11.Field_006 AS FLOAT) as Quantity,
      TRY_CAST(t11.Field_007 AS FLOAT) as Amount
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

  // Group by DocId
  const invMap = new Map();
  rows.forEach(r => {
    if (!invMap.has(r.DocId)) invMap.set(r.DocId, []);
    invMap.get(r.DocId).push(r);
  });

  let totalSalesAmtWithVAT = 0;
  let totalSalesAmtNoVAT = 0;
  let totalSalesQty = 0;

  let totalRetAmtWithVAT = 0;
  let totalRetAmtNoVAT = 0;
  let totalRetQty = 0;

  invMap.forEach((docRows) => {
    const headerPayable = parseFloat(docRows[0].HeaderPayable || 0);
    const sumItemAmt = docRows.reduce((s, r) => s + (r.Amount || 0), 0);
    const opCode = docRows[0].OpCode;

    docRows.forEach(r => {
      const itemAmt = r.Amount || 0;
      const qty = r.Quantity || 0;
      let allocatedAmt = 0;

      if (headerPayable > 0 && sumItemAmt > 0) {
        allocatedAmt = headerPayable * (itemAmt / sumItemAmt);
      } else {
        allocatedAmt = itemAmt;
      }

      if (opCode === '12') {
        totalSalesQty += qty;
        totalSalesAmtNoVAT += itemAmt;
        totalSalesAmtWithVAT += allocatedAmt;
      } else if (opCode === '13') {
        totalRetQty += qty;
        totalRetAmtNoVAT += itemAmt;
        totalRetAmtWithVAT += allocatedAmt;
      }
    });
  });

  console.log("=== 1405 Allocation Results ===");
  console.log("Sales Qty (kg):", totalSalesQty.toFixed(2), " | Target: 437398.63");
  console.log("Sales Amt with VAT:", Math.round(totalSalesAmtWithVAT).toLocaleString(), " | Target: 2,392,474,573,191");
  console.log("Sales Amt without VAT:", Math.round(totalSalesAmtNoVAT).toLocaleString(), " | Target: 2,135,396,849,944");
  console.log("Net Amt with VAT:", Math.round(totalSalesAmtWithVAT - totalRetAmtWithVAT).toLocaleString(), " | Target: 2,384,184,338,936");
}

main().catch(console.error);
