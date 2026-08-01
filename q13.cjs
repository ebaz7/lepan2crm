const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT * FROM ACT_TBL_007 WHERE Field_003 = '111883' OR Field_001 = '111883' OR Field_005 = '111883'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("ACT_TBL_007 matches:", res.data.data);
    } catch(e) { }
}
run();
