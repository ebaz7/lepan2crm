const axios = require('axios');
async function run() {
  try {
    const q1 = "SELECT COUNT(*) as c FROM STR_TBL_011";
    const q2 = "SELECT COUNT(*) as c FROM STR_TBL_010";
    const r1 = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: q1 }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    const r2 = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: q2 }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log("STR_TBL_011 count:", r1.data.data);
    console.log("STR_TBL_010 count:", r2.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
