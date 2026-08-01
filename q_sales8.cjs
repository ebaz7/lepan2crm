const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT * FROM TBL_006 WHERE Field_004 LIKE N'%فروش%'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Menus:", res.data.data);
    } catch(e) { }
}
run();
