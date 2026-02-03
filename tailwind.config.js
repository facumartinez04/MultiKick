/** @type {import('tailwindcss').Config} */
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kick: {
          green: '#53FC18',
          dark: '#0B0E0F',
          gray: '#191B1F',
          text: '#FFFFFF'
        }
      }
    },
  },
  plugins: [],
}
