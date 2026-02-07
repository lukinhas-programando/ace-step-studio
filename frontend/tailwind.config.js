/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        surface: "#161616",
        panel: "#1f1f1f",
        border: "#2a2a2a",
        accent: "#ff4fd8",
        subtle: "#9ca3af",
      },
      boxShadow: {
        panel: "0 8px 32px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [],
};
