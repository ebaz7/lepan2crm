const fs = require('fs');

const code = fs.readFileSync('components/Settings.tsx', 'utf8');

let i = 0;
let line = 1;
let col = 1;

let inComment = false; // 'line', 'block' or false
let inString = false; // '"', "'", "`" or false
let inRegex = false;

let stack = [];

function nextChar() {
    return code[i];
}

while (i < code.length) {
    let char = code[i];
    let next = code[i + 1];

    if (char === '\n') {
        line++;
        col = 1;
    } else {
        col++;
    }

    // Handle comments
    if (!inString && !inComment) {
        if (char === '/' && next === '/') {
            inComment = 'line';
            i += 2;
            continue;
        }
        if (char === '/' && next === '*') {
            inComment = 'block';
            i += 2;
            continue;
        }
    }
    if (inComment === 'line' && char === '\n') {
        inComment = false;
    }
    if (inComment === 'block' && char === '*' && next === '/') {
        inComment = false;
        i += 2;
        continue;
    }
    if (inComment) {
        i++;
        continue;
    }

    // Handle strings
    if (!inString) {
        if (char === '"' || char === "'" || char === '`') {
            inString = char;
            i++;
            continue;
        }
    } else {
        if (char === inString && code[i - 1] !== '\\') {
            inString = false;
            i++;
            continue;
        }
        i++;
        continue;
    }

    // Look for JSX tags
    if (char === '<' && !/[0-9\s=\-]/.test(next)) {
        // Could be a tag
        let tagEnd = code.indexOf('>', i);
        if (tagEnd !== -1) {
            let tagContent = code.substring(i + 1, tagEnd).trim();
            // Check if it's a comment
            if (tagContent.startsWith('!--')) {
                i = tagEnd + 1;
                continue;
            }
            // Check if it's a closing tag
            let isClosing = tagContent.startsWith('/');
            let isSelfClosing = tagContent.endsWith('/') || tagContent.startsWith('input') || tagContent.startsWith('img') || tagContent.startsWith('br') || tagContent.startsWith('hr');
            
            let tagName = '';
            if (isClosing) {
                tagName = tagContent.substring(1).trim().split(/[\s>]/)[0];
            } else {
                tagName = tagContent.trim().split(/[\s>]/)[0];
            }
            // Clean tag name from trailing slash
            if (tagName.endsWith('/')) {
                tagName = tagName.slice(0, -1);
                isSelfClosing = true;
            }

            // Ignore fragment shorthand <></>
            if (tagName === '') {
                tagName = 'fragment';
            }

            if (!isSelfClosing) {
                if (isClosing) {
                    let popped = stack.pop();
                    if (popped && popped.name !== tagName) {
                        console.log(`Mismatch at line ${line}, col ${col}: expected </${popped.name}> (opened at line ${popped.line}), found </${tagName}>`);
                        // Put it back to keep tracking
                        stack.push(popped);
                    } else if (!popped) {
                        console.log(`Unexpected closing tag </${tagName}> at line ${line}, col ${col} with empty stack`);
                    }
                } else {
                    stack.push({ name: tagName, line, col });
                }
            }
            i = tagEnd + 1;
            continue;
        }
    }

    i++;
}

console.log('Finished parsing. Stack length:', stack.length);
if (stack.length > 0) {
    console.log('Unclosed tags in stack:');
    for (let t of stack) {
        console.log(`- <${t.name}> opened at line ${t.line}, col ${t.col}`);
    }
}
