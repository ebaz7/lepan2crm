const axios = require('axios');
async function run() {
    try {
        const types = ['68', '65', '80', '79', '28', '37', '23', '46'];
        for (const t of types) {
            const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
                query: `SELECT TOP 1 Field_001, Field_009, Field_029, Field_010, Field_008 FROM STR_TBL_010 WHERE Field_009 = '${t}'`
            }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
            console.log(`Type ${t}:`, res.data.data);
        }
    } catch(e) { console.error(e.response ? e.response.data : e.message); }
}
run();
