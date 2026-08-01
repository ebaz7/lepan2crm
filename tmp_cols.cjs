const axios = require('axios');
async function run() {
  const t1 = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: "SELECT TOP 1 * FROM ACT_TBL_004" }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } }).catch(e => e);
  console.log("ACT_TBL_004:", t1.data);
  const t2 = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: "SELECT TOP 1 * FROM ACT_TBL_005" }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } }).catch(e => e);
  console.log("ACT_TBL_005:", t2.data);
}
run();
