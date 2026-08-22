const axios = require('axios');
async function run() {
  const tables = [
    'IND_TBL_001', 'IND_TBL_002', 'IND_TBL_003', 'IND_TBL_004', 'IND_TBL_005',
    'COM_TBL_001', 'COM_TBL_002', 'COM_TBL_003', 'COM_TBL_008', 'COM_TBL_009',
    'STR_TBL_001', 'STR_TBL_002', 'STR_TBL_003', 'STR_TBL_004'
  ];
  for (const table of tables) {
    try {
      const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
        query: `
          SELECT TOP 5 * FROM ${table} WHERE 
            CAST(Field_002 AS NVARCHAR(MAX)) LIKE N'%کش%' OR 
            CAST(Field_003 AS NVARCHAR(MAX)) LIKE N'%کش%' OR 
            CAST(Field_004 AS NVARCHAR(MAX)) LIKE N'%کش%'
        `
      }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
      if (res.data.data && res.data.data.length > 0) {
        console.log(`Found in table ${table}:`, JSON.stringify(res.data.data, null, 2));
      }
    } catch(e) {
      // Ignored for table schema differences
    }
  }
}
run();
