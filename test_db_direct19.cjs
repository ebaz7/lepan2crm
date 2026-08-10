const axios = require('axios');
async function run() {
  const query = `
    SELECT 
      t10.Field_001 as DocId, t10.Field_006 as InvoiceNum, t11.Field_005 as ItemCode, t11.Field_006 as Qty, t11.Field_007 as Amt
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_009 = '12' AND t11.Field_006 <> (
      SELECT MAX(t11_sub.Field_006) 
      FROM STR_TBL_010 t10_sub
      JOIN STR_TBL_011 t11_sub ON t11_sub.Field_004 = t10_sub.Field_005 AND t11_sub.Field_003 = t10_sub.Field_004
      WHERE t11_sub.Field_007 = t11.Field_007 AND t10_sub.Field_009 IN ('23', '26', '74')
    )
  `;
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, {
        headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
    });
    console.log(res.data.data ? res.data.data.slice(0, 5) : res.data);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
run();
