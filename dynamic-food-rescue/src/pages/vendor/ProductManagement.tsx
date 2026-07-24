import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { LoadingPage } from '@/pages/LoadingPage'
import { Plus, Edit, Trash2, X } from 'lucide-react'

interface Product {
  id: string
  name: string
  category: string
  unit: string
  original_price: number
  current_discount: number
  sell_by: string
  quantity: number
  inventory_id: string
}

export const ProductManagement = () => {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: 'kg',
    original_price: 0,
    current_discount: 0,
    sell_by: '',
    quantity: 0,
  })

  // Get store ID
  useEffect(() => {
    const fetchStore = async () => {
      if (!user) return
      const { data, error } = await supabase
        .from('store_staff')
        .select('store_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) {
        toast.error('Failed to fetch store')
        return
      }
      if (data) setStoreId(data.store_id)
      else toast.error('You are not registered as store staff')
    }
    fetchStore()
  }, [user])

  // Fetch products
  const fetchProducts = async () => {
    if (!storeId) return
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          category,
          unit,
          original_price,
          current_discount,
          sell_by,
          inventory!inner (
            id,
            quantity,
            reserved
          )
        `)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formatted = data.map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category || '',
        unit: p.unit || 'kg',
        original_price: p.original_price,
        current_discount: p.current_discount || 0,
        sell_by: p.sell_by,
        quantity: p.inventory?.quantity || 0,
        inventory_id: p.inventory?.id,
      }))
      setProducts(formatted)
    } catch (err: any) {
      toast.error(err.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
    // Realtime subscriptions
    const channel = supabase
      .channel('store-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchProducts)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventory' }, fetchProducts)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId])

  // Create or update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId) return

    try {
      if (editingProduct) {
        // Update product
        const { error: prodError } = await supabase
          .from('products')
          .update({
            name: formData.name,
            category: formData.category,
            unit: formData.unit,
            original_price: formData.original_price,
            current_discount: formData.current_discount,
            sell_by: formData.sell_by,
          })
          .eq('id', editingProduct.id)
        if (prodError) throw prodError

        // Update inventory quantity
        const { error: invError } = await supabase
          .from('inventory')
          .update({ quantity: formData.quantity })
          .eq('id', editingProduct.inventory_id)
        if (invError) throw invError

        toast.success('Product updated!')
      } else {
        // Insert product
        const { data: prod, error: prodError } = await supabase
          .from('products')
          .insert({
            store_id: storeId,
            name: formData.name,
            category: formData.category,
            unit: formData.unit,
            original_price: formData.original_price,
            current_discount: formData.current_discount,
            sell_by: formData.sell_by,
          })
          .select()
          .single()
        if (prodError) throw prodError

        // Insert inventory
        const { error: invError } = await supabase
          .from('inventory')
          .insert({
            product_id: prod.id,
            quantity: formData.quantity,
            reserved: 0,
          })
        if (invError) throw invError

        toast.success('Product added!')
      }

      resetForm()
      fetchProducts()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product and its inventory?')) return
    try {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
      toast.success('Product deleted')
      fetchProducts()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      unit: 'kg',
      original_price: 0,
      current_discount: 0,
      sell_by: '',
      quantity: 0,
    })
    setEditingProduct(null)
    setIsFormOpen(false)
  }

  const openEdit = (p: Product) => {
    setEditingProduct(p)
    setFormData({
      name: p.name,
      category: p.category || '',
      unit: p.unit,
      original_price: p.original_price,
      current_discount: p.current_discount,
      sell_by: p.sell_by,
      quantity: p.quantity,
    })
    setIsFormOpen(true)
  }

  if (loading) return <LoadingPage />
  if (!storeId) return <div className="p-4">No store found for your account.</div>

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-green-700">Manage Products</h1>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500">You haven't added any products yet.</p>
          <p className="text-sm text-gray-400">Click "Add Product" to start selling.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div key={p.id} className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold text-lg">{p.name}</h3>
              <p className="text-sm text-gray-500">{p.category} • {p.unit}</p>
              <p className="text-sm">Price: रू {p.original_price}</p>
              <p className="text-sm">Discount: रू {p.current_discount}</p>
              <p className="text-sm">Stock: {p.quantity}</p>
              <p className="text-xs text-gray-400">Sell by: {new Date(p.sell_by).toLocaleDateString()}</p>
              <div className="mt-2 flex space-x-2">
                <button
                  onClick={() => openEdit(p)}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                >
                  <Edit className="w-4 h-4 inline" /> Edit
                </button>
                <button
                  onClick={() => deleteProduct(p.id)}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                >
                  <Trash2 className="w-4 h-4 inline" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editingProduct ? 'Edit' : 'Add'} Product</h2>
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium">Product Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Unit</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="kg">kg</option>
                  <option value="piece">piece</option>
                  <option value="bunch">bunch</option>
                  <option value="packet">packet</option>
                  <option value="dozen">dozen</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Original Price (NPR)</label>
                <input
                  type="number"
                  value={formData.original_price}
                  onChange={(e) => setFormData({ ...formData, original_price: Number(e.target.value) })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Discount (NPR)</label>
                <input
                  type="number"
                  value={formData.current_discount}
                  onChange={(e) => setFormData({ ...formData, current_discount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Sell‑By Date</label>
                <input
                  type="datetime-local"
                  value={formData.sell_by}
                  onChange={(e) => setFormData({ ...formData, sell_by: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Quantity</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {editingProduct ? 'Update' : 'Add'} Product
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

