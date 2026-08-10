const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];

  console.log("=== Testing different unit price thresholds for OpCode 12 in 1405 ===");

  for (const minPrice of [1000, 5000, 10000, 20000, 50000, 100000]) {
    const res = await query(`
      SELECT 
        COUNT(DISTINCT t10.Field_001) as DocCount,
        SUM(TRY_CAST(t11.Field_006 AS FLOAT)) as Qty,
        SUM(TRY_CAST(t11.Field_007 AS FLOAT)) as Amt
      FROM STR_TBL_010 t10
      JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
      WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
        AND t10.Field_009 = '12'
        AND TRY_CAST(t11.Field_007 AS FLOAT) / NULLIF(TRY_CAST(t11.Field_006 AS FLOAT), 0) >= ${minPrice}
    `);
    
    console.log(`Min Price >= ${minPrice} Rials/kg -> Qty = ${res[0].Qty}, Amt = ${res[0].Amt}`);
  }

  console.log("\nTarget in doc1.pdf: Sales Qty = 437398.63");
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
