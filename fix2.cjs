const fs = require('fs');

const sayanPath = 'components/SayanReports.tsx';
let content = fs.readFileSync(sayanPath, 'utf8');

// I will just replace any newline inside a string using a regex or simple split.
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
   if (lines[i].includes("TBL_008': 'بانک ملت")) {
       lines[i] = "  'TBL_008': 'بانک ملت',";
   } else if (lines[i].includes("dbo.TBL_008': 'بانک ملت")) {
       lines[i] = "  'dbo.TBL_008': 'بانک ملت',";
   } else if (lines[i].includes("REPEAT->SETLENGTH")) {
       lines[i] = ""; // remove the dangling line
   }
}

fs.writeFileSync(sayanPath, lines.join('\n'));
