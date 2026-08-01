const axios = require('axios');
async function run() {
    const sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t11.Field_005 as ItemCode,
            t22.Field_004 as ItemName,
            t11.Field_006 as Quantity,
            t11.Field_007 as Amount,
            t11.Field_031 as ItemNotes,
            t02.Field_003 as GroupName,
            t07.Field_006 as CustomerName
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004
        LEFT JOIN IND_TBL_022 t22 ON t11.Field_005 = t22.Field_005
        LEFT JOIN IND_TBL_021 t21 ON t11.Field_005 = t21.Field_004
        LEFT JOIN IND_TBL_002 t02 ON t21.Field_003 = t02.Field_008
        LEFT JOIN ACT_TBL_007 t07 ON t10.Field_010 = t07.Field_005 AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
        WHERE t10.Field_001 IN ('496439', '496435', '496430')
          AND t11.Field_007 IS NOT NULL AND t11.Field_007 > 0
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        if (res.data.data) {
            console.log("Filtered items for today's three invoices:");
            console.log(JSON.stringify(res.data.data, null, 2));
            
            // Let's sum up by invoice
            const invoiceSums = {};
            res.data.data.forEach(r => {
                const key = r.InvoiceNum;
                if (!invoiceSums[key]) invoiceSums[key] = 0;
                invoiceSums[key] += parseFloat(r.Amount || 0);
            });
            console.log("\nSum of items by invoice:", invoiceSums);
        }
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
