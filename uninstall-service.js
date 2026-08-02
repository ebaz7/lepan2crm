
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Run the patch synchronously BEFORE we import node-windows dynamically!
function runPreflightPatch() {
  try {
    const daemonPath = path.join(__dirname, 'node_modules/node-windows/lib/daemon.js');
    if (fs.existsSync(daemonPath)) {
      let content = fs.readFileSync(daemonPath, 'utf8');
      let modified = false;
      if (content.includes("NET START")) {
        content = content.replaceAll("NET START", "C:\\Windows\\System32\\net.exe START");
        modified = true;
      }
      if (content.includes("NET STOP")) {
        content = content.replaceAll("NET STOP", "C:\\Windows\\System32\\net.exe STOP");
        modified = true;
      }
      if (modified) {
        fs.writeFileSync(daemonPath, content, 'utf8');
        console.log('✅ node-windows system commands successfully patched.');
      }
    }

    const cmdPath = path.join(__dirname, 'node_modules/node-windows/lib/cmd.js');
    if (fs.existsSync(cmdPath)) {
      let content = fs.readFileSync(cmdPath, 'utf8');
      let modified = false;
      if (content.includes("NET SESSION")) {
        content = content.replaceAll("NET SESSION", "C:\\Windows\\System32\\net.exe SESSION");
        modified = true;
      }
      if (modified) {
        fs.writeFileSync(cmdPath, content, 'utf8');
      }
    }
  } catch (e) {
    console.error('Pre-flight patch error:', e);
  }
}

runPreflightPatch();

// 2. Now dynamically import node-windows safely
const { Service } = await import('node-windows');

const svc = new Service({
  name: 'PaymentSystem',
  script: path.join(__dirname, 'server.js')
});

svc.on('uninstall', function() {
  console.log('✅ سرویس با موفقیت غیرفعال و حذف شد (Service uninstalled successfully).');
});

svc.on('alreadyuninstalled', function() {
  console.log('سرویس قبلاً حذف شده است.');
});

svc.on('error', function(err) {
  console.log('خطا در حذف سرویس:', err);
});

console.log('در حال حذف سرویس PaymentSystem...');
svc.uninstall();


