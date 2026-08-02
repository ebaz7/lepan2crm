
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. We don't use runPreflightPatch anymore because hardcoding backslashes in elevated commands triggers a bug in node-windows elevate.cmd.
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


