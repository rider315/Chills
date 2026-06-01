/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bw: "#ffffff",
        text: "#000000",
        border: "#000000",
        shadow: "#000000",
        neo: {
          green: "#75FA92",
          blue: "#3b82f6",
          yellow: "#ffd800",
          purple: "#2a049c",
          red: "#c31d1d",
          teal: "#1db5c3"
        }
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
      },
      boxShadow: {
        neo: "4px 4px 0 0 rgba(0,0,0,1)",
        neohover: "6px 6px 0 0 rgba(0,0,0,1)",
        neosm: "2px 2px 0 0 rgba(0,0,0,1)",
      },
      translate: {
        boxShadowX: "4px",
        boxShadowY: "4px",
      },
      borderRadius: {
        base: "8px"
      }
    },
  },
  plugins: [],
}
