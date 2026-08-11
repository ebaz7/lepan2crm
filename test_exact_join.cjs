const axios = require('axios');

async function run() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

    try {
        // Query Header + Detail for Header 479333 with t11.Field_012 = t10.Field_018!
        const testJoin = await axios.post(url, {
            query: `
                SELECT 
                    t10.Field_001 as HeaderDocId,
                    t10.Field_006 as InvoiceNum,
                    t10.Field_008 as Date,
                    t10.Field_009 as OpCode,
                    t10.Field_018 as HeaderStore,
                    t10.Field_037 as HeaderPayable,
                    t11.Field_001 as LineId,
                    t11.Field_012 as DetailStore,
                    t11.Field_005 as ItemCode,
                    t11.Field_006 as Quantity,
                    t11.Field_007 as Amount,
                    t11.Field_036 as LineOpCode
                FROM STR_TBL_010 t10
                INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                          AND t11.Field_003 = t10.Field_004
                                          AND t11.Field_012 = t10.Field_018
                                          AND t11.Field_036 = t10.Field_009
                WHERE t10.Field_001 = '479333'
            `
        }, { headers });

        console.log("=== Detail lines for Header 479333 with Store match (t11.Field_012 = t10.Field_018 AND t11.Field_036 = t10.Field_009) ===");
        console.log("Line Count:", testJoin.data.data.length);
        testJoin.data.data.forEach(r => console.log(` - Line ${r.LineId}: Item=${r.ItemCode}, Qty=${r.Quantity}, Amt=${r.Amount}`));

        // Sum Qty and Amt for Header 479333
        const sumQty = testJoin.data.data.reduce((s, r) => s + parseFloat(r.Quantity || 0), 0);
        const sumAmt = testJoin.data.data.reduce((s, r) => s + parseFloat(r.Amount || 0), 0);
        console.log(`Doc 479333 Sum Detail Qty: ${sumQty.toFixed(2)} kg, Sum Detail Amt: ${sumAmt.toLocaleString()} Rials, HeaderPayable: ${testJoin.data.data[0]?.HeaderPayable?.toLocaleString()} Rials`);

    } catch (e) {
        console.error(e.message);
    }
}
run();
