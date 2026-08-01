const axios = require('axios');
async function run() {
    const sql = `SELECT TOP 10 * FROM IND_TBL_003`;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log(JSON.stringify(res.data.data, null, 2));
    } catch(e) {
        console.error(e.message);
    }
}
run();
