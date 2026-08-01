const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q = "SELECT TOP 10 * FROM ACT_TBL_007 WHERE Field_003 LIKE '%31%' OR Field_004 LIKE '%31%' OR Field_005 LIKE '%31%'";
    const res = await axios.post(url, { query: q }, { headers });
    console.log("ACT_TBL_007 matching '%31%':");
    console.log(res.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}

run();
