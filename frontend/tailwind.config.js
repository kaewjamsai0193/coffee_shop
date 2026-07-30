/** @type {import('tailwindcss').Config} */
// color token + typography จาก Design.md (§1–2) — ห้ามใช้สีนอกเหนือจากนี้
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        foam: '#FBF3E9',
        grounds: '#4A2E2A',
        marigold: '#E8A33D',
        matcha: '#4F8B6E',
        cherry: '#D1483B',
        paper: '#FFFFFF',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
