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
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_007 as Amount,
            t11.Field_031 as ItemNotes,
            t10.Field_029 as HeaderNotes
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004
                                  AND t11.Field_036 = t10.Field_009
        WHERE (t10.Field_009 = '12' OR t10.Field_009 = '13')
          AND t10.Field_008 >= '${gregFrom}T00:00:00.000Z' AND t10.Field_008 <= '${gregTo}T23:59:59.999Z'
    `;

    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
        query: sql
    }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});

    const rows = res.data.data || [];
    
    const dbInvoices = new Map();
    rows.forEach(r => {
        const key = `${r.WhCode}_${r.DocId}_${r.OpCode}`;
        if (!dbInvoices.has(key)) {
            dbInvoices.set(key, { amount: 0, qty: 0 });
        }
        const inv = dbInvoices.get(key);
        const amt = parseFloat(r.Amount || 0);
        let baseAmt = amt;
        const h = r.HeaderNotes || '';
        const i = r.ItemNotes || '';
        const isOfficial = h.includes('رسمی') || i.includes('رسمی') || i.includes('ارزش افزوده:');
        if (isOfficial) baseAmt *= 1.10;

        inv.amount += baseAmt;
        inv.qty += parseFloat(r.Quantity || 0);
    });

    excelRows.forEach(ex => {
        const exDocId = String(ex['کد بایگانی']);
        const exNum = String(ex['شماره']);
        const exPayable = parseFloat(ex['قابل پرداخت'] || 0);
        const exOp = String(ex['کد عملیات']).trim();

        let found = null;
        for (const [k, inv] of dbInvoices.entries()) {
            const [wh, doc, op] = k.split('_');
            if (doc === exDocId && op === exOp) {
                found = inv;
                break;
            }
        }

        if (!found) {
            console.log(`❌ Missing: Inv #${exNum} (DocId ${exDocId})`);
        } else {
            const diff = Math.abs(found.amount - exPayable);
            if (diff > 1000) {
                console.log(`⚠️ Mismatch: Inv #${exNum} (${ex['نام کامل شخص']}) Excel Payable: ${exPayable} vs DB Amount: ${found.amount.toFixed(0)} (Diff: ${diff.toFixed(0)})`);
            }
        }
    });
}
run();
