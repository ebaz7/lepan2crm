const axios = require('axios');
async function run() {
  const query = `
    SELECT 
      Field_009 as OpCode, COUNT(*) as Count
    FROM STR_TBL_010
    WHERE Field_008 >= '2025-03-21T00:00:00.000Z' AND Field_008 <= '2025-08-22T23:59:59.000Z'
    GROUP BY Field_009
  `;
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, {
        headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
    });
    console.log(res.data.data);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
run();
