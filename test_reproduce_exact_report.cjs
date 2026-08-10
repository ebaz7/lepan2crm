const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];
  const d1404 = ['2025-03-21T00:00:00.000Z', '2025-08-08T23:59:59.000Z'];

  console.log("=== Testing Sayan Report Queries for 1405 and 1404 ===");

  // In Sayan ERP, how does Hooshkar build "فروش روزانه کالاها / فروش کلی"?
  // Let's check all rows in STR_TBL_010 and STR_TBL_011 for 1405:
  // Is there a filter on store (t10.Field_004 = '4' or similar)?
  // Or is there a filter on t11.Field_036 = t10.Field_009?
  // Or is there a filter on t11.Field_007 / t11.Field_006?
  // Or is there a filter on t10.Field_024 / t10.Field_012 / t10.Field_013 / t10.Field_014?

  // Let's test different combinations for 1405:
  const test1 = await query(`
    SELECT 
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_006 WHEN t10.Field_009 = '13' THEN -t11.Field_006 ELSE 0 END) as NetQty,
      SUM(CASE WHEN t10.Field_009 = '12' THEN COALESCE(t11.Field_010, 0) WHEN t10.Field_009 = '13' THEN -COALESCE(t11.Field_010, 0) ELSE 0 END) as NetVAT,
      SUM(CASE WHEN t10.Field_009 = '12' THEN COALESCE(NULLIF(t11.Field_012, 0), t11.Field_007 + COALESCE(t11.Field_010, 0), t11.Field_007)
               WHEN t10.Field_009 = '13' THEN -COALESCE(NULLIF(t11.Field_012, 0), t11.Field_007 + COALESCE(t11.Field_010, 0), t11.Field_007)
               ELSE 0 END) as NetAmtWithVAT,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_007 WHEN t10.Field_009 = '13' THEN -t11.Field_007 ELSE 0 END) as NetAmtWithoutVAT
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND t10.Field_009 IN ('12', '13')
      AND t11.Field_007 > t11.Field_006 * 1000
  `);

  console.log("1405 Result (with t11.Field_007 > t11.Field_006 * 1000):");
  console.log(test1[0]);
  console.log("Target 1405 doc1.pdf: NetQty = 436147.92, NetVAT = 257,661,894,690, NetAmtWithVAT = 2,384,184,338,936");

  // Let's test 1404 with the same filter:
  const test1_1404 = await query(`
    SELECT 
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_006 WHEN t10.Field_009 = '13' THEN -t11.Field_006 ELSE 0 END) as NetQty,
      SUM(CASE WHEN t10.Field_009 = '12' THEN COALESCE(t11.Field_010, 0) WHEN t10.Field_009 = '13' THEN -COALESCE(t11.Field_010, 0) ELSE 0 END) as NetVAT,
      SUM(CASE WHEN t10.Field_009 = '12' THEN COALESCE(NULLIF(t11.Field_012, 0), t11.Field_007 + COALESCE(t11.Field_010, 0), t11.Field_007)
               WHEN t10.Field_009 = '13' THEN -COALESCE(NULLIF(t11.Field_012, 0), t11.Field_007 + COALESCE(t11.Field_010, 0), t11.Field_007)
               ELSE 0 END) as NetAmtWithVAT,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_007 WHEN t10.Field_009 = '13' THEN -t11.Field_007 ELSE 0 END) as NetAmtWithoutVAT
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${d1404[0]}' AND t10.Field_008 <= '${d1404[1]}'
      AND t10.Field_009 IN ('12', '13')
      AND t11.Field_007 > t11.Field_006 * 1000
  `);

  console.log("1404 Result (with t11.Field_007 > t11.Field_006 * 1000):");
  console.log(test1_1404[0]);
  console.log("Target 1404 doc2.pdf: NetQty = 621014.68, NetAmtWithVAT = 31,259,201,479,120");
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
