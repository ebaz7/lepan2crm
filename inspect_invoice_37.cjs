const axios = require('axios');
async function run() {
    // Let's run a query to list all sales invoices in the range 2025-03-21 to 2025-04-15
    const sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t11.Field_007 as Amount,
            t10.Field_029 as Notes
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004
        WHERE (t10.Field_009 IN ('3', '12', '23') AND t11.Field_007 > 0)
          AND t10.Field_008 >= '2025-03-21T00:00:00.000Z'
          AND t10.Field_008 <= '2025-04-13T23:59:59.000Z'
        ORDER BY t10.Field_008 ASC
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        const rows = res.data.data || [];
        console.log("Found rows count:", rows.length);
        let total = 0;
        rows.forEach(r => {
            total += parseFloat(r.Amount || 0);
            console.log(`DocId: ${r.DocId}, InvoiceNum: ${r.InvoiceNum}, Date: ${r.Date}, Amount: ${r.Amount}`);
        });
        console.log("Total Amount (Raw):", total);
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
