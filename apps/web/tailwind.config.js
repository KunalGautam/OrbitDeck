/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        space: {
          900: '#080c16',
          850: '#0d1322',
          800: '#131b2e',
          700: '#1b2640',
          600: '#263556',
        },
        orbit: {
          cyan: '#00e5ff',
          green: '#00e676',
          amber: '#ffab00',
          red: '#ff1744',
          purple: '#d500f9',
        },
      },
    },
  },
  plugins: [],
};
