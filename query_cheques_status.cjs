const axios = require('axios');

async function run() {
  try {
    const sayanUrl = 'http://80.210.31.176:5000/api/external/v1/query';
    const sayanKey = 's_gate_live_vgr182bwtpoa';

    // Get unique status values
    const queryStr = `
        SELECT DISTINCT 
            t12.Field_015 as StatusDesc,
            t12.Field_016 as StatusCode
        FROM BUR_TBL_012 t12
    `;

    console.log("Querying unique status values...");
    const res = await axios.post(sayanUrl, { query: queryStr }, {
      headers: { 'Authorization': `Bearer ${sayanKey}` }
    });

    console.log("Status distribution:");
    console.log(res.data.data);

  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
}

run();
