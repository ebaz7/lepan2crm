
import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INSTALL_DIR = __dirname; 

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
