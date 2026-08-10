const axios = require('axios');
async function run() {
  const query = `
    SELECT *
    FROM STR_TBL_011 t11
    WHERE t11.Field_004 = '128' AND t11.Field_003 = '3'
      AND (t11.Field_006 = 457 OR t11.Field_006 = 493)
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
