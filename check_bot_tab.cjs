const fs = require('fs');
const code = fs.readFileSync('components/Settings.tsx', 'utf8');
const lines = code.split('\n');

let stack = [];
for (let lineNum = 3608; lineNum <= 5076; lineNum++) {
    let lineText = lines[lineNum - 1];
    let i = 0;
    while (i < lineText.length) {
        if (lineText[i] === '<' && lineText[i+1] !== '!' && lineText[i+1] !== '/' && !/[0-9\s=\-]/.test(lineText[i+1])) {
            let end = lineText.indexOf('>', i);
            if (end !== -1) {
                let content = lineText.substring(i + 1, end).trim();
                let name = content.split(/[\s>]/)[0];
                let isSelfClosing = content.endsWith('/') || ['input', 'img', 'br', 'hr', 'link', 'meta'].includes(name);
                if (!isSelfClosing) {
                    stack.push({ name, line: lineNum });
                }
                i = end + 1;
                continue;
            }
        }
        if (lineText[i] === '<' && lineText[i+1] === '/') {
            let end = lineText.indexOf('>', i);
            if (end !== -1) {
                let name = lineText.substring(i + 2, end).trim().split(/[\s>]/)[0];
                if (stack.length > 0) {
                    let top = stack[stack.length - 1];
                    if (top.name === name) {
                        stack.pop();
                    } else {
                        console.log(`Mismatch at line ${lineNum}: found </${name}> but top of stack is <${top.name}> (opened at line ${top.line})`);
                        stack.pop(); // try to recover
                    }
                } else {
                    console.log(`Unexpected closing tag </${name}> at line ${lineNum} with empty stack`);
                }
                i = end + 1;
                continue;
            }
        }
        i++;
    }
}

console.log('Remaining unclosed tags in bot tab:');
for (let tag of stack) {
    console.log(`- <${tag.name}> opened at line ${tag.line}`);
}
