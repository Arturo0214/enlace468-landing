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
        primary: '#1E3A5F',
        'primary-light': '#2563EB',
        accent: '#0D9488',
        'accent-light': '#14B8A6',
        dark: '#0B1120',
        'dark-light': '#111827',
        surface: '#1A2332',
        gold: '#D97706',
        'gold-light': '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
