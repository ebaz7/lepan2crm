const axios = require('axios');
async function run() {
  const query = `
    SELECT TOP 5 Field_001, Field_008, Field_009
    FROM STR_TBL_010
    WHERE Field_008 >= '2026-01-01T00:00:00.000Z'
    ORDER BY Field_008 DESC
  `;
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log("2026 rows:", JSON.stringify(res.data.data, null, 2));
  } catch(e) { console.error(e.message); }
}
run();
