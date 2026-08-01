const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = "SELECT Field_005 as Code, Field_006 as Name FROM ACT_TBL_003 WHERE Field_006 LIKE N'%تضمین%' OR Field_006 LIKE N'%انتظامی%' OR Field_006 LIKE N'%ضمانت%'";
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("ACT_TBL_003 (Moein) Guarantees/ انتظامی:");
    console.log(res1.data.data);

    // Let's also check for ACT_TBL_007 for person 112447 or 2447
    const q2 = "SELECT * FROM ACT_TBL_007 WHERE Field_003 = '112447' OR Field_003 = '2447' OR Field_005 = '112447' OR Field_005 = '2447' OR Field_006 LIKE N'%حافظ%'";
    const res2 = await axios.post(url, { query: q2 }, { headers });
    console.log("\nACT_TBL_007 Hafez:");
    console.log(res2.data.data);

  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}

run();
