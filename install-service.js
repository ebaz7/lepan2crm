
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

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
const INSTALL_DIR = __dirname; 

// 1. We don't use runPreflightPatch anymore because hardcoding backslashes in elevated commands triggers a bug in node-windows elevate.cmd.
// 2. Now dynamically import node-windows safely
const { Service } = await import('node-windows');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log("---------------------------------------------------------");
console.log("   Payment System - Windows Service Installer (Roboust)  ");
console.log("---------------------------------------------------------");

rl.question('Enter Port (Default 80): ', (inputPort) => {
  const port = inputPort.trim() || '80';
  
  // NEW: Ask for Proxy
  rl.question('Enter Proxy URL (e.g., http://127.0.0.1:10809) or leave empty: ', (inputProxy) => {
      const proxy = inputProxy.trim();
      
      let envContent = `PORT=${port}\n`;
      if (proxy) envContent += `PROXY_URL=${proxy}\n`;

      fs.writeFileSync(path.join(INSTALL_DIR, '.env'), envContent);
      console.log('> Configuration saved.');

      const svc = new Service({
        name: 'PaymentSystem',
        description: 'Payment Order Management System Web Server',
        script: path.join(INSTALL_DIR, 'server.js'), 
        workingDirectory: INSTALL_DIR,
        env: [
            { name: "NODE_ENV", value: "production" },
            { name: "PORT", value: port },
            { name: "PUPPETEER_CACHE_DIR", value: path.join(INSTALL_DIR, '.puppeteer') },
            ...(proxy ? [{ name: "PROXY_URL", value: proxy }] : [])
        ]
      });

      svc.on('install', function() {
        console.log('> Service installed & started successfully!');
        svc.start();
      });

      svc.on('alreadyinstalled', function() {
        console.log('Service already installed. Starting...');
        svc.start(); 
      });

      svc.install();
  });
});
