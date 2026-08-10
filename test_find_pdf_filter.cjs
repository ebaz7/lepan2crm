const fs = require('fs');
const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];

  // Let's get every item in STR_TBL_011 for 1405 date range where t10.Field_009 = '12' or '13'
  const items = await query(`
    SELECT 
      t11.Field_005 as ItemCode,
      COALESCE(t22.Field_004, t02.Field_003, t11.Field_005) as ItemName,
      t21.Field_003 as GroupId,
      t02.Field_003 as GroupName,
      t02_parent.Field_003 as ParentGroupName,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_006 ELSE 0 END) as Qty12,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_007 ELSE 0 END) as Amt12,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_006 ELSE 0 END) as Qty13,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_007 ELSE 0 END) as Amt13
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_021 t21 ON RTRIM(LTRIM(t21.Field_004)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_002 t02 ON t02.Field_008 = t21.Field_003
    LEFT JOIN IND_TBL_002 t02_parent ON t02.Field_009 = t02_parent.Field_008
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND t10.Field_009 IN ('12', '13')
    GROUP BY t11.Field_005, COALESCE(t22.Field_004, t02.Field_003, t11.Field_005), t21.Field_003, t02.Field_003, t02_parent.Field_003
  `);

  console.log("Total unique item codes in DB for Op 12/13 in 1405:", items.length);

  // Let's filter items where Amt12 > 0 or Amt13 > 0, or check which condition matches doc1.pdf
  // Notice in doc1.pdf, Amt12 values are always present when listed!
  // What if we filter by: Amt12 > 0 OR Amt13 > 0? Or what if t11.Field_007 is NOT NULL / > 0?
  // Let's test different filters on these items:

  const f1 = items.filter(i => (i.Amt12 > 0 || i.Amt13 > 0));
  let q12_f1 = f1.reduce((s, i) => s + i.Qty12, 0);
  let a12_f1 = f1.reduce((s, i) => s + i.Amt12, 0);
  let q13_f1 = f1.reduce((s, i) => s + i.Qty13, 0);
  let a13_f1 = f1.reduce((s, i) => s + i.Amt13, 0);
  console.log("Filter 1 (Amt12 > 0 OR Amt13 > 0):");
  console.log(`Qty12=${q12_f1}, Amt12=${a12_f1}, Qty13=${q13_f1}, Amt13=${a13_f1}`);

  // What if we filter by t11.Field_007 > 0 at line level?
  const f2 = await query(`
    SELECT 
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_006 ELSE 0 END) as Qty12,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_007 ELSE 0 END) as Amt12,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_006 ELSE 0 END) as Qty13,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_007 ELSE 0 END) as Amt13
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND t10.Field_009 IN ('12', '13')
      AND t11.Field_007 IS NOT NULL AND t11.Field_007 > 0
  `);
  console.log("Filter 2 (Line-level t11.Field_007 > 0):");
  console.log(f2[0]);

  // What if we filter by t10.Field_009 = '12' AND t11.Field_036 = '12' and t11.Field_007 > 0?
  const f3 = await query(`
    SELECT 
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_006 ELSE 0 END) as Qty12,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_007 ELSE 0 END) as Amt12,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_006 ELSE 0 END) as Qty13,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_007 ELSE 0 END) as Amt13
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND t10.Field_009 IN ('12', '13')
      AND t11.Field_036 IN ('12', '13')
      AND t11.Field_007 IS NOT NULL AND t11.Field_007 > 0
  `);
  console.log("Filter 3 (Line-level t11.Field_036 IN (12,13) AND t11.Field_007 > 0):");
  console.log(f3[0]);
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
