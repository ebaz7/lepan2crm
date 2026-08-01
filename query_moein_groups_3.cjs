const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q = "SELECT DISTINCT Field_004 as MoeinGroup, COUNT(*) as count FROM ACT_TBL_007 WHERE Field_004 LIKE '3%' GROUP BY Field_004";
    const res = await axios.post(url, { query: q }, { headers });
    console.log("Moein Groups starting with 3 in ACT_TBL_007:");
    console.log(res.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}

run();
