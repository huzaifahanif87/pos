import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { api } from './api'
import { money } from './format'

export interface Column {
  header: string
  key: string
  align?: 'left' | 'right' | 'center'
  money?: boolean
  width?: number
}

export type Row = Record<string, string | number | undefined | null>

export interface ReportMeta {
  title: string
  subtitle?: string
  shopName?: string
  generatedAt?: number
  summary?: { label: string; value: string }[]
}

function cellText(col: Column, row: Row): string {
  const raw = row[col.key]
  if (col.money) return money(Number(raw ?? 0))
  return raw == null ? '' : String(raw)
}

async function save(defaultName: string, data: ArrayBuffer | Uint8Array, extension: string): Promise<boolean> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const res = await api.saveExport({ defaultName, data: Array.from(bytes), extension })
  return res.saved
}

// ---------- CSV ----------
export async function exportCSV(filename: string, columns: Column[], rows: Row[]): Promise<boolean> {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const head = columns.map((c) => esc(c.header)).join(',')
  const body = rows
    .map((r) => columns.map((c) => esc(c.money ? String(Number(r[c.key] ?? 0)) : String(r[c.key] ?? ''))).join(','))
    .join('\n')
  const csv = `${head}\n${body}`
  return save(`${filename}.csv`, new TextEncoder().encode(csv), 'csv')
}

// ---------- Excel ----------
export async function exportExcel(
  filename: string,
  meta: ReportMeta,
  columns: Column[],
  rows: Row[]
): Promise<boolean> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Nexus POS'
  wb.created = new Date()
  const ws = wb.addWorksheet(meta.title.slice(0, 30) || 'Report')

  ws.mergeCells(1, 1, 1, columns.length)
  const titleCell = ws.getCell(1, 1)
  titleCell.value = meta.shopName ? `${meta.shopName} — ${meta.title}` : meta.title
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF1A4CF5' } }

  let r = 2
  if (meta.subtitle) {
    ws.mergeCells(r, 1, r, columns.length)
    ws.getCell(r, 1).value = meta.subtitle
    ws.getCell(r, 1).font = { italic: true, color: { argb: 'FF666666' } }
    r++
  }
  r++

  const headerRow = ws.getRow(r)
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A4CF5' } }
    cell.alignment = { horizontal: c.align ?? 'left' }
  })
  headerRow.commit()
  r++

  for (const row of rows) {
    const xr = ws.getRow(r)
    columns.forEach((c, i) => {
      const cell = xr.getCell(i + 1)
      if (c.money) {
        cell.value = Number(row[c.key] ?? 0)
        cell.numFmt = '#,##0.00'
      } else {
        cell.value = row[c.key] ?? ''
      }
      cell.alignment = { horizontal: c.align ?? (c.money ? 'right' : 'left') }
    })
    xr.commit()
    r++
  }

  columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width ?? Math.max(14, c.header.length + 4)
  })

  if (meta.summary?.length) {
    r++
    for (const s of meta.summary) {
      ws.getCell(r, 1).value = s.label
      ws.getCell(r, 1).font = { bold: true }
      ws.getCell(r, 2).value = s.value
      r++
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  return save(`${filename}.xlsx`, buf as ArrayBuffer, 'xlsx')
}

// ---------- PDF ----------
export async function exportPDF(
  filename: string,
  meta: ReportMeta,
  columns: Column[],
  rows: Row[]
): Promise<boolean> {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait', unit: 'pt' })
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFontSize(18)
  doc.setTextColor(26, 76, 245)
  doc.text(meta.shopName || 'Nexus POS', 40, 46)
  doc.setFontSize(13)
  doc.setTextColor(30, 30, 30)
  doc.text(meta.title, 40, 66)
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  if (meta.subtitle) doc.text(meta.subtitle, 40, 82)
  doc.text(`Generated: ${new Date(meta.generatedAt ?? Date.now()).toLocaleString()}`, pageW - 40, 46, {
    align: 'right'
  })

  autoTable(doc, {
    startY: 96,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => cellText(c, row))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [26, 76, 245], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [243, 246, 252] },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [i, { halign: c.align ?? (c.money ? 'right' : 'left') }])
    ),
    margin: { left: 40, right: 40 }
  })

  if (meta.summary?.length) {
    const after = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20
    doc.setFontSize(10)
    doc.setTextColor(20, 20, 20)
    meta.summary.forEach((s, i) => {
      doc.text(`${s.label}:`, pageW - 220, after + i * 16)
      doc.setFont('helvetica', 'bold')
      doc.text(s.value, pageW - 40, after + i * 16, { align: 'right' })
      doc.setFont('helvetica', 'normal')
    })
  }

  const buf = doc.output('arraybuffer')
  return save(`${filename}.pdf`, buf, 'pdf')
}

// ---------- Receipt / Invoice PDF ----------
export interface ReceiptData {
  invoiceNo: string
  date: number
  shopName: string
  shopAddress?: string
  shopPhone?: string
  cashier?: string
  customer?: string
  items: { name: string; qty: number; price: number; lineTotal: number }[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paid: number
  change: number
  due: number
  footer?: string
  widthMM?: number
}

export async function exportReceiptPDF(data: ReceiptData): Promise<boolean> {
  const w = data.widthMM ?? 80
  const doc = new jsPDF({ unit: 'mm', format: [w, 200 + data.items.length * 6] })
  const cx = w / 2
  let y = 8
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(data.shopName, cx, y, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  if (data.shopAddress) doc.text(data.shopAddress, cx, (y += 4), { align: 'center' })
  if (data.shopPhone) doc.text(data.shopPhone, cx, (y += 3.5), { align: 'center' })
  y += 4
  doc.setFontSize(7)
  doc.text(`Invoice: ${data.invoiceNo}`, 4, (y += 4))
  doc.text(new Date(data.date).toLocaleString(), 4, (y += 3.5))
  if (data.customer) doc.text(`Customer: ${data.customer}`, 4, (y += 3.5))
  if (data.cashier) doc.text(`Cashier: ${data.cashier}`, 4, (y += 3.5))
  y += 2
  doc.setLineDashPattern([1, 1], 0)
  doc.line(4, y, w - 4, y)
  y += 3

  doc.text('Item', 4, y)
  doc.text('Qty', w - 26, y, { align: 'right' })
  doc.text('Total', w - 4, y, { align: 'right' })
  y += 1.5
  doc.line(4, y, w - 4, y)
  y += 3.5

  for (const it of data.items) {
    doc.text(it.name.slice(0, 22), 4, y)
    doc.text(String(it.qty), w - 26, y, { align: 'right' })
    doc.text(it.lineTotal.toFixed(2), w - 4, y, { align: 'right' })
    y += 4
  }

  doc.line(4, y, w - 4, y)
  y += 4
  const row = (label: string, val: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(label, 4, y)
    doc.text(val, w - 4, y, { align: 'right' })
    y += 4
  }
  row('Subtotal', data.subtotal.toFixed(2))
  if (data.discount) row('Discount', `-${data.discount.toFixed(2)}`)
  if (data.tax) row('Tax', data.tax.toFixed(2))
  row('TOTAL', data.total.toFixed(2), true)
  row('Paid', data.paid.toFixed(2))
  if (data.change) row('Change', data.change.toFixed(2))
  if (data.due) row('Due', data.due.toFixed(2))
  y += 2
  doc.setFontSize(7)
  doc.text(data.footer || 'Thank you!', cx, (y += 4), { align: 'center' })

  const buf = doc.output('arraybuffer')
  return save(`Receipt-${data.invoiceNo}.pdf`, buf, 'pdf')
}
