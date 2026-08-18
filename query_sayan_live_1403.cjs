const axios = require('axios');

async function run() {
  try {
    const sayanUrl = 'http://80.210.31.176:5000/api/external/v1/query';
    const sayanKey = 's_gate_live_vgr182bwtpoa';

    // Query for 1403 cheques
    const queryStr = `
        SELECT 
            t12.Field_001 as Id,
            t12.Field_004 as StatusType,
            t12.Field_005 as ChequeNo,
            t12.Field_006 as DueDate,
            t12.Field_008 as IsActive,
            t12.Field_009 as BankName,
            t12.Field_010 as BranchName,
            t12.Field_011 as DrawerName,
            t12.Field_012 as InOrderOf,
            t12.Field_013 as Amount,
            t12.Field_014 as Field014,
            t12.Field_015 as StatusDesc,
            t12.Field_016 as StatusCode
        FROM BUR_TBL_012 t12
        WHERE t12.Field_006 LIKE '1403%'
    `;

    console.log("Sending query to live Sayan at http://80.210.31.176:5000...");
    const res = await axios.post(sayanUrl, { query: queryStr }, {
      headers: { 'Authorization': `Bearer ${sayanKey}` }
    });

    const rows = res.data.data || [];
    console.log(`\nTotal 1403 cheques found in Sayan: ${rows.length}`);

    // Let's filter to active / in-hand (در صندوق) cheques
    // Let's see the unique status values
    const statusDist = {};
    rows.forEach(r => {
      statusDist[r.StatusDesc] = (statusDist[r.StatusDesc] || 0) + 1;
    });
    console.log("StatusDesc distribution:", statusDist);

    // Let's look at cheques "در صندوق" (StatusCode 1 or IsActive=1 or StatusDesc='در صندوق')
    // Wait, let's see how active is defined by looking at all rows
    console.log("\nDetails of all 1403 cheques:");
    rows.forEach((r, idx) => {
      console.log(`${idx + 1}. ChequeNo: ${r.ChequeNo}, DueDate: ${r.DueDate}, Amount: ${Number(r.Amount).toLocaleString()} IRR, Bank: ${r.BankName}, Drawer: ${r.DrawerName}, Status: ${r.StatusDesc} (Code: ${r.StatusCode}), IsActive: ${r.IsActive}`);
    });

  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
}

run();
