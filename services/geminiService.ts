import { GoogleGenAI } from "@google/genai";

// ==========================================================================
// 1. DATA INTERFACES (Standardized for your App)
// ==========================================================================
export interface ListingAnalysis {
  category: string;
  title: string;
  description: string;
  suggestedPrice: number;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  
  pricingStrategy: {
    min: number;
    max: number;
    fastSell: number;    // Quick sale price (10-15% lower)
    suggested: number;   // Market price
    highProfit: number;  // High profit price (10-15% higher)
    marketAnalysis: string;
  };

  qualityCheck: {
    score: number;
    tips: string;
    issues: string[];
  };

  seoTags: string[];
  keySellingPoints: string[];
  attributes: Record<string, any>; // Stores brand, color, origin, etc.
  
  isProhibited: boolean;
  prohibitedReason?: string;
}

// SYSTEM CATEGORY LIST (Must map exactly to your Database)
const CATEGORY_MAP_PROMPT = `
SELECT EXACTLY ONE SLUG FROM THIS LIST:
- Real Estate: 'can-ho-chung-cu', 'nha-o', 'dat', 'phong-tro', 'van-phong'
- Vehicles: 'o-to', 'xe-may', 'xe-dien', 'xe-tai', 'xe-dap', 'phu-tung-xe'
- Electronics: 'dien-thoai', 'may-tinh-bang', 'laptop', 'may-tinh-de-ban', 'may-anh', 'tivi-am-thanh', 'thiet-bi-thong-minh', 'phu-kien-dt', 'linh-kien'
- Jobs: 'ban-hang', 'nhan-vien-phuc-vu', 'tai-xe-giao-hang', 'tap-vu', 'pha-che', 'phu-bep', 'nhan-vien-kinh-doanh', 'cong-nhan', 'bao-ve'
- Pets: 'ga', 'cho', 'chim', 'meo', 'thu-cung-khac', 'phu-kien-thu-cung'
- Appliances: 'tu-lanh', 'may-lanh', 'may-giat', 'dien-lanh-khac'
- Furniture & Household: 'ban-ghe', 'tu-ke', 'giuong-nem', 'bep-lo', 'dung-cu-bep', 'cay-canh'
- Fashion: 'quan-ao', 'dong-ho', 'giay-dep', 'tui-xach', 'nuoc-hoa', 'phu-kien-thoi-trang'
- Entertainment & Sports: 'nhac-cu', 'sach', 'do-the-thao', 'suu-tam', 'so-thich-khac'
- Mom & Baby: 'me-va-be', 'do-choi'
- Services: 'dich-vu-don-nha', 'dich-vu-chuyen-nha', 'dich-vu-sua-chua'
- Other: 'khac'
`;

const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || "";
};

// --- HELPER FUNCTIONS FOR SAFETY ---

const safeGetText = (response: any): string => {
  try {
    if (typeof response.text === 'function') return response.text();
    // Handle nested data structure of new Google SDK
    if (response.candidates?.[0]?.content?.parts?.[0]?.text) 
        return response.candidates[0].content.parts[0].text;
    return ""; 
  } catch (e) {
    console.error("Error reading AI text:", e);
    return "";
  }
};

const cleanJson = (text: string): string => {
  if (!text) return "";
  // Remove extra markdown characters to avoid JSON.parse errors
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// ==========================================================================
// 2. API CALL FUNCTIONS (PRO VIP LOGIC)
// ==========================================================================

// FUNCTION 1: PRODUCT SEARCH (Fast identification)
export const identifyProductForSearch = async (imageBase64: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
    
    // Using gemini-2.0-flash-exp as it's proven stable for you
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', 
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: "Return exactly one concise keyword phrase to search for this product in Vietnam. Example: 'iPhone 14 Pro Max', 'Honda Vision'. No punctuation." }
        ]
      }]
    });

    return safeGetText(response).trim().toLowerCase();
  } catch (error) {
    return "";
  }
};

// FUNCTION 2: LISTING ANALYSIS (Smart Pro Logic)
export const analyzeListingImages = async (imagesBase64: string[]): Promise<ListingAnalysis> => {
  const apiKey = getApiKey();
  
  // Safe default data
  const defaultData: ListingAnalysis = { 
    title: '', description: '', category: 'khac', suggestedPrice: 0, 
    condition: 'good', isProhibited: false, attributes: {}, seoTags: [],
    pricingStrategy: { min: 0, max: 0, fastSell: 0, suggested: 0, highProfit: 0, marketAnalysis: '' },
    qualityCheck: { score: 50, tips: 'Need clearer photos', issues: [] }, keySellingPoints: []
  };

  if (!apiKey) return defaultData;

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const imageParts = imagesBase64.map(base64 => ({
      inlineData: {
        data: base64.split(',')[1] || base64,
        mimeType: "image/jpeg",
      },
    }));

    const prompt = `
    Role: You are Vietnam's #1 Second-hand Appraisal Expert & Copywriter.
    Task: Analyze product images to create a professional sales listing.

    MANDATORY REASONING PROCESS:
    1. Identify the main object.
    2. Determine the EXACT Category Slug from the provided list (e.g., see TV -> must choose 'tivi-am-thanh').
    3. Estimate actual value in the Vietnamese second-hand market (VND).

    OUTPUT REQUIREMENTS (JSON):
    - category: Select 1 slug from the list below.
    - suggestedPrice: Average market price (Integer, > 0).
    - fastSell: Quick sale price (10-15% lower).
    - highProfit: High profit price (10-15% higher).
    - title: Catchy title, includes Product Name + Condition.
    - description: Detailed description, bullet points, highlighting pros.
    - attributes: Extract specs (Brand, Color, Capacity...).

    STANDARD CATEGORY LIST:
    ${CATEGORY_MAP_PROMPT}
    `;

    // Using gemini-2.0-flash-exp as it works with your setup and is very capable
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', 
      contents: [
        { role: 'user', parts: [...imageParts, { text: prompt }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT", // Using String "OBJECT" for new SDK standard
          properties: {
            isProhibited: { type: "BOOLEAN" },
            prohibitedReason: { type: "STRING" },
            category: { type: "STRING" },
            title: { type: "STRING" },
            description: { type: "STRING" },
            suggestedPrice: { type: "NUMBER" },
            
            pricingStrategy: {
              type: "OBJECT",
              properties: {
                min: { type: "NUMBER" },
                max: { type: "NUMBER" },
                fastSell: { type: "NUMBER" },
                suggested: { type: "NUMBER" },
                highProfit: { type: "NUMBER" },
                marketAnalysis: { type: "STRING" }
              }
            },
            
            condition: { type: "STRING", enum: ['new', 'like_new', 'good', 'fair', 'poor'] },
            
            qualityCheck: {
              type: "OBJECT",
              properties: {
                score: { type: "NUMBER" },
                tips: { type: "STRING" },
                issues: { type: "ARRAY", items: { type: "STRING" } }
              }
            },
            
            keySellingPoints: { type: "ARRAY", items: { type: "STRING" } },
            seoTags: { type: "ARRAY", items: { type: "STRING" } },
            
            attributes: {
              type: "OBJECT",
              properties: {
                brand: { type: "STRING" },
                model: { type: "STRING" },
                year: { type: "STRING" },
                origin: { type: "STRING" },
                color: { type: "STRING" },
                capacity: { type: "STRING" },
                status_detail: { type: "STRING" },
                warranty: { type: "STRING" }
              }
            }
          },
          required: ["title", "category", "suggestedPrice", "description", "condition", "pricingStrategy"]
        }
      }
    });

    const rawText = safeGetText(response);
    const jsonText = cleanJson(rawText);

    if (!jsonText) return defaultData;
    
    // Final parse and validation
    const result = JSON.parse(jsonText) as ListingAnalysis;
    
    // Fallback logic if AI is lazy with pricing strategy
    if (!result.pricingStrategy) {
        result.pricingStrategy = {
            min: result.suggestedPrice * 0.8,
            max: result.suggestedPrice * 1.2,
            fastSell: result.suggestedPrice * 0.9,
            suggested: result.suggestedPrice,
            highProfit: result.suggestedPrice * 1.1,
            marketAnalysis: "Based on average market value"
        };
    }

    // Double check fastSell isn't 0
    if (result.pricingStrategy.fastSell === 0 && result.suggestedPrice > 0) {
       result.pricingStrategy.fastSell = result.suggestedPrice * 0.9;
       result.pricingStrategy.highProfit = result.suggestedPrice * 1.1;
    }

    return result;

  } catch (error) {
    console.error("AI Service Error:", error);
    return defaultData;
  }
};
