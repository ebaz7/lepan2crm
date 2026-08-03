import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

// CRITICAL FIX: If the user's Windows environment variables are corrupted (e.g. ComSpec is missing a backslash like C:\WindowsSystem32),
// it will cause ALL child_process.exec calls to pop up a "Windows cannot find..." alert box.
// We force the correct cmd.exe path here to bypass any corrupted environment variables.
const cmdPath = (process.env.SystemRoot || "C:\\Windows") + "\\System32\\cmd.exe";
process.env.ComSpec = cmdPath;
process.env.comspec = cmdPath;
process.env.COMSPEC = cmdPath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INSTALL_DIR = __dirname;

// Read config from .env if exists
dotenv.config();
const port = process.env.PORT || '3000';
const proxy = process.env.PROXY_URL || '';

console.log("---------------------------------------------------------");
console.log("   Payment System - Windows Service Installer            ");
console.log(`   Configured Port: ${port}`);
if (proxy) {
  console.log(`   Configured Proxy: ${proxy}`);
}
console.log("---------------------------------------------------------");

const { Service } = await import('node-windows');

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
  console.log('> Service installed successfully! Starting...');
  svc.start();
});

svc.on('alreadyinstalled', function() {
  console.log('Service already installed. Starting...');
  svc.start(); 
});

svc.install();
