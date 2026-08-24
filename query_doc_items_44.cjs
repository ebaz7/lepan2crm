const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

  try {
    for (const docNo of ['2716', '2730']) {
      console.log(`\n===================================`);
      console.log(`Fetching detail lines for DocNo '${docNo}' (Year 1405, SubCode '4')...`);
      const res = await axios.post(url, {
        query: `
          SELECT 
            t11.Field_001 as LineId,
            t11.Field_003 as SubCode,
            t11.Field_004 as DocNo,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            COALESCE(
              NULLIF(RTRIM(LTRIM(s04.Field_003)), ''),
              NULLIF(RTRIM(LTRIM(t22.Field_004)), ''),
              NULLIF(RTRIM(LTRIM(t02_exact.Field_003)), ''),
              RTRIM(LTRIM(t11.Field_005))
            ) as ItemName
          FROM STR_TBL_011 t11
          LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
          LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
          LEFT JOIN IND_TBL_002 t02_exact ON RTRIM(LTRIM(t02_exact.Field_008)) = RTRIM(LTRIM(t11.Field_005))
          WHERE t11.Field_004 = '${docNo}' AND t11.Field_003 = '4'
        `
      }, { headers });
      
      const rows = res.data.data || [];
      console.log(`Found ${rows.length} rows.`);
      
      const itemGroups = {};
      rows.forEach(r => {
        const key = `${r.ItemCode} - ${r.ItemName}`;
        itemGroups[key] = (itemGroups[key] || 0) + parseFloat(r.Quantity || 0);
      });
      
      console.log(`Summary of items in DocNo ${docNo}:`);
      Object.entries(itemGroups).forEach(([item, qty]) => {
        console.log(`  Item: ${item} | Qty: ${qty}`);
      });
    }

  } catch(e) {
    console.error("Error:", e.message);
  }
}

run();
