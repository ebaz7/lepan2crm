const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

if (!content.includes("import { Toaster } from 'react-hot-toast';")) {
    content = content.replace("import React, {", "import { Toaster } from 'react-hot-toast';\nimport React, {");
}

if (!content.includes("<Toaster position=")) {
    content = content.replace("<AnimatePresence>", "<Toaster position=\"bottom-center\" toastOptions={{ duration: 4000, style: { zIndex: 9999999 } }} />\n        <AnimatePresence>");
}

fs.writeFileSync('App.tsx', content, 'utf8');
console.log('App.tsx patched for Toaster!');
