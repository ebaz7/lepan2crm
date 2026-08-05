const jalaali = require('jalaali-js');
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
        
        let jy = 0;
        let jm = 0;
        let jd = 0;
        
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

console.log(jalaliToGregorianStr('1404/01/24'));
console.log(jalaliToGregorianStr('24.1.1404'));
console.log(jalaliToGregorianStr('1.1.1404'));
console.log(jalaliToGregorianStr('1.1.04'));
