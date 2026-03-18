/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'p-bg': '#0a0a0a',
        'p-surface': '#141414',
        'p-green': '#c8ff00',
        'p-border': '#222222',
        'p-muted': '#888888',
        'p-disabled': '#333333',
        'p-error': '#ff4444',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
