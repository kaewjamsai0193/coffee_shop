import { useEffect, useRef, useState } from 'react';

// นับขึ้นจาก 0 ด้วย requestAnimationFrame ~800ms ease-out (Design.md §5)
// เคารพ prefers-reduced-motion → แสดงค่าปลายทางทันที
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const CountUp = ({ value = 0, duration = 800 }) => {
  const [display, setDisplay] = useState(0);
  const raf = useRef();

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setDisplay(value);
      return;
    }
    let start;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setDisplay(value * easeOut(progress));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return <>{display.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
};

export default CountUp;
