// Các hàm máy chủ trong thư mục api/ (dùng chung cho Vercel và Cloudflare).
import feed from '../api/feed.js';
import og from '../api/og.js';
import sitemap from '../api/sitemap.js';

export default { feed, og, sitemap };
