const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = "SELECT COUNT(*) as count FROM ACT_TBL_007 WHERE Field_004 = '11'";
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Field_004 = '11' count:", res1.data.data);

    const q2 = "SELECT COUNT(*) as count FROM ACT_TBL_007 WHERE Field_004 = '31'";
    const res2 = await axios.post(url, { query: q2 }, { headers });
    console.log("Field_004 = '31' count:", res2.data.data);
    
    // Let's also check if there is any other code like '11%' or '31%' in Field_004
    const q3 = "SELECT COUNT(*) as count FROM ACT_TBL_007 WHERE Field_004 LIKE '11%'";
    const res3 = await axios.post(url, { query: q3 }, { headers });
    console.log("Field_004 LIKE '11%' count:", res3.data.data);

    const q4 = "SELECT COUNT(*) as count FROM ACT_TBL_007 WHERE Field_004 LIKE '31%'";
    const res4 = await axios.post(url, { query: q4 }, { headers });
    console.log("Field_004 LIKE '31%' count:", res4.data.data);

  } catch(e) {
    console.error("Error:", e.message);
  }
}

run();
