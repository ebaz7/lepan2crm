const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    const tables = ['STR_TBL_002', 'STR_TBL_003', 'STR_TBL_006', 'STR_TBL_007'];
    for (const tbl of tables) {
        try {
            const sql = `SELECT TOP 5 * FROM ${tbl}`;
            const response = await axios.post(url, { query: sql }, { headers });
            console.log(`\n--- Table: ${tbl} ---`);
            console.log(response.data.data);
        } catch (e) {
            console.log(`Table ${tbl} failed: ${e.message}`);
        }
    }
}

run();
