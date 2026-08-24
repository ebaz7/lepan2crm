const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

  try {
    const code = '010301011001';
    console.log(`Searching for Name of code '${code}' via IND_TBL_021 and IND_TBL_002...`);

    const r = await axios.post(url, {
      query: `
        SELECT t21.Field_004 as ItemCode, t02.Field_003 as ItemName, t02.Field_008 as ProdCode
        FROM IND_TBL_021 t21
        LEFT JOIN IND_TBL_002 t02 ON RTRIM(LTRIM(t21.Field_003)) = RTRIM(LTRIM(t02.Field_008))
        WHERE RTRIM(LTRIM(t21.Field_004)) = '${code}'
      `
    }, { headers });
    console.log("Results:", r.data.data);

  } catch(e) {
    console.error("Error:", e.message);
  }
}

run();
