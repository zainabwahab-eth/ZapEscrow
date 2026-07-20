/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        escrow: {
          teal: '#0F766E',
          coral: '#E4572E',
          cream: '#FAF6EF',
          ink: '#211F1D',
        },
      },
      fontFamily: {
        fraunces: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
