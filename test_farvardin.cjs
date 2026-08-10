const jalaali = require('jalaali-js');

// Frontend function
const jalaliToGregorianStr = (jalaliStr) => {
    if (!jalaliStr) return '';
    try {
        let clean = jalaliStr.trim()
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
        
        const parts = clean.split(/[\/\.\-]/);
        if (parts.length !== 3) return jalaliStr;
        
        let part0 = parseInt(parts[0], 10);
        let part1 = parseInt(parts[1], 10);
        let part2 = parseInt(parts[2], 10);
        
        if (isNaN(part0) || isNaN(part1) || isNaN(part2)) return jalaliStr;
        
        let jy = 0, jm = 0, jd = 0;
        if (part2 >= 100) {
            jy = part2;
            jm = part1;
            jd = part0;
        } else if (part0 >= 100) {
            jy = part0;
            jm = part1;
            jd = part2;
        } else {
            if (part0 > 12) {
                jy = part2;
                jm = part1;
                jd = part0;
            } else {
                jy = part0;
                jm = part1;
                jd = part2;
            }
        }
        
        if (jy < 100) {
            jy += 1400;
        } else if (jy >= 100 && jy < 1000) {
            jy += 1000;
        }
        
        if (jm > 12 && jd <= 12) {
            const temp = jm;
            jm = jd;
            jd = temp;
        }
        
        const g = jalaali.toGregorian(jy, jm, jd);
        return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
    } catch {
        return jalaliStr;
    }
};

// Backend function
function normalizeShamsiDate(str) {
    if (!str) return '';
    let clean = str.trim()
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    return clean;
}

const parseJalaliStrToGregorian = (jalaliStr) => {
    if (!jalaliStr) return null;
    try {
        const clean = normalizeShamsiDate(jalaliStr);
        const parts = clean.split(/[\/\.\-]/);
        if (parts.length !== 3) return null;
        
        let part0 = parseInt(parts[0], 10);
        let part1 = parseInt(parts[1], 10);
        let part2 = parseInt(parts[2], 10);
        
        if (isNaN(part0) || isNaN(part1) || isNaN(part2)) return null;
        
        let jy = 0, jm = 0, jd = 0;
        if (part2 >= 100) {
            jy = part2;
            jm = part1;
            jd = part0;
        } else if (part0 >= 100) {
            jy = part0;
            jm = part1;
            jd = part2;
        } else {
            if (part0 > 12) {
                jy = part2;
                jm = part1;
                jd = part0;
            } else {
                jy = part0;
                jm = part1;
                jd = part2;
            }
        }
        
        if (jy < 100) {
            jy += 1400;
        } else if (jy >= 100 && jy < 1000) {
            jy += 1000;
        }
        
        if (jm > 12 && jd <= 12) {
            const temp = jm;
            jm = jd;
            jd = temp;
        }
        
        const g = jalaali.toGregorian(jy, jm, jd);
        const y = g.gy;
        const m = String(g.gm).padStart(2, '0');
        const d = String(g.gd).padStart(2, '0');
        return `${y}-${m}-${d}`;
    } catch (e) {
        return null;
    }
};

// Test days of Farvardin 1404 (1 to 31)
console.log("Testing Farvardin 1404:");
for (let d = 1; d <= 31; d++) {
    const jalStr = `1404/01/${String(d).padStart(2, '0')}`;
    const gregFe = jalaliToGregorianStr(jalStr);
    const gregBe = parseJalaliStrToGregorian(jalStr);
    if (gregFe !== gregBe) {
        console.log(`DISCREPANCY on ${jalStr}: FE=${gregFe}, BE=${gregBe}`);
    }
}
console.log("Farvardin 1404 tests completed.");

// Test days of Farvardin 1405 (1 to 31)
console.log("\nTesting Farvardin 1405:");
for (let d = 1; d <= 31; d++) {
    const jalStr = `1405/01/${String(d).padStart(2, '0')}`;
    const gregFe = jalaliToGregorianStr(jalStr);
    const gregBe = parseJalaliStrToGregorian(jalStr);
    if (gregFe !== gregBe) {
        console.log(`DISCREPANCY on ${jalStr}: FE=${gregFe}, BE=${gregBe}`);
    }
}
console.log("Farvardin 1405 tests completed.");
