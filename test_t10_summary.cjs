const axios = require('axios');
const jalaali = require('jalaali-js');

async function run() {
    const fromG = jalaali.toGregorian(1405, 1, 1);
    const toG = jalaali.toGregorian(1405, 1, 31);
    const gregFrom = `${fromG.gy}-${String(fromG.gm).padStart(2, '0')}-${String(fromG.gd).padStart(2, '0')}`;
    const gregTo = `${toG.gy}-${String(toG.gm).padStart(2, '0')}-${String(toG.gd).padStart(2, '0')}`;

    const sql = `
        SELECT 
            t10.Field_006 as InvoiceNum,
            t10.Field_026 as Amount,
            t10.Field_037 as Payable,
            t10.Field_029 as Notes
        FROM STR_TBL_010 t10
        WHERE t10.Field_009 = '12'
          AND t10.Field_008 >= '${gregFrom}T00:00:00.000Z' AND t10.Field_008 <= '${gregTo}T23:59:59.999Z'
    `;

    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
        query: sql
    }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});

    let sumAmt = 0;
    let sumPayable = 0;
    res.data.data.forEach(r => {
        sumAmt += parseFloat(r.Amount || 0);
        sumPayable += parseFloat(r.Payable || 0);
    });

    console.log("Sum Amount (Field_026):", sumAmt);
    console.log("Sum Payable (Field_037):", sumPayable);
}
run();
