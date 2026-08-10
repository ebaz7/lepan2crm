const axios = require('axios');
async function run() {
  const query = `
    SELECT 
      MIN(t11.Field_006) as MinQty, MIN(t11.Field_007) as MinAmt,
      COUNT(*) as Cnt
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_009 = '13' AND t11.Field_007 <= t11.Field_006 * 10
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
