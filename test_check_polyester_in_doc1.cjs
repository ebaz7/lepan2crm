const fs = require('fs');

const doc1 = fs.readFileSync('doc1_full.txt', 'utf8');

console.log("=== Searching for 'پلی استر' in doc1_full.txt ===");
const lines = doc1.split('\n');
lines.forEach(l => {
  if (l.includes('پلی استر')) {
    console.log(l);
  }
});
