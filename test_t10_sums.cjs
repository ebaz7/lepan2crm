const axios = require('axios');
const xlsx = require('xlsx');
const jalaali = require('jalaali-js');

async function run() {
    const wb = xlsx.readFileSync('farvardin_sales.xlsx');
    const excelRows = xlsx.utils.sheet_to_json(wb.Sheets['Data']);

    const fromG = jalaali.toGregorian(1405, 1, 1);
    const toG = jalaali.toGregorian(1405, 1, 31);
    const gregFrom = `${fromG.gy}-${String(fromG.gm).padStart(2, '0')}-${String(fromG.gd).padStart(2, '0')}`;
    const gregTo = `${toG.gy}-${String(toG.gm).padStart(2, '0')}-${String(toG.gd).padStart(2, '0')}`;

    const sql = `
        SELECT 
            t10.Field_001 as RecId,
            t10.Field_004 as WhCode,
            t10.Field_005 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_009 as OpCode,
            t10.Field_026 as T10_F26,
            t10.Field_037 as T10_F37,
            t10.Field_040 as T10_F40
        FROM STR_TBL_010 t10
        WHERE (t10.Field_009 = '12' OR t10.Field_009 = '13')
          AND t10.Field_008 >= '${gregFrom}T00:00:00.000Z' AND t10.Field_008 <= '${gregTo}T23:59:59.999Z'
    `;

    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
        query: sql
    }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});

    const rows = res.data.data || [];
    
    let sumF26 = 0;
    let sumF37 = 0;
    let sumF40 = 0;

    rows.forEach(r => {
        const op = String(r.OpCode).trim();
        const f26 = parseFloat(r.T10_F26 || 0);
        const f37 = parseFloat(r.T10_F37 || 0);
        const f40 = parseFloat(r.T10_F40 || 0);
        if (op === '12') {
            sumF26 += f26;
            sumF37 += f37;
            sumF40 += f40;
        } else if (op === '13') {
            sumF26 -= f26;
            sumF37 -= f37;
            sumF40 -= f40;
        }
    });

    console.log("Sum STR_TBL_010 Field_026:", sumF26);
    console.log("Sum STR_TBL_010 Field_037:", sumF37);
    console.log("Sum STR_TBL_010 Field_040:", sumF40);
}
run();
