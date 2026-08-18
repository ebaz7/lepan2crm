import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'database.json');

async function run() {
    try {
        let url = process.env.SAYAN_API_URL;
        let key = process.env.SAYAN_API_KEY;

        if (fs.existsSync(DB_FILE)) {
            const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            const settings = db.settings || {};
            url = url || settings.sayanApiUrl;
            key = key || settings.sayanApiKey;
        }

        if (!url || !key) {
            console.error("Sayan config missing! SAYAN_API_URL and SAYAN_API_KEY are empty.");
            return;
        }

        console.log("Sayan API URL:", url);
        const finalUrl = `${url.replace(/\/$/, '')}/query`;

        // Let's run a query to find the specific cheque 662665
        const queryStr = `
            SELECT 
                t12.Field_001 as Id,
                t12.Field_004 as StatusType,
                t12.Field_005 as ChequeNo,
                t12.Field_006 as DueDate,
                t12.Field_008 as IsActive,
                t12.Field_009 as BankName,
                t12.Field_010 as BranchName,
                t12.Field_011 as DrawerName,
                t12.Field_012 as InOrderOf,
                t12.Field_013 as Amount,
                t12.Field_014 as Field014,
                t12.Field_015 as StatusDesc,
                t12.Field_016 as StatusCode
            FROM BUR_TBL_012 t12
            WHERE t12.Field_005 LIKE '%662665%' OR t12.Field_005 = '662665'
        `;

        const response = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: queryStr })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error("API error:", err);
            return;
        }

        const data = await response.json();
        const rows = data.data || [];
        console.log(`\nFound ${rows.length} rows for cheque 662665:`);
        console.log(JSON.stringify(rows, null, 2));

        // Let's run another query to get stats of the DueDates for active/in-hand cheques
        const statsQuery = `
            SELECT 
                SUBSTRING(CAST(t12.Field_006 as VARCHAR(50)), 1, 4) as DueYear,
                COUNT(*) as TotalCount,
                SUM(CASE WHEN t12.Field_008 = '0' OR t12.Field_008 = 'false' THEN 1 ELSE 0 END) as InactiveCount
            FROM BUR_TBL_012 t12
            GROUP BY SUBSTRING(CAST(t12.Field_006 as VARCHAR(50)), 1, 4)
            ORDER BY DueYear ASC
        `;

        const responseStats = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: statsQuery })
        });

        if (responseStats.ok) {
            const statsData = await responseStats.json();
            console.log("\nCheque year statistics:");
            console.table(statsData.data || []);
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
