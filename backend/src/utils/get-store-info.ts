import { createClient } from "@supabase/supabase-js"

let cachedInfo: any = null
let cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// GST state codes — derived from state name
const GST_STATE_CODES: Record<string, string> = {
  "jammu & kashmir": "01", "himachal pradesh": "02", "punjab": "03",
  "chandigarh": "04", "uttarakhand": "05", "haryana": "06",
  "delhi": "07", "rajasthan": "08", "uttar pradesh": "09",
  "bihar": "10", "sikkim": "11", "arunachal pradesh": "12",
  "nagaland": "13", "manipur": "14", "mizoram": "15",
  "tripura": "16", "meghalaya": "17", "assam": "18",
  "west bengal": "19", "jharkhand": "20", "odisha": "21",
  "chhattisgarh": "22", "madhya pradesh": "23", "gujarat": "24",
  "dadra & nagar haveli and daman & diu": "26", "maharashtra": "27",
  "andhra pradesh": "37", "karnataka": "29", "goa": "30",
  "lakshadweep": "31", "kerala": "32", "tamil nadu": "33",
  "puducherry": "34", "andaman & nicobar islands": "35",
  "telangana": "36", "ladakh": "38",
}

// Common 2-letter abbreviations customers type in the free-text state field.
const STATE_ALIASES: Record<string, string> = {
  jk: "jammu & kashmir", hp: "himachal pradesh", pb: "punjab",
  ch: "chandigarh", uk: "uttarakhand", ua: "uttarakhand", hr: "haryana",
  dl: "delhi", rj: "rajasthan", up: "uttar pradesh", br: "bihar",
  sk: "sikkim", ar: "arunachal pradesh", nl: "nagaland", mn: "manipur",
  mz: "mizoram", tr: "tripura", ml: "meghalaya", as: "assam",
  wb: "west bengal", jh: "jharkhand", od: "odisha", or: "odisha",
  cg: "chhattisgarh", mp: "madhya pradesh", gj: "gujarat",
  mh: "maharashtra", ap: "andhra pradesh", ka: "karnataka", ga: "goa",
  ld: "lakshadweep", kl: "kerala", tn: "tamil nadu", py: "puducherry",
  an: "andaman & nicobar islands", ts: "telangana", tg: "telangana",
  la: "ladakh",
}

export function getStateCode(state: string): string {
  const s = (state || "").trim().toLowerCase()
  const name = STATE_ALIASES[s] || s
  return GST_STATE_CODES[name] || "99"
}

export async function getStoreInfo() {
  if (cachedInfo && Date.now() - cacheTime < CACHE_TTL) {
    return cachedInfo
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  const fallback = {
    store_name: process.env.SELLER_NAME || process.env.BRAND_NAME || "Delfee",
    address: process.env.SELLER_ADDRESS || "",
    city: "",
    state: process.env.SELLER_STATE || "Chandigarh",
    pincode: "",
    gstin: process.env.SELLER_GSTIN || "",
    gst_rate: Number(process.env.GST_RATE || "3"),
    hsn_code: process.env.DEFAULT_HSN_CODE || "7117",
    pan: "",
    phone: "",
    email: "",
  }

  if (!url || !key) return fallback

  const supabase = createClient(url, key)
  const { data, error } = await supabase
    .from("cms_store_info")
    .select("*")
    .limit(1)
    .single()

  if (error || !data) return fallback

  cachedInfo = data
  cacheTime = Date.now()
  return data
}
