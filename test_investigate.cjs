const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  console.log("--- OpCodes in date range 1405 (2026-03-21 to 2026-08-08) ---");
  const opcodes = await query(`
    SELECT t10.Field_009 as OpCode, COUNT(*) as Cnt, SUM(t11.Field_006) as TotalQty, SUM(t11.Field_007) as TotalAmt
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '2026-03-21T00:00:00.000Z' AND t10.Field_008 <= '2026-08-08T23:59:59.000Z'
    GROUP BY t10.Field_009
  `);
  console.log(opcodes);
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
