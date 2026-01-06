/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8f2ff',
          100: '#d4e6ff',
          200: '#a8c7ff',
          300: '#7da8ff',
          400: '#4b85ff',
          500: '#2c68e5',
          600: '#1f52b3',
          700: '#183f8a',
          800: '#123065',
          900: '#0c2247',
        },
      },
    },
  },
  plugins: [],
}
