const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    const sql = `SELECT name FROM sys.tables ORDER BY name`;

    try {
        const response = await axios.post(url, { query: sql }, { headers });
        console.log("Sayan database tables:");
        const tables = (response.data.data || []).map(r => r.name);
        console.log(tables.join(', '));
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
