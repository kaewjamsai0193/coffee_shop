/** @type {import('tailwindcss').Config} */
// color token + typography จาก Design.md (§1–2) — ห้ามใช้สีนอกเหนือจากนี้
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // จอสัมผัส (iPad) ไม่มี hover จริง — กันสถานะ hover ค้างบนปุ่มที่เพิ่งแตะ
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        ink: '#1F1F1F',
        muted: '#9A9A9A',
        line: '#EDEDED',
        surface: '#F5F5F5',
        canvas: '#F1F1F2',
        paper: '#FFFFFF',
        amber: '#F5C26B',
        coral: '#F26B6B',
        matcha: '#4F8B6E',
        cherry: '#D1483B',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
