const fs = require('fs');
let content = fs.readFileSync('components/SayanReports.tsx', 'utf8');

// fix the unescaped newlines inside the TABLE_DICTIONARY values
// specifically around TBL_008
content = content.replace(/TBL_008': 'بانک ملت \| SETLENGTH\[COUNT\[\],10,0\]SETLENGTH\[SUM\[Pay\],15,0\]\nREPEAT->SETLENGTH/g, 
"TBL_008': 'بانک ملت | SETLENGTH[COUNT[],10,0]SETLENGTH[SUM[Pay],15,0] REPEAT->SETLENGTH");

// general pass: look for lines that have only single quotes starting and ending
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
   if (lines[i].includes("REPEAT->SETLENGTH")) {
       if (!lines[i].includes("': '")) {
           // this is the broken line
           lines[i-1] = lines[i-1].replace("'", "") + " " + lines[i];
           lines[i] = "";
       }
   }
}

fs.writeFileSync('components/SayanReports.tsx', lines.filter(l => l !== "").join('\n'));
