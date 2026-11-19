/**
 * Ranh giới xã/phường (đã làm gọn, sai số khoảng 100 m) — chỉ để vẽ viền khu vực trên bản đồ.
 * Mỗi tỉnh một tệp /data/ranh-gioi/<mã tỉnh>.json: { "<mã xã>": [[[lng,lat],...], ...] }.
 * Nguồn: thanglequoc/vietnamese-provinces-database (MIT), theo sapnhap.bando.com.vn.
 */
type Rings = [number, number][][];
const cache: Record<string, Promise<Record<string, Rings>>> = {};

function loadProvince(code: string) {
  if (!cache[code]) {
    cache[code] = fetch('/data/ranh-gioi/' + code + '.json')
      .then(r => { if (!r.ok) throw new Error('Không tải được ranh giới'); return r.json(); })
      .catch(e => { delete cache[code]; throw e; });
  }
  return cache[code];
}

/** Trả về GeoJSON MultiPolygon của một xã/phường, hoặc null nếu không có. */
export async function wardShape(provinceCode: string, wardCode: string): Promise<any | null> {
  try {
    const rings = (await loadProvince(provinceCode))[wardCode];
    if (!rings?.length) return null;
    return { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: rings.map(r => [r]) } };
  } catch (_) { return null; }
}
