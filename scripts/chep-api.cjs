// Chép các hàm máy chủ trong api/ vào functions/web-api/ trước khi đưa Cloud Functions lên
// (Firebase chỉ tải thư mục functions/ lên máy chủ).
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'api');
const dst = path.join(__dirname, '..', 'functions', 'web-api');
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
fs.writeFileSync(path.join(dst, 'package.json'), JSON.stringify({ type: 'module' }) + '\n');
const names = [];
for (const f of fs.readdirSync(src)) {
  if (!f.endsWith('.js')) continue;
  fs.copyFileSync(path.join(src, f), path.join(dst, f));
  if (!f.startsWith('_')) names.push(f.replace(/\.js$/, ''));
}
fs.writeFileSync(path.join(dst, 'danh-sach.json'), JSON.stringify(names) + '\n');
console.log('Đã chép ' + names.length + ' hàm: ' + names.join(', '));
