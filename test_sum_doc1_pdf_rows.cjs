const fs = require('fs');

const doc1 = fs.readFileSync('doc1_full.txt', 'utf8');

// Let's analyze how doc1 lines are structured.
// In doc1, the text extracted by pdf-parse contains lines.
// Let's write a parser to extract item name, sales qty, sales vat, sales amt, return qty, return vat, return amt, net qty, net vat, net amt for each item in doc1!

const text = doc1;

// Let's inspect all page texts
console.log("Parsing PDF text...");
