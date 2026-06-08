const currencySymbols: Record<string, string> = {
  inr: "₹",
  usd: "$",
  eur: "€",
  gbp: "£",
}

export function convertToLocale(amount: number, currencyCode: string): string {
  const symbol = currencySymbols[currencyCode.toLowerCase()] || currencyCode.toUpperCase()

  // Medusa v2 stores monetary amounts as major units (e.g. 4299 = ₹4,299.00),
  // so format the amount directly — do NOT divide by 100.
  return `${symbol}${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
