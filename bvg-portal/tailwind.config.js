/** @type {import('tailwindcss').Config} */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#001489',
          primary: '#005EB8',
          accent: '#28CBFF'
        },
        surface: '#f7f9fc',
        text: '#1c1c1c'
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px'
      },
      boxShadow: {
        card: '0 4px 14px rgba(0,0,0,0.06)'
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ],
}
