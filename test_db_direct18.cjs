const axios = require('axios');
async function run() {
  const query = `
    SELECT 
      t10.Field_006 as InvoiceNum,
      t11.Field_005 as ItemCode,
      t11.Field_006 as Qty,
      t11.Field_007 as Amt,
      t10.Field_029 as Notes
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_009 = '12' 
      AND t10.Field_008 >= '2025-03-21T00:00:00.000Z' 
      AND t10.Field_008 <= '2025-08-22T23:59:59.000Z'
      AND t11.Field_006 = 0 AND t11.Field_007 > 0
  `;
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, {
        headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
    });
    console.log(res.data.data.slice(0, 10));
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
run();
