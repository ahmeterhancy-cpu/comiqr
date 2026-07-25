/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // ComiQR marka turuncusu (logodan — ana ton #f05020).
        brand: {
          50: '#fff4ee',
          100: '#ffe6d5',
          200: '#fecbb0',
          300: '#fba57c',
          400: '#f7794a',
          500: '#f05020',
          600: '#d83f12',
          700: '#b43211',
          800: '#8f2a15',
          900: '#742514',
        },
      },
    },
  },
  plugins: [],
};
