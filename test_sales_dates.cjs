const axios = require('axios');
async function run() {
    const sql = `
        SELECT Field_009, COUNT(*) as cnt
        FROM STR_TBL_010
        WHERE Field_008 >= '2025-03-21T00:00:00.000Z'
        GROUP BY Field_009
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Types after 2025-03-21:", res.data.data);
    } catch(e) {
        console.error(e);
    }
}
run();
