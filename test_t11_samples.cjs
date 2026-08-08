const axios = require('axios');

async function run() {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
        query: `SELECT TOP 5 Field_001, Field_005, Field_006, Field_007, Field_031 FROM STR_TBL_011`
    }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
    console.log("STR_TBL_011 samples:", res.data.data);
}
run();
