const axios = require('axios');
async function q(tbl) {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: `SELECT TOP 2 * FROM ${tbl}` }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log(`\n--- ${tbl} ---`);
        console.log(res.data.data);
    } catch(e) { }
}
async function run() {
    await q('ACT_TBL_014'); // Sanad Header?
    await q('ACT_TBL_015'); // Sanad Items?
    await q('ACT_TBL_001'); // Kol
    await q('ACT_TBL_002'); // Moeen
}
run();
