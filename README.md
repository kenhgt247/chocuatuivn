# Chợ Của Tui — cộng đồng chia sẻ miễn phí

Có gì chia sẻ, cần gì có nhau: **Cho tặng · Mượn đồ · Giúp nhau · Sửa đồ**. Không VIP, không ví tiền, không thu phí.

- Web: https://chocuatuivn.vercel.app
- Công nghệ: React + Vite + Tailwind, Firebase (Auth, Firestore, Storage, Cloud Messaging), bản đồ Leaflet/OSM.

## Bản rao vặt cũ
Toàn bộ mã rao vặt (ví tiền, VIP, đấu giá, đẩy tin, thanh toán) được lưu nguyên vẹn ở nhánh
`luu-tru-rao-vat-2026-11`. Dữ liệu cũ trên Firestore **không bị xóa**. Link cũ `/san-pham/...` tự chuyển sang trang tin cộng đồng.

## Chạy thử trên máy
```
npm ci --legacy-peer-deps
npm run dev
```

## Phát hành
Xem `COMMUNITY_DEPLOY.md`. Sau khi gộp code, nhớ phát hành quy tắc bảo mật:
`firebase deploy --only firestore:rules,storage --project <project-id>`
