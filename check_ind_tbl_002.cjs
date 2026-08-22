const axios = require('axios');
async function run() {
  const query = `
    SELECT TOP 20 * FROM IND_TBL_002
  `;
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log("IND_TBL_002 top 20:", JSON.stringify(res.data.data, null, 2));
  } catch(e) { console.error(e.message); }
}
run();
