const fs = require('fs');
let code = fs.readFileSync('components/reports/WarehouseKardexReport.tsx', 'utf8');

const target = `        // 2. Compute running balance chronologically across ALL transactions
        let currentBalance = 0;
        const txsWithBalance = itemTxs.map(tx => {
            const txItem = tx.items.find(i => i.itemId === selectedItem);
            const qty = txItem ? txItem.quantity : 0;
            const weight = txItem ? txItem.weight : 0;
            const unitPrice = txItem ? txItem.unitPrice : 0;

            if (tx.type === 'IN') {
                currentBalance += qty;
            } else {
                currentBalance -= qty;
            }

            return {
                tx,
                qty,
                weight,
                unitPrice,
                balanceAtThisPoint: currentBalance
            };
        });`;

const replacement = `        // 2. Compute running balance chronologically across ALL transactions
        let currentBalance = 0;
        const txsWithBalance = itemTxs.flatMap(tx => {
            const matchingItems = tx.items.filter(i => i.itemId === selectedItem);
            return matchingItems.map((txItem, idx) => {
                const qty = txItem ? txItem.quantity : 0;
                const weight = txItem ? txItem.weight : 0;
                const unitPrice = txItem ? txItem.unitPrice : 0;

                if (tx.type === 'IN') {
                    currentBalance += qty;
                } else {
                    currentBalance -= qty;
                }

                return {
                    tx,
                    txItemId: tx.id + '_' + idx,
                    qty,
                    weight,
                    unitPrice,
                    balanceAtThisPoint: currentBalance
                };
            });
        });`;

code = code.replace(target, replacement);

const target2 = `                    visibleRows.push({
                        id: tx.id,`;
const repl2 = `                    visibleRows.push({
                        id: item.txItemId,`;

code = code.replace(target2, repl2);

fs.writeFileSync('components/reports/WarehouseKardexReport.tsx', code);
console.log('patched');
