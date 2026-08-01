const axios = require('axios');
async function run() {
    const sql = `
        SELECT TOP 5 *
        FROM STR_TBL_010
        WHERE Field_008 >= '2026-07-19T00:00:00.000Z'
        ORDER BY Field_008 DESC
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        if (res.data.data) {
            console.log("Found keys in STR_TBL_010:");
            res.data.data.forEach((row, idx) => {
                console.log(`\nRow ${idx + 1}:`);
                Object.keys(row).forEach(key => {
                    if (row[key] !== null && row[key] !== '') {
                        console.log(`  ${key}: ${row[key]}`);
                    }
                });
            });
        }
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
