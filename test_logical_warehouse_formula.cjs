const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    // Let's fetch all 1404 rubber transactions
    const sql = `
        SELECT 
            RTRIM(LTRIM(t10.Field_009)) as DocType,
            t11.Field_006 as Quantity
        FROM STR_TBL_011 t11
        INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004 
                                  AND t11.Field_012 = t10.Field_018
        WHERE t10.Field_008 >= '2025-03-21T00:00:00.000Z'
          AND t10.Field_008 <= '2026-03-20T23:59:59.000Z'
          AND t11.Field_005 LIKE '0104%'
    `;

    try {
        const response = await axios.post(url, { query: sql }, { headers });
        const rows = response.data.data || [];
        
        // Sum by DocType
        const sums = {};
        rows.forEach(r => {
            const dt = r.DocType;
            sums[dt] = (sums[dt] || 0) + (parseFloat(r.Quantity) || 0);
        });

        console.log("1404 Sums by DocType:");
        console.log(sums);

        // Standard, professional warehouse formula:
        // Inflows: 10 (Beginning), 24 (Sales Return), 26 (Inter-warehouse Rec), 29 (Purchase Rec), 44 (Production Return Rec), 46 (Produced Goods Rec), 83 (Deficit Adj Rec)
        // Outflows: 23 (Sales Issue), 25 (Inter-warehouse Issue), 30 (Purchase Return Issue), 37 (To Production Issue), 84 (Surplus Adj Issue)
        
        const inflows = ['10', '24', '26', '29', '44', '46', '83'];
        const outflows = ['23', '25', '30', '37', '84'];

        let totalInflows = 0;
        let totalOutflows = 0;

        inflows.forEach(dt => {
            totalInflows += (sums[dt] || 0);
        });

        outflows.forEach(dt => {
            totalOutflows += (sums[dt] || 0);
        });

        const netBalance = totalInflows - totalOutflows;

        console.log("\n--- Logical Warehouse Formula Results ---");
        console.log("Total Inflows:", totalInflows);
        console.log("Total Outflows:", totalOutflows);
        console.log("Net Stock Balance (1404 bounded):", netBalance);

    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
