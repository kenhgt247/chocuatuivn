/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",             // Quét các file App.tsx, index.tsx ở gốc
    "./pages/**/*.{js,ts,jsx,tsx}",    // Quét thư mục pages
    "./components/**/*.{js,ts,jsx,tsx}", // Quét thư mục components
  ],
  theme: {
    extend: {
      colors: {
        primary: '#047857',       // Xanh lá cộng đồng
        primaryHover: '#065f46',
        textMain: '#0f172a',
        bgMain: '#f7faf8',
      }
    },
  },
  plugins: [],
}