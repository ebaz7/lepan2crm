const axios = require('axios');
async function run() {
    const codes = ['01011001', '02031001', '02041001', '010302011002'];
    const queries = [
        `SELECT * FROM IND_TBL_022 WHERE Field_005 IN ('01011001', '02031001', '02041001', '010302011002') OR Field_003 IN ('01011001', '02031001', '02041001', '010302011002')`,
        `SELECT * FROM IND_TBL_021 WHERE Field_004 IN ('01011001', '02031001', '02041001', '010302011002')`
    ];
    for (let i = 0; i < queries.length; i++) {
        try {
            const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
                query: queries[i]
            }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
            console.log(`Query ${i + 1} Results:`, JSON.stringify(res.data.data, null, 2));
        } catch(e) {
            console.error(`Query ${i + 1} Error:`, e.message);
        }
    }
}
run();
