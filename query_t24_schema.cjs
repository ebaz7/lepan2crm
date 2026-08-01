const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = "SELECT TOP 5 * FROM ACT_TBL_024";
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Sample rows of ACT_TBL_024:");
    console.log(res1.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}

run();
