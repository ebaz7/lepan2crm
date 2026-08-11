const axios = require('axios');

async function run() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

    // Query 1: Total HeaderPayable (Field_037) or Field_026 in STR_TBL_010 for OpCode 12 in Farvardin 1405
    const q1 = `
        SELECT 
            COUNT(DISTINCT Field_001) as DocCount,
            SUM(CAST(Field_037 AS FLOAT)) as SumHeaderPayable,
            SUM(CAST(Field_026 AS FLOAT)) as SumField026,
            SUM(CAST(Field_040 AS FLOAT)) as SumField040
        FROM STR_TBL_010
        WHERE Field_009 = '12'
          AND Field_008 >= '2026-03-21 00:00:00'
          AND Field_008 <= '2026-04-20 23:59:59'
    `;

    try {
        const res1 = await axios.post(url, { query: q1 }, { headers });
        console.log("=== Q1: STR_TBL_010 Header Aggregates for OpCode 12 ===");
        console.log(res1.data.data);
    } catch (e) {
        console.error("Q1 error:", e.message);
    }

    // Query 2: Let's check STR_TBL_011 items joined properly to STR_TBL_010
    const q2 = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_008 as Date,
            t10.Field_009 as HeaderOpCode,
            t10.Field_037 as HeaderPayable,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_007 as Amount,
            t11.Field_036 as LineOpCode
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
        WHERE t10.Field_009 = '12'
          AND t10.Field_008 >= '2026-03-21 00:00:00'
          AND t10.Field_008 <= '2026-04-20 23:59:59'
    `;

    try {
        const res2 = await axios.post(url, { query: q2 }, { headers });
        const rows = res2.data.data || [];
        console.log(`\n=== Q2: Detail Rows returned: ${rows.length} ===`);

        // Group by LineOpCode (t11.Field_036)
        const opGroup = {};
        rows.forEach(r => {
            const lineOp = String(r.LineOpCode || '').trim();
            if (!opGroup[lineOp]) opGroup[lineOp] = { count: 0, sumQty: 0, sumAmt: 0 };
            opGroup[lineOp].count++;
            opGroup[lineOp].sumQty += parseFloat(r.Quantity || 0);
            opGroup[lineOp].sumAmt += parseFloat(r.Amount || 0);
        });
        console.log("Breakdown by t11.Field_036 (Line OpCode):", opGroup);

    } catch (e) {
        console.error("Q2 error:", e.message);
    }
}
run();
