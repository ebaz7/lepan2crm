const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = "SELECT TOP 10 Field_003 as Code, Field_004 as MoeinGroup, Field_005 as TafsiliCode, Field_006 as Name FROM ACT_TBL_007 WHERE Field_004 = '31' OR Field_003 LIKE '31%'";
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Tafsilis under Code 31:");
    console.log(res1.data.data);

    // Let's count them
    const q2 = "SELECT COUNT(*) as total FROM ACT_TBL_007 WHERE Field_004 = '31' OR Field_003 LIKE '31%'";
    const res2 = await axios.post(url, { query: q2 }, { headers });
    console.log("Total Count of Code 31 Tafsilis:", res2.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}

run();
