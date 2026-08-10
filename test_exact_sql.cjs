const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function testQuery(label, whereClause, dateRange1405) {
  const sql = `
    SELECT 
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_006 ELSE 0 END) as Qty12,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_007 ELSE 0 END) as Amt12,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_012 ELSE 0 END) as FinalAmt12,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_006 ELSE 0 END) as Qty13,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_007 ELSE 0 END) as Amt13,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_012 ELSE 0 END) as FinalAmt13
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${dateRange1405[0]}' AND t10.Field_008 <= '${dateRange1405[1]}'
      AND ${whereClause}
  `;
  const res = await query(sql);
  console.log(`\n=== ${label} ===`);
  console.log("Result:", res[0]);
  console.log("Target 1405: Qty12=437398.63, Amt12=2392474573191, Qty13=1250.71, Amt13=8290234255");
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z']; // 1405/01/01 to 1405/05/17
  
  // Test 1: t10.Field_009 IN ('12', '13')
  await testQuery("Test 1: OpCodes 12 & 13 plain", "t10.Field_009 IN ('12', '13')", d1405);
  
  // Test 2: t11.Field_036 = t10.Field_009
  await testQuery("Test 2: t11.Field_036 = t10.Field_009", "t10.Field_009 IN ('12', '13') AND t11.Field_036 = t10.Field_009", d1405);

  // Test 3: t11.Field_036 IN ('12', '13')
  await testQuery("Test 3: t11.Field_036 IN ('12', '13')", "t10.Field_009 IN ('12', '13') AND t11.Field_036 IN ('12', '13')", d1405);

  // Test 4: t10.Field_009 IN ('3', '12', '23') -- wait!
  await testQuery("Test 4: OpCodes 3, 12, 23 with t11.Field_036 = t10.Field_009", "t10.Field_009 IN ('3', '12', '23', '13') AND t11.Field_036 = t10.Field_009", d1405);
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
