#!/usr/bin/env bash
# Đưa quy tắc, chỉ mục và chức năng máy chủ lên Firebase — chạy trong Google Cloud Shell, KHÔNG cần dán mã đăng nhập.
# Lần đầu: tạo "máy triển khai" (tài khoản dịch vụ) trong dự án và lưu khoá ở thư mục riêng của Cloud Shell
# (~/.khoa-trien-khai.json, không bao giờ đưa lên GitHub). Các lần sau dùng lại.
# Cách dùng: bash scripts/tk.sh
set -e
cd "$(dirname "$0")/.."
P=chocuatui-3e65c
SA=may-trien-khai@$P.iam.gserviceaccount.com
KEY="$HOME/.khoa-trien-khai.json"

git pull --ff-only || true
gcloud config set project $P -q >/dev/null 2>&1 || true

if [ ! -f "$KEY" ]; then
  echo "== Lần đầu: tạo máy triển khai (nếu hiện hộp 'Authorize Cloud Shell' thì bấm Authorize) =="
  gcloud iam service-accounts describe $SA >/dev/null 2>&1 || \
    gcloud iam service-accounts create may-trien-khai --display-name="May trien khai Cho Cua Tui"
  for R in roles/editor roles/firebase.admin roles/iam.serviceAccountUser roles/cloudfunctions.admin roles/run.admin roles/firebaserules.admin; do
    gcloud projects add-iam-policy-binding $P --member="serviceAccount:$SA" --role="$R" --condition=None -q >/dev/null
    echo "  đã cấp quyền $R"
  done
  gcloud iam service-accounts keys create "$KEY" --iam-account=$SA
  chmod 600 "$KEY"
  echo "  chờ 60 giây cho quyền có hiệu lực…"
  sleep 60
fi
export GOOGLE_APPLICATION_CREDENTIALS="$KEY"

echo "== Cài thư viện cho chức năng máy chủ =="
(cd functions && npm install --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund)

FB="npx -y firebase-tools"
command -v firebase >/dev/null 2>&1 && FB="firebase"
echo "== Đưa lên Firebase =="
$FB deploy --only firestore,functions --project $P --force --non-interactive
echo ""
echo "XONG! Đã đưa lên Firebase."
