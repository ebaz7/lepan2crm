const axios = require('axios');
const jalaali = require('jalaali-js');

function formatDateToJalali(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const iranTime = new Date(d.getTime() + (3.5 * 60 * 60 * 1000));
        const y = iranTime.getUTCFullYear();
        const m = iranTime.getUTCMonth() + 1;
        const day = iranTime.getUTCDate();
        const j = jalaali.toJalaali(y, m, day);
        return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
    } catch {
        return dateStr;
    }
}

async function runQuery(sql) {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
        query: sql
    }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
    return res.data.data || [];
}

async function test() {
    // 1. Using 'T00:00:00.000Z'
    const sql1 = `
        SELECT DISTINCT CAST(Field_008 AS DATE) as RawDate
        FROM STR_TBL_010
        WHERE Field_008 >= '2025-03-21T00:00:00.000Z'
          AND Field_008 <= '2025-04-13T23:59:59.000Z'
        ORDER BY RawDate ASC
    `;
    
    // 2. Using standard space separator 'YYYY-MM-DD 00:00:00'
    const sql2 = `
        SELECT DISTINCT CAST(Field_008 AS DATE) as RawDate
        FROM STR_TBL_010
        WHERE Field_008 >= '2025-03-21 00:00:00'
          AND Field_008 <= '2025-04-13 23:59:59'
        ORDER BY RawDate ASC
    `;

    try {
        const rows1 = await runQuery(sql1);
        console.log(`\n--- Results with T00:00:00.000Z (Total: ${rows1.length}) ---`);
        rows1.slice(-5).forEach(row => {
            console.log(`RawDate: ${row.RawDate} -> Jalali: ${formatDateToJalali(row.RawDate)}`);
        });

        const rows2 = await runQuery(sql2);
        console.log(`\n--- Results with space '2025-03-21 00:00:00' (Total: ${rows2.length}) ---`);
        rows2.slice(-5).forEach(row => {
            console.log(`RawDate: ${row.RawDate} -> Jalali: ${formatDateToJalali(row.RawDate)}`);
        });

    } catch (e) {
        console.error("Error:", e.message);
    }
}

test();
