const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q = "SELECT * FROM ACT_TBL_009 WHERE Field_001 IN ('429648', '401650', '429566')";
    const res = await axios.post(url, { query: q }, { headers });
    console.log(JSON.stringify(res.data.data, null, 2));
  } catch(e) {
    console.error("Error:", e.message);
  }
}

run();
