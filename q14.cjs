const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT COUNT(*) as c FROM ACT_TBL_007 WHERE Field_004 = '11'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Count of Group 11 Tafsilis:", res.data.data);
    } catch(e) { }
}
run();
