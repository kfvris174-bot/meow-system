import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const shell = fs.readFileSync(path.join(root, 'src/shell.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const script = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

const html = shell
  .replace('/*__STYLES__*/', () => styles)
  .replace('/*__SCRIPT__*/', () => script);

fs.writeFileSync(path.join(root, 'meow-system.html'), html, 'utf8');
console.log(`built meow-system.html — ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
