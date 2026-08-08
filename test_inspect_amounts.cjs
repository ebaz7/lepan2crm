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
            t11.Field_008 as Discount,
            t11.Field_009 as NetAmount,
            t11.Field_010 as VAT,
            t11.Field_011 as Tax,
            t11.Field_012 as FinalAmount,
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
            dbInvoices.set(key, { amount: 0, netAmount: 0, finalAmount: 0, qty: 0, rows: [] });
        }
        const inv = dbInvoices.get(key);
        inv.amount += parseFloat(r.Amount || 0);
        inv.netAmount += parseFloat(r.NetAmount || 0);
        inv.finalAmount += parseFloat(r.FinalAmount || 0);
        inv.qty += parseFloat(r.Quantity || 0);
        inv.rows.push(r);
    });

    excelRows.forEach(ex => {
        const exDocId = String(ex['کد بایگانی']);
        const exNum = String(ex['شماره']);
        const exPayable = parseFloat(ex['قابل پرداخت'] || 0);
        const exAmt = parseFloat(ex['مبلغ'] || 0);
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
            console.log(`❌ Not found: Inv #${exNum} (DocId ${exDocId}, Op ${exOp})`);
        } else {
            console.log(`Inv #${exNum} (${ex['نام کامل شخص']}) -> Excel Payable: ${exPayable}, DB Amount: ${found.amount}, DB NetAmount: ${found.netAmount}, DB FinalAmount: ${found.finalAmount}, Qty: ${found.qty}`);
        }
    });
}
run();
