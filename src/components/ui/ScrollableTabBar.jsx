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
// The arrows float over the ends of the row. They used to sit beside it and, invisible, still
// took up room: every tab row began a third of the way in, and the last tab was cut off against
// a solid arrow. Overlaid, the row uses its full width and an arrow appears only when there is
// more to scroll to.
const btnBase = `absolute top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border border-kt-line text-kt-sub hover:text-kt-ink shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-opacity ${bgClass || 'bg-white'}`;
return (
  <div className={`relative ${className}`}>
    <div ref={ref} className="flex gap-1 overflow-x-auto scrollbar-hide" onScroll={check}>{children}</div>
    <button onClick={() => scroll(-1)} tabIndex={showLeft ? 0 : -1} aria-hidden={!showLeft} aria-label="Scroll tabs left" className={`${btnBase} left-1 ${showLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}><ChevronLeft size={16} strokeWidth={1.5}/></button>
    <button onClick={() => scroll(1)} tabIndex={showRight ? 0 : -1} aria-hidden={!showRight} aria-label="Scroll tabs right" className={`${btnBase} right-1 ${showRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}><ChevronRight size={16} strokeWidth={1.5}/></button>
  </div>
);
};
