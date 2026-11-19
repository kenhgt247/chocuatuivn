#!/usr/bin/env bash
# Đưa quy tắc, chỉ mục và chức năng máy chủ lên Firebase (chạy trong Cloud Shell hoặc máy tính).
# Cách dùng: bash scripts/tk.sh
set -e
cd "$(dirname "$0")/.."
git pull --ff-only || true
echo "== Cài thư viện cho chức năng máy chủ =="
(cd functions && npm install --no-audit --no-fund)
# Cloud Shell có sẵn lệnh firebase: dùng luôn cho nhanh
FB="npx -y firebase-tools"
command -v firebase >/dev/null 2>&1 && FB="firebase"
echo "== Đưa lên Firebase ($FB) =="
if ! $FB deploy --only firestore,functions --project chocuatui-3e65c --force --non-interactive; then
  echo ""
  echo "== Cần đăng nhập Firebase: mở đường link bên dưới, đăng nhập, rồi dán mã vào đây =="
  $FB login --no-localhost
  $FB deploy --only firestore,functions --project chocuatui-3e65c --force --non-interactive
fi
echo ""
echo "XONG! Đã đưa lên Firebase."
