const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

  try {
    console.log("Searching STR_TBL_011 where Field_004 = '2716' (DocNo)...");
    const res1 = await axios.post(url, {
      query: `
        SELECT TOP 20 * 
        FROM STR_TBL_011 
        WHERE Field_004 = '2716'
      `
    }, { headers });
    console.log("Results via Field_004 = '2716':", res1.data.data);

    console.log("Searching STR_TBL_011 where Field_037 = '499035' (Header Field_001)...");
    const res2 = await axios.post(url, {
      query: `
        SELECT TOP 20 * 
        FROM STR_TBL_011 
        WHERE Field_037 = '499035'
      `
    }, { headers });
    console.log("Results via Field_037 = '499035':", res2.data.data);

    console.log("Searching STR_TBL_011 where Field_012 = 1 (Warehouse ID from Header)...");
    const res3 = await axios.post(url, {
      query: `
        SELECT TOP 5 * 
        FROM STR_TBL_011 
        WHERE Field_004 = '2716' AND Field_003 = '4'
      `
    }, { headers });
    console.log("Results via classic match (Field_004='2716' AND Field_003='4'):", res3.data.data);

  } catch(e) {
    console.error("Error executing query:", e.message);
  }
}

run();
