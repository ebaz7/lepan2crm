const axios = require('axios');
const jalaali = require('jalaali-js');

async function run() {
    const fromG = jalaali.toGregorian(1405, 1, 1);
    const toG = jalaali.toGregorian(1405, 1, 31);
    const gregFrom = `${fromG.gy}-${String(fromG.gm).padStart(2, '0')}-${String(fromG.gd).padStart(2, '0')}`;
    const gregTo = `${toG.gy}-${String(toG.gm).padStart(2, '0')}-${String(toG.gd).padStart(2, '0')}`;

    const sql = `
        SELECT 
            t11.Field_005 as ItemCode,
            t11.Field_006 as Qty,
            t11.Field_007 as Amt,
            t11.Field_031 as ItemNotes
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004
                                  AND t11.Field_036 = t10.Field_009
        WHERE t10.Field_009 = '12'
          AND t10.Field_008 >= '${gregFrom}T00:00:00.000Z' AND t10.Field_008 <= '${gregTo}T23:59:59.999Z'
    `;

    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
        query: sql
    }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});

    const rows = res.data.data || [];
    let totalQty = 0;
    let zeroAmtQty = 0;
    let zeroAmtCount = 0;

    rows.forEach(r => {
        const q = parseFloat(r.Qty || 0);
        const a = parseFloat(r.Amt || 0);
        totalQty += q;
        if (a <= 0) {
            zeroAmtQty += q;
            zeroAmtCount++;
        }
    });

    console.log("Total Qty:", totalQty);
    console.log("Qty with Amt <= 0:", zeroAmtQty, `(Count: ${zeroAmtCount})`);
}
run();
