const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

  try {
    console.log("Fetching all detail lines for DocNo '2716'...");
    const res = await axios.post(url, {
      query: `
        SELECT 
          t11.Field_001 as LineId,
          t11.Field_003 as SubCode,
          t11.Field_004 as DocNo,
          t11.Field_005 as ItemCode,
          t11.Field_006 as Quantity,
          t11.Field_012 as StoreId,
          t11.Field_031 as Note
        FROM STR_TBL_011 t11
        WHERE t11.Field_004 = '2716'
      `
    }, { headers });
    
    const rows = res.data.data || [];
    console.log(`Found ${rows.length} rows for DocNo 2716.`);

    // Group by ItemCode and sum Quantity
    const itemSums = {};
    rows.forEach(r => {
      const code = r.ItemCode;
      itemSums[code] = (itemSums[code] || 0) + parseFloat(r.Quantity || 0);
    });

    console.log("Summed quantities by ItemCode:", itemSums);

    // Let's get names
    for (const code of Object.keys(itemSums)) {
      const resName = await axios.post(url, {
        query: `
          SELECT TOP 1 Field_003 as Name FROM IND_TBL_002 WHERE Field_008 = '${code}'
        `
      }, { headers });
      const name = resName.data.data && resName.data.data[0] ? resName.data.data[0].Name : 'Unknown';
      console.log(`ItemCode: ${code} | Name: ${name} | Total Qty: ${itemSums[code]}`);
    }

  } catch(e) {
    console.error("Error:", e.message);
  }
}

run();
