const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = "SELECT COUNT(*) as count FROM ACT_TBL_009 WHERE Field_015 LIKE '31:%' OR Field_015 LIKE '%-31:%' OR Field_014 LIKE '31:%' OR Field_014 LIKE '%-31:%'";
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Count of transactions with 31: in Tafsili fields in ACT_TBL_009:", res1.data.data);

    // Let's also check if there are any other codes starting with 31 in Field_007 (MoeinCode)
    const q2 = "SELECT COUNT(*) as count FROM ACT_TBL_009 WHERE Field_007 LIKE '31%'";
    const res2 = await axios.post(url, { query: q2 }, { headers });
    console.log("Count of transactions with Field_007 LIKE '31%' in ACT_TBL_009:", res2.data.data);

    // Let's see some samples of 31 transactions if any
    if (res1.data.data[0].count > 0) {
      const q3 = "SELECT TOP 5 * FROM ACT_TBL_009 WHERE Field_015 LIKE '31:%' OR Field_015 LIKE '%-31:%' OR Field_014 LIKE '31:%' OR Field_014 LIKE '%-31:%'";
      const res3 = await axios.post(url, { query: q3 }, { headers });
      console.log("Sample 31: transactions in ACT_TBL_009:");
      console.log(res3.data.data);
    }

  } catch(e) {
    console.error("Error:", e.message);
  }
}

run();
