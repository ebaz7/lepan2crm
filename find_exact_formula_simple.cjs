const target = 43924.26;

// Core DocType sums for 1404 from rubber transactions (ItemCode starting with 0104)
const docTypes = {
    '10': 37733.88,
    '12': 5111.14,
    '23': 5123.77,
    '62': 65.90,
    '68': 434.77,
    '71': 28.35,
    '74': 2191.02,
    '80': 60928.94,
    '83': 2519.69,
    '84': 4390.56
};

const keys = Object.keys(docTypes);
const numDocs = keys.length;

function search(index, currentSum, formula) {
    if (index === numDocs) {
        const diff = Math.abs(currentSum - target);
        if (diff < 0.1) {
            console.log(`FOUND! Sum = ${currentSum} (diff = ${diff})`);
            console.log("Formula:", JSON.stringify(formula));
        }
        return;
    }

    const key = keys[index];
    const val = docTypes[key];

    // Try coefficient -1
    formula[key] = -1;
    search(index + 1, currentSum - val, formula);

    // Try coefficient 0
    formula[key] = 0;
    search(index + 1, currentSum, formula);

    // Try coefficient 1
    formula[key] = 1;
    search(index + 1, currentSum + val, formula);
}

search(0, 0, {});
