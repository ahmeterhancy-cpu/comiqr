/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // ComiQR marka rengi (web-admin ile aynı brand tonu).
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          200: '#bcdcff',
          300: '#8ec6ff',
          400: '#59a6ff',
          500: '#2f83f5',
          600: '#1f66e0',
          700: '#1a51c0',
          800: '#1c469b',
          900: '#1c3d7a',
        },
      },
    },
  },
  plugins: [],
};
