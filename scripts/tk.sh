#!/usr/bin/env bash
# Đưa quy tắc, chỉ mục và chức năng máy chủ lên Firebase (chạy trong Cloud Shell hoặc máy tính).
# Cách dùng: bash scripts/tk.sh
set -e
cd "$(dirname "$0")/.."
git pull --ff-only || true
echo "== Cài thư viện cho chức năng máy chủ =="
(cd functions && npm install --no-audit --no-fund)
echo "== Đưa lên Firebase =="
if ! npx -y firebase-tools deploy --only firestore,functions --project chocuatui-3e65c --force --non-interactive; then
  echo ""
  echo "== Cần đăng nhập Firebase: mở đường link bên dưới, đăng nhập, rồi dán mã vào đây =="
  npx -y firebase-tools login --no-localhost
  npx -y firebase-tools deploy --only firestore,functions --project chocuatui-3e65c --force --non-interactive
fi
echo ""
echo "XONG! Đã đưa lên Firebase."
