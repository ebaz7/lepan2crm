const fs = require('fs');
const code = fs.readFileSync('components/SayanReports.tsx', 'utf8');
if (code.includes('matchedDetails = detailsList.slice(startIdx, startIdx + itemsPerDoc);')) {
  console.log("Mock fallback logic is present!");
}
