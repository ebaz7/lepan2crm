const axios = require('axios');
async function run() {
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
      query: "SELECT * FROM ACT_TBL_003 WHERE Field_006 LIKE N'%تضمین%'"
    }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log("Found ACT_TBL_003:", res.data);
  } catch(e) { console.error("Err ACT_TBL_003", e.response?.data || e.message); }
}
run();
