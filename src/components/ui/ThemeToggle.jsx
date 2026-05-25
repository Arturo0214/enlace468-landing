import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../lib/themeContext'
import { motion } from 'framer-motion'

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
        isDark
          ? 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-yellow-400'
          : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700'
      } ${className}`}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      <motion.div
        key={isDark ? 'moon' : 'sun'}
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0, rotate: 90 }}
        transition={{ duration: 0.2 }}
      >
        {isDark ? <Moon size={18} /> : <Sun size={18} />}
      </motion.div>
    </button>
  )
}
