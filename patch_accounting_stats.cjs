const fs = require('fs');
let code = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

// We need to inject return calculations into getSalesOverviewStats
const oldStatsDec = `        const stats = {
            todayAmt: 0,
            todayQty: 0,
            monthAmt: 0,
            monthQty: 0,
            quarterAmt: 0,
            quarterQty: 0,
            yearAmt: 0,
            yearQty: 0,
            rangeAmt: 0,
            rangeQty: 0
        };`;

const newStatsDec = `        const stats = {
            todayAmt: 0, todayQty: 0, todayRetAmt: 0, todayRetQty: 0,
            monthAmt: 0, monthQty: 0, monthRetAmt: 0, monthRetQty: 0,
            quarterAmt: 0, quarterQty: 0, quarterRetAmt: 0, quarterRetQty: 0,
            yearAmt: 0, yearQty: 0, yearRetAmt: 0, yearRetQty: 0,
            rangeAmt: 0, rangeQty: 0, rangeRetAmt: 0, rangeRetQty: 0
        };`;

code = code.replace(oldStatsDec, newStatsDec);

const oldForEach = `        salesData.forEach(row => {
            const date = new Date(row.Date);
            const qty = parseFloat(row.Quantity || 0);
            const amt = parseFloat(row.Amount || 0);
            
            const jDate = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());

            stats.rangeAmt += amt;
            stats.rangeQty += qty;

            if (jDate.jy === jNow.jy) {
                stats.yearAmt += amt;
                stats.yearQty += qty;

                const qRow = Math.floor((jDate.jm - 1) / 3);
                const qNow = Math.floor((jNow.jm - 1) / 3);
                if (qRow === qNow) {
                    stats.quarterAmt += amt;
                    stats.quarterQty += qty;
                }

                if (jDate.jm === jNow.jm) {
                    stats.monthAmt += amt;
                    stats.monthQty += qty;

                    if (jDate.jd === jNow.jd) {
                        stats.todayAmt += amt;
                        stats.todayQty += qty;
                    }
                }
            }
        });`;

const newForEach = `        salesData.forEach(row => {
            const date = new Date(row.Date);
            const qty = parseFloat(row.Quantity || 0);
            const amt = parseFloat(row.Amount || 0);
            const isReturn = row.OpCode === '13';
            
            const jDate = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());

            if (isReturn) {
                stats.rangeRetAmt += amt;
                stats.rangeRetQty += qty;
            } else {
                stats.rangeAmt += amt;
                stats.rangeQty += qty;
            }

            if (jDate.jy === jNow.jy) {
                if (isReturn) {
                    stats.yearRetAmt += amt;
                    stats.yearRetQty += qty;
                } else {
                    stats.yearAmt += amt;
                    stats.yearQty += qty;
                }

                const qRow = Math.floor((jDate.jm - 1) / 3);
                const qNow = Math.floor((jNow.jm - 1) / 3);
                if (qRow === qNow) {
                    if (isReturn) {
                        stats.quarterRetAmt += amt;
                        stats.quarterRetQty += qty;
                    } else {
                        stats.quarterAmt += amt;
                        stats.quarterQty += qty;
                    }
                }

                if (jDate.jm === jNow.jm) {
                    if (isReturn) {
                        stats.monthRetAmt += amt;
                        stats.monthRetQty += qty;
                    } else {
                        stats.monthAmt += amt;
                        stats.monthQty += qty;
                    }

                    if (jDate.jd === jNow.jd) {
                        if (isReturn) {
                            stats.todayRetAmt += amt;
                            stats.todayRetQty += qty;
                        } else {
                            stats.todayAmt += amt;
                            stats.todayQty += qty;
                        }
                    }
                }
            }
        });`;

code = code.replace(oldForEach, newForEach);

fs.writeFileSync('components/AccountingReports.tsx', code);
console.log('patched stats');
