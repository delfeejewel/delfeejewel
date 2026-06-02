const currencySymbols: Record<string, string> = {
  inr: "₹",
  usd: "$",
  eur: "€",
  gbp: "£",
}

export function convertToLocale(amount: number, currencyCode: string): string {
  const symbol = currencySymbols[currencyCode.toLowerCase()] || currencyCode.toUpperCase()

  return `${symbol}${(amount / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
