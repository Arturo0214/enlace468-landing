/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Re-branding 2026-09: alias re-mapeados a la marca real ──
        // primary        #1E3A5F → #071B49 (navy de marca)
        // primary-light  #2563EB → #4A6FC9 (navy legible: 3.96:1 sobre #040F2E, 4.76:1 con texto blanco)
        // accent         #0D9488 → #00A99D (turquesa de marca)
        // accent-light   #14B8A6 → #1ABFB0
        // dark           #0B1120 → #040F2E | dark-light #111827 → #0A1A3F | surface #1A2332 → #12244F
        primary: '#071B49',
        'primary-light': '#4A6FC9',
        accent: '#00A99D',
        'accent-light': '#1ABFB0',
        dark: '#040F2E',
        'dark-light': '#0A1A3F',
        surface: '#12244F',
        gold: '#D97706',
        // ── Tokens semánticos ligados a CSS vars del tema (index.css :root / .dark) ──
        ink: 'var(--text-primary)',
        'ink-secondary': 'var(--text-secondary)',
        'ink-tertiary': 'var(--text-tertiary)',
        canvas: 'var(--bg-body)',
        'surface-1': 'var(--bg-surface)',
        'surface-2': 'var(--bg-elevated)',
        line: 'var(--border-default)',
        'line-strong': 'var(--border-strong)',
        'gold-light': '#F59E0B',
        // Escalas explícitas de marca (uso futuro: navy-700, turquoise-300, etc.)
        navy: {
          50: '#EEF2FA',
          100: '#D9E1F2',
          200: '#B3C3E5',
          300: '#8AA2D6',
          400: '#5F7FC4',
          500: '#3D5BA9',
          600: '#24418C',
          700: '#142E6E',
          800: '#0B2058',
          900: '#071B49', // marca
          950: '#040F2E',
        },
        turquoise: {
          50: '#EAFAF8',
          100: '#CCF3EF',
          200: '#99E7E0',
          300: '#5CD6CB',
          400: '#1ABFB0',
          500: '#00A99D', // marca
          600: '#00897F',
          700: '#006B63',
          800: '#00504B',
          900: '#003835',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
