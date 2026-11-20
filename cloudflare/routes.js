// Các hàm máy chủ trong thư mục api/ (dùng chung cho Vercel và Cloudflare).
import feed from '../api/feed.js';
import og from '../api/og.js';
import sitemap from '../api/sitemap.js';
import anh from '../api/anh.js';
import xa from '../api/xa.js';
import vinhdanh from '../api/vinhdanh.js';

export default { feed, og, sitemap, anh, xa, vinhdanh };
