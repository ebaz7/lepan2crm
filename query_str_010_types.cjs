const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT Field_009, COUNT(*) as cnt FROM STR_TBL_010 GROUP BY Field_009`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Types:", res.data.data);
    } catch(e) { console.error(e.response ? e.response.data : e.message); }
}
run();
