import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// CRITICAL FIX: If the user's Windows environment variables are corrupted (e.g. ComSpec is missing a backslash like C:\WindowsSystem32),
// it will cause ALL child_process.exec calls to pop up a "Windows cannot find..." alert box.
// We force the correct cmd.exe path here to bypass any corrupted environment variables.
const cmdPath = (process.env.SystemRoot || "C:\\Windows") + "\\System32\\cmd.exe";
process.env.ComSpec = cmdPath;
process.env.comspec = cmdPath;
process.env.COMSPEC = cmdPath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
