const axios = require('axios');
async function run() {
  const query = `
    SELECT TOP 10 Field_008
    FROM STR_TBL_010
    WHERE Field_008 IS NOT NULL
  `;
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log("Date samples from STR_TBL_010:", JSON.stringify(res.data.data, null, 2));
  } catch(e) { console.error(e.message); }
}
run();
