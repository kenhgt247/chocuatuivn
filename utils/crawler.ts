// src/utils/crawler.ts

export const crawlLinkMetadata = async (url: string) => {
  try {
    if (!url.startsWith('http')) {
        return { success: false, error: "Link không hợp lệ." };
    }

    // 1. Xác định Nguồn (Brand)
    let brand = "Website khác";
    if (url.includes("shopee")) brand = "Shopee";
    else if (url.includes("lazada")) brand = "Lazada";
    else if (url.includes("tiki")) brand = "Tiki";
    else if (url.includes("tiktok")) brand = "TikTok Shop";
    else if (url.includes("sendo")) brand = "Sendo";
    else if (url.includes("youtube")) brand = "Youtube";

    console.log(`🕷 Đang thử cào dữ liệu từ ${brand}:`, url);

    // 2. DANH SÁCH PROXY DỰ PHÒNG (Thử lần lượt)
    // Cách này giúp nếu Proxy A chết thì dùng Proxy B
    const proxies = [
        { 
            name: "CORSProxy", 
            getUrl: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
            type: 'text' // Trả về HTML trực tiếp
        },
        { 
            name: "AllOrigins", 
            getUrl: (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
            type: 'json' // Trả về JSON { contents: "html..." }
        }
    ];

    let htmlContent = "";
    let fetchSuccess = false;

    // 3. CHẠY VÒNG LẶP THỬ PROXY
    for (const proxy of proxies) {
        try {
            console.log(`Trying proxy: ${proxy.name}...`);
            const response = await fetch(proxy.getUrl(url));
            
            if (response.ok) {
                if (proxy.type === 'json') {
                    const json = await response.json();
                    if (json.contents) {
                        htmlContent = json.contents;
                        fetchSuccess = true;
                        break; // Thành công -> Thoát vòng lặp
                    }
                } else {
                    htmlContent = await response.text();
                    if (htmlContent && htmlContent.length > 100) {
                        fetchSuccess = true;
                        break; // Thành công -> Thoát vòng lặp
                    }
                }
            }
        } catch (err) {
            console.warn(`Proxy ${proxy.name} failed.`, err);
            // Thất bại -> Tự động chuyển sang proxy tiếp theo trong vòng lặp
        }
    }

    if (!fetchSuccess || !htmlContent) {
        throw new Error("Không thể kết nối qua các cổng Proxy.");
    }

    // 4. PHÂN TÍCH HTML (PARSING)
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    // Lấy Title (Ưu tiên OG -> Twitter -> Title thẻ)
    let title = 
        doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || 
        doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || 
        doc.querySelector('title')?.textContent || 
        "";

    // Lấy Image (Ưu tiên OG -> Twitter -> Link Rel)
    let image = 
        doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || 
        doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || 
        doc.querySelector('link[rel="image_src"]')?.getAttribute('href') || 
        "";

    // Tìm trong JSON-LD (Dữ liệu cấu trúc)
    if (!image || !title) {
        const scriptTags = doc.querySelectorAll('script[type="application/ld+json"]');
        scriptTags.forEach(script => {
            try {
                const json = JSON.parse(script.textContent || '{}');
                if (json['@type'] === 'Product' || json['@type'] === 'ItemPage') {
                    if (!image && json.image) {
                        image = Array.isArray(json.image) ? json.image[0] : json.image;
                    }
                    if (!title && json.name) {
                        title = json.name; 
                    }
                }
            } catch (e) { }
        });
    }

    // Fix link ảnh tương đối (nếu có)
    if (image && image.startsWith('//')) {
        image = 'https:' + image;
    }

    if (!title && !image) {
        return { success: false, error: "Trang web chặn bot. Vui lòng nhập thủ công." };
    }

    return { 
        success: true, 
        data: { 
            title: title.trim(), 
            image, 
            url,
            brand 
        } 
    };

  } catch (error: any) {
    console.error("Crawler error:", error);
    return { success: false, error: error.message };
  }
};