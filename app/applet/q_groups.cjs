const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT * FROM ACT_TBL_007 WHERE Field_004 = '11'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Groups:", res.data.data.filter(r => r.Field_008 === false));
    } catch(e) { console.error(e.response?.data || e.message); }
}
run();
