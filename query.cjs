const axios = require('axios');
async function run() {
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
      query: "SELECT TOP 5 * FROM SAL_TBL_010"
    }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log("SAL_TBL_010:", res.data);
  } catch(e) { console.error(e.message); }
}
run();
