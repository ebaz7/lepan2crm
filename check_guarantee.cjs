const axios = require('axios');
async function run() {
  const t = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: "SELECT Field_005, Field_006 FROM ACT_TBL_003 WHERE Field_006 LIKE N'%تضمین%'" }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } }).catch(e => e);
  console.log("Guarantee Moeen Codes:", t.data.data);
}
run();
