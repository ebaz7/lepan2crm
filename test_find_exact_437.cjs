const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  // Let's test different filters on STR_TBL_010 / STR_TBL_011 for date range 1405/01/01 to 1405/05/17
  // Notice in doc1.pdf, there are items listed like "FDY 50/24", "POY 160/48 سفید", etc.
  // Let's sum Qty and Amt for ALL items where (t10.Field_009 = '12') and see if any condition matches 437,398.63 or similar!

  console.log("--- Testing sum of items under various filters ---");

  // Let's check item-level sums in 1405
  const sql = `
    SELECT 
      COALESCE(t22.Field_004, t02.Field_003, t11.Field_005) as ItemName,
      t21.Field_003 as GroupId,
      t02_parent.Field_003 as ParentGroupName,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_006 ELSE 0 END) as RawQty12,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_007 ELSE 0 END) as RawAmt12,
      SUM(CASE WHEN t10.Field_009 = '12' AND t11.Field_007 > 0 THEN t11.Field_006 ELSE 0 END) as PosAmtQty12,
      SUM(CASE WHEN t10.Field_009 = '12' AND t11.Field_007 > 0 THEN t11.Field_007 ELSE 0 END) as PosAmtAmt12,
      SUM(CASE WHEN t10.Field_009 = '12' AND t11.Field_007 > t11.Field_006 * 1000 THEN t11.Field_006 ELSE 0 END) as UnitPriceQty12,
      SUM(CASE WHEN t10.Field_009 = '12' AND t11.Field_007 > t11.Field_006 * 1000 THEN t11.Field_007 ELSE 0 END) as UnitPriceAmt12
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_021 t21 ON RTRIM(LTRIM(t21.Field_004)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_002 t02 ON t02.Field_008 = t21.Field_003
    LEFT JOIN IND_TBL_002 t02_parent ON t02.Field_009 = t02_parent.Field_008
    WHERE t10.Field_008 >= '2026-03-21T00:00:00.000Z' AND t10.Field_008 <= '2026-08-08T23:59:59.000Z'
    GROUP BY COALESCE(t22.Field_004, t02.Field_003, t11.Field_005), t21.Field_003, t02_parent.Field_003
  `;

  const rows = await query(sql);
  
  let sumRawQty = 0, sumRawAmt = 0;
  let sumPosQty = 0, sumPosAmt = 0;
  let sumUnitQty = 0, sumUnitAmt = 0;

  rows.forEach(r => {
    sumRawQty += parseFloat(r.RawQty12 || 0);
    sumRawAmt += parseFloat(r.RawAmt12 || 0);
    sumPosQty += parseFloat(r.PosAmtQty12 || 0);
    sumPosAmt += parseFloat(r.PosAmtAmt12 || 0);
    sumUnitQty += parseFloat(r.UnitPriceQty12 || 0);
    sumUnitAmt += parseFloat(r.UnitPriceAmt12 || 0);
  });

  console.log("Raw sums (OpCode 12): Qty =", sumRawQty, "Amt =", sumRawAmt);
  console.log("PosAmt sums (OpCode 12, Amt>0): Qty =", sumPosQty, "Amt =", sumPosAmt);
  console.log("UnitPrice sums (OpCode 12, Amt > Qty*1000): Qty =", sumUnitQty, "Amt =", sumUnitAmt);
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
