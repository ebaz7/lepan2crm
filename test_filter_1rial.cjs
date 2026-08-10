const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];

  console.log("=== Testing filtering out 1-Rial / dummy lines in 1405 ===");

  const res = await query(`
    SELECT 
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_006 ELSE 0 END) as Qty12,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_007 ELSE 0 END) as Amt12,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_006 ELSE 0 END) as Qty13,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_007 ELSE 0 END) as Amt13
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND (
        (t10.Field_009 = '12' AND t11.Field_007 > t11.Field_006 * 1000)
        OR
        (t10.Field_009 = '13' AND t11.Field_007 > t11.Field_006 * 1000)
      )
  `);

  console.log("Filtered result (t11.Field_007 > t11.Field_006 * 1000):", res[0]);
  console.log("Target in doc1.pdf: Qty12=437398.63, Qty13=1250.71, NetQty=436147.92");
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
