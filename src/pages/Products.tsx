import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, PackageX, Boxes, FileDown, Layers, Sliders } from 'lucide-react'
import type { Category, Product } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../store/app'
import { money, num, qty, isDecimalUnit } from '../lib/format'
import { Modal, Field, Badge, EmptyState, StatCard, Spinner, NumberInput } from '../components/ui'
import { exportExcel, exportPDF, exportCSV, type Column } from '../lib/export'

const COLUMNS: Column[] = [
  { header: 'SKU', key: 'sku' },
  { header: 'Name', key: 'name', width: 30 },
  { header: 'Category', key: 'category' },
  { header: 'Cost', key: 'costPrice', money: true, align: 'right' },
  { header: 'Price', key: 'salePrice', money: true, align: 'right' },
  { header: 'Stock', key: 'stock', align: 'right' },
  { header: 'Stock Value', key: 'stockValue', money: true, align: 'right' }
]

export default function Products() {
  const { settings, toast } = useApp()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Product> | null>(null)
  const [adjusting, setAdjusting] = useState<Product | null>(null)
  const [catOpen, setCatOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const [p, c] = await Promise.all([api.listProducts({ limit: 1000 }), api.listCategories()])
    setProducts(p)
    setCategories(c)
    setLoading(false)
  }
  useEffect(() => {
    void load()
  }, [])

  const catName = (id?: string) => categories.find((c) => c._id === id)?.name ?? '—'

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.includes(q))
  }, [products, search])

  const stats = useMemo(() => {
    const value = products.reduce((a, p) => a + p.stock * p.costPrice, 0)
    const low = products.filter((p) => p.trackStock && p.stock <= p.lowStockThreshold).length
    const out = products.filter((p) => p.trackStock && p.stock <= 0).length
    return { value, low, out }
  }, [products])

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"?`)) return
    await api.deleteProduct(p._id)
    toast('success', 'Product deleted')
    void load()
  }

  const exportData = () =>
    filtered.map((p) => ({
      sku: p.sku,
      name: p.name,
      category: catName(p.categoryId),
      costPrice: p.costPrice,
      salePrice: p.salePrice,
      stock: p.stock,
      stockValue: p.stock * p.costPrice
    }))

  const doExport = async (kind: 'pdf' | 'xlsx' | 'csv') => {
    const meta = {
      title: 'Inventory Report',
      subtitle: `${filtered.length} products`,
      shopName: settings?.shop.name,
      summary: [{ label: 'Total Stock Value', value: money(stats.value) }]
    }
    const ok =
      kind === 'pdf'
        ? await exportPDF('inventory', meta, COLUMNS, exportData())
        : kind === 'xlsx'
          ? await exportExcel('inventory', meta, COLUMNS, exportData())
          : await exportCSV('inventory', COLUMNS, exportData())
    if (ok) toast('success', 'Inventory exported')
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Products" value={num(products.length)} icon={<Boxes size={18} />} />
        <StatCard label="Stock Value" value={money(stats.value)} tone="emerald" icon={<Layers size={18} />} />
        <StatCard label="Low Stock" value={num(stats.low)} tone="amber" icon={<Sliders size={18} />} />
        <StatCard label="Out of Stock" value={num(stats.out)} tone="rose" icon={<PackageX size={18} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn-ghost" onClick={() => setCatOpen(true)}>
          <Layers size={16} /> Categories
        </button>
        <div className="flex items-center gap-1.5">
          <button className="btn-ghost" onClick={() => doExport('pdf')} title="Export PDF"><FileDown size={16} /> PDF</button>
          <button className="btn-ghost" onClick={() => doExport('xlsx')} title="Export Excel">Excel</button>
          <button className="btn-ghost" onClick={() => doExport('csv')} title="Export CSV">CSV</button>
        </div>
        <button className="btn-primary" onClick={() => setEditing({})}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <Spinner label="Loading inventory…" />
        ) : !filtered.length ? (
          <EmptyState icon={<Boxes size={40} />} title="No products" hint="Add your first product to start selling" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-white">
                <tr>
                  <th className="th">Product</th>
                  <th className="th">Category</th>
                  <th className="th text-right">Cost</th>
                  <th className="th text-right">Price</th>
                  <th className="th text-right">Margin</th>
                  <th className="th text-right">Stock</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((p) => {
                  const margin = p.salePrice > 0 ? ((p.salePrice - p.costPrice) / p.salePrice) * 100 : 0
                  return (
                    <tr key={p._id} className="hover:bg-gray-100">
                      <td className="td">
                        <p className="font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.sku}{p.barcode ? ` · ${p.barcode}` : ''}</p>
                      </td>
                      <td className="td text-gray-500">{catName(p.categoryId)}</td>
                      <td className="td text-right">{money(p.costPrice)}</td>
                      <td className="td text-right font-medium">{money(p.salePrice)}</td>
                      <td className="td text-right text-gray-500">{margin.toFixed(0)}%</td>
                      <td className="td text-right">
                        {!p.trackStock ? (
                          <Badge>∞</Badge>
                        ) : p.stock <= 0 ? (
                          <Badge tone="red">Out</Badge>
                        ) : p.stock <= p.lowStockThreshold ? (
                          <Badge tone="amber">{qty(p.stock)} {p.unit} low</Badge>
                        ) : (
                          <span>{qty(p.stock)} <span className="text-gray-400">{p.unit}</span></span>
                        )}
                      </td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-cyan-600" onClick={() => setAdjusting(p)} title="Adjust stock">
                            <Sliders size={15} />
                          </button>
                          <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900" onClick={() => setEditing(p)}>
                            <Pencil size={15} />
                          </button>
                          <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-rose-600" onClick={() => remove(p)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ProductForm
          product={editing}
          categories={categories}
          defaultTax={settings?.defaultTaxRate ?? 0}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
        />
      )}
      {adjusting && (
        <AdjustStock
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null)
            void load()
          }}
        />
      )}
      {catOpen && <CategoryManager categories={categories} onClose={() => setCatOpen(false)} onChanged={load} />}
    </div>
  )
}

function ProductForm({
  product,
  categories,
  defaultTax,
  onClose,
  onSaved
}: {
  product: Partial<Product>
  categories: Category[]
  defaultTax: number
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useApp()
  const [form, setForm] = useState<Partial<Product>>({
    unit: 'pcs',
    taxRate: defaultTax,
    trackStock: true,
    active: true,
    lowStockThreshold: 5,
    ...product
  })
  const set = (k: keyof Product, v: unknown) => setForm((f) => ({ ...f, [k]: v }))
  const dec = form.allowDecimal ?? isDecimalUnit(form.unit)

  const save = async () => {
    if (!form.name?.trim()) return toast('error', 'Name is required')
    if (!form.sku?.trim()) form.sku = `P${Date.now().toString().slice(-6)}`
    await api.saveProduct(form)
    toast('success', 'Product saved')
    onSaved()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={product._id ? 'Edit Product' : 'New Product'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save Product</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Product Name">
            <input className="input" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus />
          </Field>
        </div>
        <Field label="SKU / Code"><input className="input" value={form.sku ?? ''} onChange={(e) => set('sku', e.target.value)} /></Field>
        <Field label="Barcode"><input className="input" value={form.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)} /></Field>
        <Field label="Category">
          <select className="input" value={form.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value || undefined)}>
            <option value="">Uncategorized</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Unit">
          <select
            className="input"
            value={form.unit ?? 'pcs'}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value, allowDecimal: isDecimalUnit(e.target.value) }))}
          >
            {['pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'pack', 'dozen', 'm', 'cm'].map((u) => <option key={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Cost Price"><NumberInput value={form.costPrice ?? 0} onChange={(n) => set('costPrice', n)} /></Field>
        <Field label="Sale Price"><NumberInput value={form.salePrice ?? 0} onChange={(n) => set('salePrice', n)} /></Field>
        <Field label="Tax Rate (%)"><NumberInput value={form.taxRate ?? 0} onChange={(n) => set('taxRate', n)} /></Field>
        <Field label={`Opening / Current Stock (${form.unit ?? 'pcs'})`}>
          <NumberInput value={form.stock ?? 0} allowDecimal={dec} onChange={(n) => set('stock', n)} />
        </Field>
        <Field label="Low Stock Alert At"><NumberInput value={form.lowStockThreshold ?? 5} allowDecimal={dec} onChange={(n) => set('lowStockThreshold', n)} /></Field>
        <div className="col-span-2 flex flex-wrap gap-x-6 gap-y-2 pt-1">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.trackStock ?? true} onChange={(e) => set('trackStock', e.target.checked)} /> Track stock
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={dec} onChange={(e) => set('allowDecimal', e.target.checked)} /> Sold by weight/volume (allow decimal qty)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.active ?? true} onChange={(e) => set('active', e.target.checked)} /> Active (sellable)
          </label>
        </div>
      </div>
    </Modal>
  )
}

function AdjustStock({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [count, setCount] = useState(product.stock)
  const [note, setNote] = useState('')
  const dec = product.allowDecimal ?? isDecimalUnit(product.unit)
  const save = async () => {
    await api.adjustStock(product._id, count, note || 'Manual adjustment')
    toast('success', 'Stock adjusted')
    onSaved()
  }
  return (
    <Modal open onClose={onClose} title={`Adjust Stock — ${product.name}`} footer={
      <>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save}>Save</button>
      </>
    }>
      <div className="space-y-4">
        <p className="text-sm text-gray-500">Current stock: <span className="font-semibold text-gray-900">{qty(product.stock)} {product.unit}</span></p>
        <Field label={`New Stock Count (${product.unit})`}><NumberInput value={count} allowDecimal={dec} onChange={setCount} autoFocus /></Field>
        <Field label="Reason / Note"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. damaged, recount, stock take" /></Field>
      </div>
    </Modal>
  )
}

function CategoryManager({ categories, onClose, onChanged }: { categories: Category[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const { toast } = useApp()
  const [name, setName] = useState('')
  const [list, setList] = useState(categories)
  const add = async () => {
    if (!name.trim()) return
    await api.saveCategory({ name: name.trim(), color: '#316dff' })
    setName('')
    await onChanged()
    setList(await api.listCategories())
    toast('success', 'Category added')
  }
  const del = async (id: string) => {
    await api.deleteCategory(id)
    await onChanged()
    setList(await api.listCategories())
  }
  return (
    <Modal open onClose={onClose} title="Manage Categories">
      <div className="mb-4 flex gap-2">
        <input className="input" placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn-primary" onClick={add}><Plus size={16} /></button>
      </div>
      <div className="space-y-2">
        {list.map((c) => (
          <div key={c._id} className="flex items-center justify-between rounded-xl bg-gray-100 px-4 py-2.5">
            <span className="text-sm text-gray-900">{c.name}</span>
            <button className="text-gray-400 hover:text-rose-600" onClick={() => del(c._id)}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
