const axios = require('axios');
async function run() {
  const query = `
    SELECT t10.Field_009 as OpCode, COUNT(*) as cnt
    FROM STR_TBL_010 t10
    WHERE t10.Field_008 >= '2026-03-21T00:00:00.000Z'
    GROUP BY t10.Field_009
  `;
  const response = await axios.post('http://80.210.31.176:5000/api/external/v1', { query }, {
      headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  console.log(response.data);
}
run();
