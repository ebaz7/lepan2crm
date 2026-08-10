const axios = require('axios');
async function run() {
  const query = `
    SELECT 
      t10.Field_009 as OpCode,
      t10.Field_010 as DocType,
      t11.Field_006 as Qty,
      t11.Field_007 as Amt,
      t10.Field_029 as Notes
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '2025-03-21T00:00:00.000Z' AND t10.Field_008 <= '2025-04-20T23:59:59.000Z'
      AND t11.Field_005 = '040303030101'
  `;
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, {
        headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
    });
    console.log(res.data.data);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
run();
