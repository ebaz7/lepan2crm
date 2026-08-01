import fs from 'fs';
const text = fs.readFileSync('backend/bot-core.js', 'utf8');
let openBraces = 0;
let openParens = 0;
let openBrackets = 0;
let inString = null;
let escape = false;

for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (escape) {
        escape = false;
        continue;
    }
    if (char === '\\') {
        escape = true;
        continue;
    }
    if (inString) {
        if (char === inString) inString = null;
        continue;
    }
    if (char === '"' || char === "'" || char === '`') {
        inString = char;
        continue;
    }
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '(') openParens++;
    if (char === ')') openParens--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
    
    if (openBraces < 0 || openParens < 0 || openBrackets < 0) {
        console.log(`Mismatch at index ${i}: Char=${char}, Braces=${openBraces}, Parens=${openParens}, Brackets=${openBrackets}`);
        // Log some context
        console.log(text.substring(i - 50, i + 50));
    }
}
console.log(`Final: Braces=${openBraces}, Parens=${openParens}, Brackets=${openBrackets}`);
