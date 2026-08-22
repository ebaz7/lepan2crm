const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    const sql = `
        SELECT DISTINCT Field_001, Field_003, Field_004 
        FROM STR_TBL_008
        ORDER BY Field_003
    `;

    try {
        const response = await axios.post(url, { query: sql }, { headers });
        console.log("Document types from STR_TBL_008:");
        (response.data.data || []).forEach(r => {
            console.log(`ID: ${r.Field_001} | Code/Type: ${r.Field_003} | Name: ${r.Field_004}`);
        });
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
