const fs = require('fs');
let code = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

const oldFunc = `    const getComparisonChartData = () => {
        const groups: { [key: string]: { name: string; amountA: number; weightA: number; amountB: number; weightB: number; } } = {};

        compareSalesDataA.forEach(row => {
            const grp = row.GroupName || 'سایر گروه‌ها';
            if (!groups[grp]) {
                groups[grp] = { name: grp, amountA: 0, weightA: 0, amountB: 0, weightB: 0 };
            }
            groups[grp].amountA += parseFloat(row.Amount || 0);
            groups[grp].weightA += parseFloat(row.Quantity || 0);
        });

        compareSalesDataB.forEach(row => {
            const grp = row.GroupName || 'سایر گروه‌ها';
            if (!groups[grp]) {
                groups[grp] = { name: grp, amountA: 0, weightA: 0, amountB: 0, weightB: 0 };
            }
            groups[grp].amountB += parseFloat(row.Amount || 0);
            groups[grp].weightB += parseFloat(row.Quantity || 0);
        });

        return Object.values(groups);
    };`;

const newFunc = `    const getComparisonChartData = () => {
        const groups: { [key: string]: { 
            name: string; 
            amountA: number; weightA: number; retAmountA: number; retWeightA: number; netAmountA: number; netWeightA: number;
            amountB: number; weightB: number; retAmountB: number; retWeightB: number; netAmountB: number; netWeightB: number;
        } } = {};

        const initGroup = (grp: string) => {
            if (!groups[grp]) {
                groups[grp] = { 
                    name: grp, 
                    amountA: 0, weightA: 0, retAmountA: 0, retWeightA: 0, netAmountA: 0, netWeightA: 0,
                    amountB: 0, weightB: 0, retAmountB: 0, retWeightB: 0, netAmountB: 0, netWeightB: 0
                };
            }
        };

        compareSalesDataA.forEach(row => {
            const grp = row.GroupName || 'سایر گروه‌ها';
            initGroup(grp);
            const amt = parseFloat(row.Amount || 0);
            const qty = parseFloat(row.Quantity || 0);
            if (row.OpCode === '13') {
                groups[grp].retAmountA += amt;
                groups[grp].retWeightA += qty;
                groups[grp].netAmountA -= amt;
                groups[grp].netWeightA -= qty;
            } else {
                groups[grp].amountA += amt;
                groups[grp].weightA += qty;
                groups[grp].netAmountA += amt;
                groups[grp].netWeightA += qty;
            }
        });

        compareSalesDataB.forEach(row => {
            const grp = row.GroupName || 'سایر گروه‌ها';
            initGroup(grp);
            const amt = parseFloat(row.Amount || 0);
            const qty = parseFloat(row.Quantity || 0);
            if (row.OpCode === '13') {
                groups[grp].retAmountB += amt;
                groups[grp].retWeightB += qty;
                groups[grp].netAmountB -= amt;
                groups[grp].netWeightB -= qty;
            } else {
                groups[grp].amountB += amt;
                groups[grp].weightB += qty;
                groups[grp].netAmountB += amt;
                groups[grp].netWeightB += qty;
            }
        });

        return Object.values(groups);
    };`;

code = code.replace(oldFunc, newFunc);
fs.writeFileSync('components/AccountingReports.tsx', code);
console.log('patched compare data');
