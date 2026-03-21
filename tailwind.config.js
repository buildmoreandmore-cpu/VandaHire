/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'p-bg': '#0a0a0a',
        'p-surface': '#141414',
        'p-green': '#5eead4',
        'p-accent': '#5eead4',
        'p-border': '#1e1e1e',
        'p-muted': '#888888',
        'p-disabled': '#333333',
        'p-error': '#ff4444',
      },
      fontFamily: {
        heading: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
