/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#d9e8ff',
          200: '#bcd7ff',
          300: '#8ebdff',
          400: '#5897ff',
          500: '#316dff',
          600: '#1a4cf5',
          700: '#1539e1',
          800: '#1830b6',
          900: '#1a2f8f',
          950: '#151d57'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      boxShadow: {
        soft: '0 2px 10px -3px rgba(0,0,0,0.1), 0 1px 3px -1px rgba(0,0,0,0.06)'
      }
    }
  },
  plugins: []
}
