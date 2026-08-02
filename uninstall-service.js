
import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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


