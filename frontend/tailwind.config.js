/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef7ee',
          100: '#fdedd6',
          200: '#fad9ad',
          300: '#f6bf78',
          400: '#f19d41',
          500: '#ed8118',
          600: '#de6a0d',
          700: '#b84e0d',
          800: '#933e12',
          900: '#773313',
          950: '#3f1506',
        },
      },
    },
  },
  plugins: [],
}