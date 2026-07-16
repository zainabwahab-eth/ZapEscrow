/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        escrow: {
          teal: '#0F766E',
          coral: '#E4572E',
        },
      },
    },
  },
  plugins: [],
};
