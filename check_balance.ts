
import fs from 'fs';
const content = fs.readFileSync('./components/MeetingModule.tsx', 'utf8');
const lines = content.split('\n');

let openDivs = 0;
let openBraces = 0;
let openParens = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // This is super naive but might help
    const divs = (line.match(/<div/g) || []).length;
    const closeDivs = (line.match(/<\/div/g) || []).length;
    const braces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    const parens = (line.match(/\(/g) || []).length;
    const closeParens = (line.match(/\)/g) || []).length;

    openDivs += divs - closeDivs;
    openBraces += braces - closeBraces;
    openParens += parens - closeParens;

    if (i > 340 && i < 450) {
        console.log(`${i + 1}: D:${openDivs} B:${openBraces} P:${openParens} | ${line.trim()}`);
    }
}
