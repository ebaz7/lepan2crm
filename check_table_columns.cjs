const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    const sql = `
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'STR_TBL_008'
    `;

    try {
        const response = await axios.post(url, { query: sql }, { headers });
        console.log("Columns of STR_TBL_008:");
        console.log((response.data.data || []).map(r => r.COLUMN_NAME).join(', '));
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
