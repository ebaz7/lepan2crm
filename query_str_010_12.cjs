const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 2 * FROM STR_TBL_010 WHERE Field_009 = '12'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Docs with 12:", res.data.data);
    } catch(e) { console.error(e.response ? e.response.data : e.message); }
}
run();
