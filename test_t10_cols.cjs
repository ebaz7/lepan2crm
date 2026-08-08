const axios = require('axios');

async function run() {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
        query: `SELECT TOP 2 * FROM STR_TBL_010`
    }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
    console.log("STR_TBL_010 sample:", res.data.data[0]);
}
run();
