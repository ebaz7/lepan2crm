const axios = require('axios');
async function q(tbl) {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: `SELECT TOP 2 * FROM ${tbl}` }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log(`\n--- ${tbl} ---`);
        console.log(res.data.data);
    } catch(e) { }
}
async function run() {
    await q('ACT_TBL_019'); 
    await q('ACT_TBL_020'); 
    await q('ACT_TBL_021'); 
    await q('ACT_TBL_022');
    await q('GNR_TBL_014');
}
run();
