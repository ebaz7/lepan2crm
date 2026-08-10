const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];
  
  // Let's inspect all opcodes in 1405 and sum t11.Field_006 and t11.Field_007 for each opcode,
  // and also check t11.Field_036 values!
  const opcodes = await query(`
    SELECT 
      t10.Field_009 as HeaderOp,
      t11.Field_036 as LineOp,
      COUNT(*) as Cnt,
      SUM(t11.Field_006) as TotalQty,
      SUM(t11.Field_007) as TotalAmt
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
    GROUP BY t10.Field_009, t11.Field_036
  `);
  
  console.log("All (HeaderOp, LineOp) combinations in 1405:");
  opcodes.forEach(r => {
    if (r.TotalQty > 1000 || r.TotalAmt > 1000000) {
      console.log(`HeaderOp=${r.HeaderOp}, LineOp=${r.LineOp}: Cnt=${r.Cnt}, Qty=${r.TotalQty}, Amt=${r.TotalAmt}`);
    }
  });
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
