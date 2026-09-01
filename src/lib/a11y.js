// Shared arrow-key handler for tab/pill groups — roving tabIndex pattern
// items: string[], current: active item id, set: setter fn, groupAttr: data-* attribute name
export const makeArrowNav = (items, current, set, groupAttr) => (e) => {
  const dirs = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 };
  if (!(e.key in dirs) && e.key !== 'Home' && e.key !== 'End') return;
  e.preventDefault();
  const idx = items.indexOf(current);
  let next;
  if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = items.length - 1;
  else next = (idx + dirs[e.key] + items.length) % items.length;
  set(items[next]);
  document.querySelector(`[${groupAttr}="${items[next]}"]`)?.focus();
};
