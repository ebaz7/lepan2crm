const { execSync } = require('child_process');
const fs = require('fs');

try {
  const original = execSync('git show HEAD:components/SayanReports.tsx', { encoding: 'utf8' });
  fs.writeFileSync('components/SayanReports.tsx', original);
  console.log('Restored from HEAD!');
} catch(e) {
  console.error(e);
}
