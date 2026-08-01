const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT * FROM STR_TBL_011 WHERE Field_004 = '35894' OR Field_004 = '35736'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Items for docs:", res.data.data);
    } catch(e) { }
}
run();
