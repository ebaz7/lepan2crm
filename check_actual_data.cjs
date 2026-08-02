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

async function test() {
    const sql = `
        SELECT DISTINCT 
            CAST(t10.Field_008 AS DATE) as RawDate
        FROM STR_TBL_010 t10
        WHERE t10.Field_008 >= '2025-04-12T00:00:00.000Z'
          AND t10.Field_008 <= '2025-04-18T23:59:59.000Z'
        ORDER BY RawDate ASC
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        
        const data = res.data.data || [];
        console.log(`Found ${data.length} distinct dates:`);
        data.forEach(row => {
            const rawDateStr = new Date(row.RawDate).toISOString();
            console.log(`RawDate in DB: ${row.RawDate} -> Converted ISO: ${rawDateStr} -> Converted Jalali: ${formatDateToJalali(row.RawDate)}`);
        });
    } catch (e) {
        console.error("Error:", e.message);
    }
}

test();
