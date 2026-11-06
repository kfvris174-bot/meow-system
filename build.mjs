import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const shell = fs.readFileSync(path.join(root, 'src/shell.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const script = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

// 背景照片内联进单文件：线上 nginx 只放行 meow-system.html，外部图片会 404
let stylesWithBg = styles;
try {
  const bg = fs.readFileSync(path.join(root, 'src/bg.jpg'));
  const dataUri = `data:image/jpeg;base64,${bg.toString('base64')}`;
  if (styles.includes('__BG_DATA__')) {
    stylesWithBg = styles.replace('__BG_DATA__', () => dataUri);
  }
} catch (error) {
  console.warn('bg.jpg 缺失，背景层将留空');
  stylesWithBg = styles.replace('__BG_DATA__', () => 'none');
}

const html = shell
  .replace('/*__STYLES__*/', () => stylesWithBg)
  .replace('/*__SCRIPT__*/', () => script);

fs.writeFileSync(path.join(root, 'meow-system.html'), html, 'utf8');
console.log(`built meow-system.html — ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
