import { createContext, useContext, useState, useEffect, useMemo } from 'react'

const CartContext = createContext(null)

const CART_STORAGE_KEY = 'enlace468_cart'

function loadCart() {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart)

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  }, [items])

  function addItem(plan) {
    setItems((prev) => {
      if (prev.some((item) => item.plan.id === plan.id)) return prev
      return [...prev, { plan, quantity: 1 }]
    })
  }

  function removeItem(planId) {
    setItems((prev) => prev.filter((item) => item.plan.id !== planId))
  }

  function clearCart() {
    setItems([])
  }

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + (item.plan.price_mxn || 0) + (item.plan.setup_fee_mxn || 0)
    }, 0)
  }, [items])

  const itemCount = items.length

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
