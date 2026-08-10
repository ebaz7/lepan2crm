const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];

  console.log("=== Testing count of raw STR_TBL_011 without JOINs ===");

  const rawCount = await query(`
    SELECT 
      SUM(CASE WHEN t10.Field_009 = '12' THEN TRY_CAST(t11.Field_006 AS FLOAT) ELSE 0 END) as RawQty12,
      SUM(CASE WHEN t10.Field_009 = '12' THEN TRY_CAST(t11.Field_007 AS FLOAT) ELSE 0 END) as RawAmt12,
      SUM(CASE WHEN t10.Field_009 = '13' THEN TRY_CAST(t11.Field_006 AS FLOAT) ELSE 0 END) as RawQty13,
      SUM(CASE WHEN t10.Field_009 = '13' THEN TRY_CAST(t11.Field_007 AS FLOAT) ELSE 0 END) as RawAmt13
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND TRY_CAST(t11.Field_007 AS FLOAT) > TRY_CAST(t11.Field_006 AS FLOAT) * 1000
  `);

  console.log("Raw STR_TBL_011 (NO JOINs):");
  console.log(rawCount[0]);
  console.log("Target in doc1.pdf: Qty12=437398.63, Amt12=2392474573191, Qty13=1250.71, Amt13=7706062812 (net 8290234255 with VAT)");
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
