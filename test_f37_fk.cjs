const axios = require('axios');

async function run() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

    try {
        // Test joining STR_TBL_011 t11 ON t11.Field_037 = t10.Field_001 for Header 479333!
        const test1 = await axios.post(url, {
            query: `
                SELECT 
                    t10.Field_001 as HeaderDocId,
                    t10.Field_006 as InvoiceNum,
                    t10.Field_008 as Date,
                    t10.Field_009 as OpCode,
                    t10.Field_037 as HeaderPayable,
                    t11.Field_001 as DetailLineId,
                    t11.Field_005 as ItemCode,
                    t11.Field_006 as Quantity,
                    t11.Field_007 as Amount,
                    t11.Field_036 as LineOpCode,
                    t11.Field_037 as DetailHeaderFk
                FROM STR_TBL_010 t10
                INNER JOIN STR_TBL_011 t11 ON t11.Field_037 = t10.Field_001
                WHERE t10.Field_001 = '479333'
            `
        }, { headers });

        console.log("=== Detail lines linked via t11.Field_037 = t10.Field_001 for Doc 479333 ===");
        console.log("Count:", test1.data.data.length);
        console.log(test1.data.data);

        // Now test for ALL 42 Header Documents in Farvardin 1405!
        const testAll = await axios.post(url, {
            query: `
                SELECT 
                    t10.Field_001 as HeaderDocId,
                    t10.Field_006 as InvoiceNum,
                    t10.Field_008 as Date,
                    t10.Field_009 as OpCode,
                    t10.Field_037 as HeaderPayable,
                    t11.Field_005 as ItemCode,
                    t11.Field_006 as Quantity,
                    t11.Field_007 as Amount,
                    t11.Field_036 as LineOpCode
                FROM STR_TBL_010 t10
                INNER JOIN STR_TBL_011 t11 ON t11.Field_037 = t10.Field_001
                WHERE t10.Field_009 = '12'
                  AND t10.Field_008 >= '2026-03-21 00:00:00'
                  AND t10.Field_008 <= '2026-04-20 23:59:59'
            `
        }, { headers });

        const rows = testAll.data.data || [];
        console.log(`\n=== Farvardin 1405 Sales (OpCode 12) with t11.Field_037 = t10.Field_001 ===`);
        console.log(`Total detail rows: ${rows.length}`);

        let totalQty = 0;
        let totalAmt = 0;
        const uniqueDocs = new Set();
        rows.forEach(r => {
            uniqueDocs.add(r.HeaderDocId);
            totalQty += parseFloat(r.Quantity || 0);
            totalAmt += parseFloat(r.Amount || 0);
        });

        console.log(`Unique Header Docs matched: ${uniqueDocs.size}`);
        console.log(`Total Quantity (Weight): ${(totalQty).toFixed(2)} kg (${(totalQty/1000).toFixed(2)} tons)`);
        console.log(`Total Amount: ${totalAmt.toLocaleString()} Rials (${(totalAmt/1e9).toFixed(2)} Billion Rials)`);

    } catch (e) {
        console.error(e.message);
    }
}
run();
