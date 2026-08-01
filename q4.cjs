const axios = require('axios');
async function q(tbl) {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: `SELECT TOP 2 * FROM ${tbl}` }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log(`\n--- ${tbl} ---`);
        console.log(res.data.data);
    } catch(e) { }
}
async function run() {
    await q('ACT_TBL_010');
    await q('ACT_TBL_011');
    await q('GNR_TBL_010'); // Tafsili groups?
    await q('GNR_TBL_011'); // actual tafsilis? wait GNR_TBL_011 didn't exist in q3 list, let's query GNR_TBL_012, 014
    await q('GNR_TBL_012');
}
run();
