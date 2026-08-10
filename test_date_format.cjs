const axios = require('axios');
async function run() {
  const query = `
    SELECT TOP 5 t10.Field_008, t10.Field_001
    FROM STR_TBL_010 t10
    ORDER BY t10.Field_001 DESC
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
