module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          100: '#1a1b26',
          200: '#24283b',
          300: '#414868',
        }
      }
    },
  },
  darkMode: 'class', // Enable dark mode with class
  plugins: [],
}