const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    const sql = `
        SELECT RTRIM(LTRIM(Field_003)) as Code, RTRIM(LTRIM(Field_004)) as Name 
        FROM STR_TBL_006 
        ORDER BY CAST(Field_003 as INT)
    `;

    try {
        const response = await axios.post(url, { query: sql }, { headers });
        console.log("ALL SAYAN DOCUMENT TYPES:");
        (response.data.data || []).forEach(r => {
            console.log(`Code: ${r.Code} -> Name: ${r.Name}`);
        });
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
