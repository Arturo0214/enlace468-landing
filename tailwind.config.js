/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#E6195B',
        'primary-light': '#FF3D7F',
        accent: '#06B6D4',
        'accent-light': '#22D3EE',
        dark: '#0A0A1B',
        'dark-light': '#12122B',
        surface: '#1A1A3E',
        gold: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
