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

  console.log("=== Testing Sayan Report Queries with TRY_CAST ===");

  const test1405 = await query(`
    SELECT 
      SUM(CASE WHEN t10.Field_009 = '12' THEN TRY_CAST(t11.Field_006 AS FLOAT) WHEN t10.Field_009 = '13' THEN -TRY_CAST(t11.Field_006 AS FLOAT) ELSE 0 END) as NetQty,
      SUM(CASE WHEN t10.Field_009 = '12' THEN TRY_CAST(t11.Field_010 AS FLOAT) WHEN t10.Field_009 = '13' THEN -TRY_CAST(t11.Field_010 AS FLOAT) ELSE 0 END) as NetVAT,
      SUM(CASE WHEN t10.Field_009 = '12' THEN TRY_CAST(t11.Field_007 AS FLOAT) WHEN t10.Field_009 = '13' THEN -TRY_CAST(t11.Field_007 AS FLOAT) ELSE 0 END) as NetAmt,
      SUM(CASE WHEN t10.Field_009 = '12' THEN TRY_CAST(COALESCE(NULLIF(t11.Field_012, '0'), TRY_CAST(t11.Field_007 AS FLOAT) + COALESCE(TRY_CAST(t11.Field_010 AS FLOAT), 0)) AS FLOAT)
               WHEN t10.Field_009 = '13' THEN -TRY_CAST(COALESCE(NULLIF(t11.Field_012, '0'), TRY_CAST(t11.Field_007 AS FLOAT) + COALESCE(TRY_CAST(t11.Field_010 AS FLOAT), 0)) AS FLOAT)
               ELSE 0 END) as NetAmtWithVAT
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND t10.Field_009 IN ('12', '13')
      AND TRY_CAST(t11.Field_007 AS FLOAT) > TRY_CAST(t11.Field_006 AS FLOAT) * 1000
  `);

  console.log("1405 Result:");
  console.log(test1405[0]);
  console.log("Target 1405 doc1.pdf: NetQty = 436147.92, NetVAT = 257,661,894,690, NetAmtWithVAT = 2,384,184,338,936");

  const test1404 = await query(`
    SELECT 
      SUM(CASE WHEN t10.Field_009 = '12' THEN TRY_CAST(t11.Field_006 AS FLOAT) WHEN t10.Field_009 = '13' THEN -TRY_CAST(t11.Field_006 AS FLOAT) ELSE 0 END) as NetQty,
      SUM(CASE WHEN t10.Field_009 = '12' THEN TRY_CAST(t11.Field_010 AS FLOAT) WHEN t10.Field_009 = '13' THEN -TRY_CAST(t11.Field_010 AS FLOAT) ELSE 0 END) as NetVAT,
      SUM(CASE WHEN t10.Field_009 = '12' THEN TRY_CAST(t11.Field_007 AS FLOAT) WHEN t10.Field_009 = '13' THEN -TRY_CAST(t11.Field_007 AS FLOAT) ELSE 0 END) as NetAmt,
      SUM(CASE WHEN t10.Field_009 = '12' THEN TRY_CAST(COALESCE(NULLIF(t11.Field_012, '0'), TRY_CAST(t11.Field_007 AS FLOAT) + COALESCE(TRY_CAST(t11.Field_010 AS FLOAT), 0)) AS FLOAT)
               WHEN t10.Field_009 = '13' THEN -TRY_CAST(COALESCE(NULLIF(t11.Field_012, '0'), TRY_CAST(t11.Field_007 AS FLOAT) + COALESCE(TRY_CAST(t11.Field_010 AS FLOAT), 0)) AS FLOAT)
               ELSE 0 END) as NetAmtWithVAT
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${d1404[0]}' AND t10.Field_008 <= '${d1404[1]}'
      AND t10.Field_009 IN ('12', '13')
      AND TRY_CAST(t11.Field_007 AS FLOAT) > TRY_CAST(t11.Field_006 AS FLOAT) * 1000
  `);

  console.log("1404 Result:");
  console.log(test1404[0]);
  console.log("Target 1404 doc2.pdf: NetQty = 621014.68, NetAmtWithVAT = 31,259,201,479,120");
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
