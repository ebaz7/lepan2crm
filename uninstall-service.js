
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// CRITICAL: Overwrite child_process.exec globally to intercept known executables (like winsw / paymentsystem.exe, net.exe, tasklist, etc.)
// and run them safely via child_process.execFile. This completely bypasses the Windows shell (cmd.exe)
// and prevents the legendary "Windows cannot find 'C:\Windows\System32'" error caused by shell quoting/COMSPEC bugs on some Windows setups.
import child_process from 'child_process';
const originalExec = child_process.exec;
child_process.exec = function(cmd, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  callback = callback || function() {};

  try {
    var cleanCmd = cmd.trim();
    var file = '';
    var argsStr = '';
    if (cleanCmd.charAt(0) === '"') {
      var closingQuoteIdx = cleanCmd.indexOf('"', 1);
      if (closingQuoteIdx !== -1) {
        file = cleanCmd.substring(1, closingQuoteIdx);
        argsStr = cleanCmd.substring(closingQuoteIdx + 1).trim();
      } else {
        file = cleanCmd;
      }
    } else {
      var firstSpaceIdx = cleanCmd.indexOf(' ');
      if (firstSpaceIdx !== -1) {
        file = cleanCmd.substring(0, firstSpaceIdx);
        argsStr = cleanCmd.substring(firstSpaceIdx + 1).trim();
      } else {
        file = cleanCmd;
      }
    }

    var args = [];
    if (argsStr) {
      var current = '';
      var inQuotes = false;
      for (var i = 0; i < argsStr.length; i++) {
        var char = argsStr.charAt(i);
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ' ' && !inQuotes) {
          if (current) {
            args.push(current);
            current = '';
          }
        } else {
          current += char;
        }
      }
      if (current) {
        args.push(current);
      }
    }

    var isKnownExecutable = /^[a-zA-Z]:\\/i.test(file) || /\.exe$/i.test(file) || ['net', 'net1', 'taskkill', 'tasklist', 'powershell', 'sc'].indexOf(file.toLowerCase()) !== -1;
    if (isKnownExecutable) {
      child_process.execFile(file, args, options, function(err, stdout, stderr) {
        if (err) {
          originalExec(cmd, options, callback);
        } else {
          callback(null, stdout, stderr);
        }
      });
    } else {
      originalExec(cmd, options, callback);
    }
  } catch (e) {
    originalExec(cmd, options, callback);
  }
};

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


