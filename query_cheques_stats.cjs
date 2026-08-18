const axios = require('axios');

async function run() {
  try {
    const sayanUrl = 'http://80.210.31.176:5000/api/external/v1/query';
    const sayanKey = 's_gate_live_vgr182bwtpoa';

    // Query for due dates statistics
    const statsQuery = `
        SELECT 
            SUBSTRING(CAST(t12.Field_006 as VARCHAR(50)), 1, 4) as DueYear,
            COUNT(*) as TotalCount
        FROM BUR_TBL_012 t12
        GROUP BY SUBSTRING(CAST(t12.Field_006 as VARCHAR(50)), 1, 4)
        ORDER BY DueYear ASC
    `;

    console.log("Sending stats query to live Sayan...");
    const res = await axios.post(sayanUrl, { query: statsQuery }, {
      headers: { 'Authorization': `Bearer ${sayanKey}` }
    });

    console.log("Cheque year stats:");
    console.table(res.data.data || []);

    // Also let's query the top 5 cheques to see actual structure
    const sampleQuery = `
        SELECT TOP 5
            t12.Field_001 as Id,
            t12.Field_005 as ChequeNo,
            t12.Field_006 as DueDate,
            t12.Field_008 as IsActive,
            t12.Field_009 as BankName,
            t12.Field_011 as DrawerName,
            t12.Field_013 as Amount,
            t12.Field_015 as StatusDesc,
            t12.Field_016 as StatusCode
        FROM BUR_TBL_012 t12
    `;

    const res2 = await axios.post(sayanUrl, { query: sampleQuery }, {
      headers: { 'Authorization': `Bearer ${sayanKey}` }
    });
    console.log("\nSample cheques:");
    console.log(res2.data.data);

  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
}

run();
