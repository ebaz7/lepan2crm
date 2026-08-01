const axios = require('axios');
async function run() {
  const t = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: "SELECT TOP 1 * FROM ACT_TBL_009" }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } }).catch(e => e);
  console.log("ACT_TBL_009:", t.data);
  const t24 = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: "SELECT TOP 1 * FROM ACT_TBL_024" }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } }).catch(e => e);
  console.log("ACT_TBL_024:", t24.data);
}
run();
