const fs = require('fs');
const path = require('path');

function walkSync(dir, filelist) {
  var files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        filelist = walkSync(fullPath, filelist);
      }
    }
    else {
      if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
        filelist.push(fullPath);
      }
    }
  });
  return filelist;
}

const files = walkSync('.', []);
let count = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Also we want to ensure inner elements don't have max-h-[90vh] with overflow-y-auto that prevents them from opening fully if they have lots of content. Actually, the user complaint is: "either it opens zoomed in, or suddenly goes down and isn't visible, need to scroll".
  // Removing max-h-[90vh] and adding my-auto (or just letting it flow) works better when it's items-start.
  // Wait, if we use items-start, the modal must NOT have h-full or max-h if we want it to scroll with the page.
  
  content = content.replace(/className=([\"\'])([^\"\']*fixed inset-0[^\"\']*items-center[^\"\']*)\1/g, (match, quote, classes) => {
     let newClasses = classes.replace('items-center', 'items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden');
     return 'className=' + quote + newClasses + quote;
  });

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    count++;
  }
});
console.log('Modified ' + count + ' files.');
