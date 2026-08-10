const axios = require('axios');
async function run() {
  const query = `
    SELECT 
      t10.Field_001, t10.Field_002, t10.Field_003, t10.Field_004, t10.Field_005, t10.Field_006
    FROM STR_TBL_010 t10
    WHERE t10.Field_001 = '435193'
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
