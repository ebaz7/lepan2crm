const axios = require('axios');
async function run() {
  const query = `
    SELECT 
      t21.Field_004 as ItemCode,
      t02.Field_003 as ItemName
    FROM IND_TBL_021 t21
    JOIN IND_TBL_002 t02 ON t21.Field_003 = t02.Field_008
    WHERE t21.Field_004 = '010202011001'
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
