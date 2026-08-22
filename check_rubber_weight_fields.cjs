const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    const sql = `
        SELECT TOP 1 * 
        FROM STR_TBL_011 
        WHERE Field_005 LIKE '0104%'
          AND Field_006 > 0
    `;

    try {
        const response = await axios.post(url, { query: sql }, { headers });
        console.log("Sample Rubber Transaction Fields:");
        console.log(response.data.data);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
