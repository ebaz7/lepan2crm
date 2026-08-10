const axios = require('axios');
async function run() {
  const query = `
    SELECT 
      *
    FROM STR_TBL_011 t11
    WHERE t11.Field_004 IN (SELECT Field_005 FROM STR_TBL_010 WHERE Field_001 = '433091')
      AND t11.Field_003 IN (SELECT Field_004 FROM STR_TBL_010 WHERE Field_001 = '433091')
  `;
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, {
        headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
    });
    console.log(res.data.data.slice(0, 3));
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
run();
