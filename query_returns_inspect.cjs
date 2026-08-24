const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

  try {
    console.log("Querying all columns from STR_TBL_010 for DocNo 2716 and 2730 with OpCode 44...");
    const res10 = await axios.post(url, {
      query: `
        SELECT *
        FROM STR_TBL_010
        WHERE Field_005 IN ('2716', '2730') AND Field_009 = '44'
      `
    }, { headers });
    console.log("STR_TBL_010 All Columns:", res10.data.data);

    console.log("\nQuerying STR_TBL_011 for DocNo 2730...");
    const res11 = await axios.post(url, {
      query: `
        SELECT 
          Field_001 as LineId,
          Field_003 as SubCode,
          Field_004 as DocNo,
          Field_005 as ItemCode,
          Field_006 as Quantity,
          Field_012 as StoreId,
          Field_031 as Note
        FROM STR_TBL_011
        WHERE Field_004 = '2730'
      `
    }, { headers });
    console.log(`Found ${res11.data.data ? res11.data.data.length : 0} rows for DocNo 2730.`);
    if (res11.data.data) {
      console.log("Sample rows for 2730:", res11.data.data.slice(0, 5));
    }

  } catch(e) {
    console.error("Error:", e.message);
  }
}

run();
