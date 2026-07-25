/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // MENULUX tarzı canlı pembe/magenta marka.
        brand: {
          50: '#fff1f5',
          100: '#ffe4ec',
          200: '#fecdda',
          300: '#fda4bd',
          400: '#fb6f97',
          500: '#f4337a',
          600: '#e11d5f',
          700: '#bd144b',
          800: '#9e1440',
          900: '#87143b',
        },
      },
    },
  },
  plugins: [],
};
