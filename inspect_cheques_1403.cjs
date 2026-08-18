async function run() {
  try {
    // BUR_TBL_012 contains cheques.
    // Let's query BUR_TBL_012 where Field_006 (DueDate) starts with '1403'
    // Field_008 is IsActive, and in Sayan, cheques in safe (چک‌های در صندوق) usually have IsActive=1/true or similar status code.
    // Let's select all fields for 1403 cheques to inspect.
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

    console.log("Sending query to local proxy at http://localhost:3000/api/sayan-proxy...");
    const response = await fetch('http://localhost:3000/api/sayan-proxy', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            path: '/query',
            method: 'POST',
            body: { query: queryStr }
        })
    });

    if (!response.ok) {
        console.error("Local proxy query failed with status:", response.status);
        const text = await response.text();
        console.error("Error body:", text);
        return;
    }

    const resData = await response.json();
    const rows = resData.data || resData || [];
    console.log(`\nTotal 1403 cheques found in Sayan: ${rows.length}`);

    // Let's filter to active / in-hand (در صندوق) cheques
    // Let's see the unique status values
    const statusDist = {};
    rows.forEach(r => {
      statusDist[r.StatusDesc] = (statusDist[r.StatusDesc] || 0) + 1;
    });
    console.log("StatusDesc distribution:", statusDist);

    const activeList = rows.filter(r => String(r.IsActive) === '1' || String(r.IsActive) === 'true' || r.StatusDesc === 'در صندوق' || String(r.StatusCode) === '1');
    console.log(`\nTotal 'در صندوق' / Active 1403 cheques: ${activeList.length}`);

    activeList.forEach((r, idx) => {
      console.log(`${idx + 1}. ChequeNo: ${r.ChequeNo}, DueDate: ${r.DueDate}, Amount: ${Number(r.Amount).toLocaleString()} IRR, Bank: ${r.BankName}, Drawer: ${r.DrawerName}, Status: ${r.StatusDesc} (Code: ${r.StatusCode}), IsActive: ${r.IsActive}`);
    });

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
