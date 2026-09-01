import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const ScrollableTabBar = ({ children, className = '', bgClass = '' }) => {
const ref = useRef(null);
const [showLeft, setShowLeft] = useState(false);
const [showRight, setShowRight] = useState(false);
const check = () => {
  const el = ref.current;
  if (!el) return;
  setShowLeft(el.scrollLeft > 2);
  setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
};
useEffect(() => {
  check();
  const el = ref.current;
  if (el) el.addEventListener('scroll', check);
  const ro = new ResizeObserver(check);
  if (el) ro.observe(el);
  return () => { el?.removeEventListener('scroll', check); ro.disconnect(); };
}, [children]);
const scroll = (d) => ref.current?.scrollBy({ left: d * 100, behavior: 'smooth' });
const btnBase = `shrink-0 p-1 rounded-lg border border-slate-300 text-slate-500 hover:text-slate-800 transition-all ${bgClass || 'bg-white'}`;
return (
  <div className={`flex items-center gap-1 ${className}`}>
    <button onClick={() => scroll(-1)} tabIndex={showLeft ? 0 : -1} aria-label="Scroll tabs left" className={`${btnBase} ${showLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}><ChevronLeft size={14}/></button>
    <div ref={ref} className="flex flex-1 gap-1 overflow-x-auto scrollbar-hide" onScroll={check}>{children}</div>
    <button onClick={() => scroll(1)} tabIndex={showRight ? 0 : -1} aria-label="Scroll tabs right" className={`${btnBase} ${showRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}><ChevronRight size={14}/></button>
  </div>
);
};
