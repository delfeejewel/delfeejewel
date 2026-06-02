import PDFDocument from "pdfkit"
import path from "path"
import fs from "fs"

export type InvoiceData = {
  // Invoice meta
  invoice_number: string
  invoice_date: string

  // Seller
  seller_name: string
  seller_address: string
  seller_gstin: string
  seller_state: string
  seller_state_code: string

  // Buyer
  buyer_name: string
  buyer_address: string
  buyer_state: string
  buyer_gstin?: string

  // Order
  order_number: string | number
  order_date: string
  currency_code: string

  // Items
  items: {
    name: string
    hsn_code: string
    quantity: number
    unit_price: number // actual amount in major currency unit (e.g. rupees)
    tax_rate: number // e.g. 3 for 3%
  }[]

  is_intra_state: boolean // true = CGST+SGST, false = IGST
}

/* ─── Brand palette — mirrors the storefront design system ─── */
const C = {
  plum: "#5D2E46",
  plumDeep: "#431830",
  gold: "#D4AF37",
  ink: "#1A1C1B",
  textSecondary: "#504348",
  textMuted: "#827378",
  line: "#E6E2EE",
  tint: "#FAF9F7",
  white: "#FFFFFF",
}

const LOGO_PATH = path.join(process.cwd(), "static", "invoice-logo.png")

function formatAmount(amount: number): string {
  return Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function currencySymbol(code: string): string {
  // Standard PDF fonts can't render the ₹ glyph — use safe text symbols.
  const symbols: Record<string, string> = {
    inr: "Rs. ",
    usd: "$",
    eur: "EUR ",
    gbp: "GBP ",
  }
  return symbols[code.toLowerCase()] || code.toUpperCase() + " "
}

export function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 })
      const buffers: Buffer[] = []
      doc.on("data", (chunk) => buffers.push(chunk))
      doc.on("end", () => resolve(Buffer.concat(buffers)))
      doc.on("error", reject)

      const sym = currencySymbol(data.currency_code)
      const LEFT = 40
      const RIGHT = doc.page.width - 40
      const W = RIGHT - LEFT

      /* ═══ HEADER ════════════════════════════════════════ */
      let logoDrawn = false
      try {
        if (fs.existsSync(LOGO_PATH)) {
          doc.image(LOGO_PATH, LEFT, 46, { fit: [150, 48] })
          logoDrawn = true
        }
      } catch {
        logoDrawn = false
      }
      if (!logoDrawn) {
        doc
          .font("Times-Bold")
          .fontSize(24)
          .fillColor(C.plum)
          .text(data.seller_name, LEFT, 52)
      }

      // "TAX INVOICE" + meta — right aligned
      doc
        .font("Times-Bold")
        .fontSize(17)
        .fillColor(C.plum)
        .text("TAX INVOICE", RIGHT - 240, 48, {
          width: 240,
          align: "right",
          characterSpacing: 1.5,
        })

      doc.font("Helvetica").fontSize(8.5).fillColor(C.textMuted)
      const meta = [
        `Invoice No.   ${data.invoice_number}`,
        `Invoice Date   ${data.invoice_date}`,
        `Order No.   #${data.order_number}`,
        `Order Date   ${data.order_date}`,
      ]
      meta.forEach((line, i) => {
        doc.text(line, RIGHT - 260, 74 + i * 12, { width: 260, align: "right" })
      })

      // Gold rule under header
      doc
        .moveTo(LEFT, 128)
        .lineTo(RIGHT, 128)
        .lineWidth(1.5)
        .strokeColor(C.gold)
        .stroke()

      /* ═══ SELLER / BUYER ════════════════════════════════ */
      const infoY = 146
      const colGap = 28
      const colW = (W - colGap) / 2
      const rightX = LEFT + colW + colGap

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(C.gold)
        .text("SOLD BY", LEFT, infoY, { characterSpacing: 1.2 })
        .text("BILLED TO", rightX, infoY, { characterSpacing: 1.2 })

      doc
        .font("Times-Bold")
        .fontSize(12.5)
        .fillColor(C.plum)
        .text(data.seller_name, LEFT, infoY + 13, { width: colW })
        .text(data.buyer_name || "Customer", rightX, infoY + 13, { width: colW })

      doc.font("Helvetica").fontSize(8.5).fillColor(C.textSecondary)
      doc.text(data.seller_address, LEFT, infoY + 32, { width: colW, lineGap: 2 })
      const sellerAddrH = doc.heightOfString(data.seller_address || "-", {
        width: colW,
        lineGap: 2,
      })
      doc.text(data.buyer_address || "-", rightX, infoY + 32, {
        width: colW,
        lineGap: 2,
      })
      const buyerAddrH = doc.heightOfString(data.buyer_address || "-", {
        width: colW,
        lineGap: 2,
      })

      doc.font("Helvetica").fontSize(8).fillColor(C.textMuted)
      const sMetaY = infoY + 34 + sellerAddrH
      doc
        .text(`GSTIN   ${data.seller_gstin}`, LEFT, sMetaY, { width: colW })
        .text(
          `State   ${data.seller_state} (${data.seller_state_code})`,
          LEFT,
          sMetaY + 11,
          { width: colW }
        )

      const bMetaY = infoY + 34 + buyerAddrH
      doc.text(`State   ${data.buyer_state}`, rightX, bMetaY, { width: colW })
      if (data.buyer_gstin) {
        doc.text(`GSTIN   ${data.buyer_gstin}`, rightX, bMetaY + 11, {
          width: colW,
        })
      }

      /* ═══ ITEMS TABLE ═══════════════════════════════════ */
      const sellerBottom = sMetaY + 24
      const buyerBottom = bMetaY + (data.buyer_gstin ? 24 : 12)
      const tableTop = Math.max(sellerBottom, buyerBottom, infoY + 96)

      // Columns
      const col = {
        sno: { x: LEFT + 8, w: 18, align: "left" as const },
        item: { x: LEFT + 30, w: 148, align: "left" as const },
        hsn: { x: LEFT + 182, w: 40, align: "left" as const },
        qty: { x: LEFT + 218, w: 34, align: "center" as const },
        rate: { x: LEFT + 250, w: 62, align: "right" as const },
        taxable: { x: LEFT + 312, w: 64, align: "right" as const },
        tax: { x: LEFT + 376, w: 58, align: "right" as const },
        total: { x: LEFT + 432, w: 75, align: "right" as const },
      }

      // Header band
      const headH = 26
      doc.rect(LEFT, tableTop, W, headH).fill(C.plum)

      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.white)
      const headTextY = tableTop + 9
      doc.text("#", col.sno.x, headTextY, { width: col.sno.w })
      doc.text("ITEM", col.item.x, headTextY, { width: col.item.w })
      doc.text("HSN", col.hsn.x, headTextY, { width: col.hsn.w })
      doc.text("QTY", col.qty.x, headTextY, {
        width: col.qty.w,
        align: "center",
      })
      doc.text("RATE", col.rate.x, headTextY, {
        width: col.rate.w,
        align: "right",
      })
      doc.text("TAXABLE", col.taxable.x, headTextY, {
        width: col.taxable.w,
        align: "right",
      })
      doc.text("TAX", col.tax.x, headTextY, {
        width: col.tax.w,
        align: "right",
      })
      doc.text("TOTAL", col.total.x, headTextY, {
        width: col.total.w,
        align: "right",
      })

      // Rows
      let rowY = tableTop + headH
      let subtotal = 0
      let totalTax = 0

      data.items.forEach((item, i) => {
        const taxable = Number(item.unit_price) * item.quantity
        const taxAmt = taxable * (item.tax_rate / 100)
        const lineTotal = taxable + taxAmt
        subtotal += taxable
        totalTax += taxAmt

        const nameH = doc
          .font("Helvetica")
          .fontSize(8.5)
          .heightOfString(item.name, { width: col.item.w })
        const rowH = Math.max(24, nameH + 14)

        // Zebra tint on alternate rows
        if (i % 2 === 1) {
          doc.rect(LEFT, rowY, W, rowH).fill(C.tint)
        }

        const ty = rowY + 8
        doc.font("Helvetica").fontSize(8.5).fillColor(C.textMuted)
        doc.text(String(i + 1), col.sno.x, ty, { width: col.sno.w })

        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.ink)
        doc.text(item.name, col.item.x, ty, { width: col.item.w })

        doc.font("Helvetica").fontSize(8.5).fillColor(C.textSecondary)
        doc.text(item.hsn_code, col.hsn.x, ty, { width: col.hsn.w })
        doc.text(String(item.quantity), col.qty.x, ty, {
          width: col.qty.w,
          align: "center",
        })
        doc.text(`${sym}${formatAmount(item.unit_price)}`, col.rate.x, ty, {
          width: col.rate.w,
          align: "right",
        })
        doc.text(`${sym}${formatAmount(taxable)}`, col.taxable.x, ty, {
          width: col.taxable.w,
          align: "right",
        })
        doc.text(`${sym}${formatAmount(taxAmt)}`, col.tax.x, ty, {
          width: col.tax.w,
          align: "right",
        })
        doc.font("Helvetica-Bold").fillColor(C.plum)
        doc.text(`${sym}${formatAmount(lineTotal)}`, col.total.x, ty, {
          width: col.total.w,
          align: "right",
        })

        rowY += rowH
        doc
          .moveTo(LEFT, rowY)
          .lineTo(RIGHT, rowY)
          .lineWidth(0.5)
          .strokeColor(C.line)
          .stroke()
      })

      // Table outer border
      doc
        .rect(LEFT, tableTop, W, rowY - tableTop)
        .lineWidth(0.5)
        .strokeColor(C.line)
        .stroke()

      /* ═══ TOTALS ════════════════════════════════════════ */
      const grandTotal = subtotal + totalTax
      const taxRate = data.items[0]?.tax_rate || 3
      const labelX = LEFT + 285
      const labelW = 130
      const valX = labelX + labelW + 6
      const valW = RIGHT - valX

      let ty = rowY + 16
      const totalRow = (label: string, value: string, bold = false) => {
        doc
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(9)
          .fillColor(bold ? C.ink : C.textSecondary)
          .text(label, labelX, ty, { width: labelW, align: "right" })
        doc
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fillColor(bold ? C.ink : C.textSecondary)
          .text(value, valX, ty, { width: valW, align: "right" })
        ty += 16
      }

      totalRow("Subtotal", `${sym}${formatAmount(subtotal)}`)
      if (data.is_intra_state) {
        const half = totalTax / 2
        totalRow(`CGST (${taxRate / 2}%)`, `${sym}${formatAmount(half)}`)
        totalRow(`SGST (${taxRate / 2}%)`, `${sym}${formatAmount(half)}`)
      } else {
        totalRow(`IGST (${taxRate}%)`, `${sym}${formatAmount(totalTax)}`)
      }

      // Grand total box
      const boxY = ty + 4
      const boxH = 34
      doc.rect(labelX, boxY, RIGHT - labelX, boxH).fill(C.plum)
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(C.white)
        .text("GRAND TOTAL", labelX + 14, boxY + 12, {
          characterSpacing: 0.8,
        })
      doc
        .font("Times-Bold")
        .fontSize(14)
        .fillColor(C.gold)
        .text(`${sym}${formatAmount(grandTotal)}`, valX - 14, boxY + 9, {
          width: valW + 14,
          align: "right",
        })

      /* ═══ FOOTER ════════════════════════════════════════ */
      const footerY = doc.page.height - 96

      doc
        .font("Times-Italic")
        .fontSize(10)
        .fillColor(C.plum)
        .text("Thank you for choosing Delfee.", LEFT, footerY - 6, {
          width: W,
          align: "center",
        })

      doc
        .moveTo(LEFT, footerY + 16)
        .lineTo(RIGHT, footerY + 16)
        .lineWidth(0.5)
        .strokeColor(C.line)
        .stroke()

      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(C.textMuted)
        .text(
          "This is a computer-generated invoice and does not require a physical signature.",
          LEFT,
          footerY + 26,
          { width: W, align: "center" }
        )
        .text(
          `${data.seller_name}   ·   GSTIN ${data.seller_gstin}`,
          LEFT,
          footerY + 38,
          { width: W, align: "center" }
        )

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}
