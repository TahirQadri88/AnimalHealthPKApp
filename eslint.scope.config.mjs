// Temporal-dead-zone check. Run with: npm run lint:scope
//
// Separate from the default lint because it reports call-time-safe cases too — a function
// may legitimately reference a const declared further down, since it only runs later.
// Those are noise. What it is FOR is the render-time case, which crashes:
//
//   useEffect(() => {...}, [authUid]);   // deps are evaluated DURING render
//   const [authUid] = useState();        // ...so this must come first
//
// That shipped once and took the app down with "Cannot access 'f' before initialization".
// When you add or move a declaration, run this and check any NEW name it reports: if the
// use is in a dependency array, in JSX, or at the top level of a component body, it is a
// real crash. Inside a function body it is fine.
import base from './eslint.config.mjs';

export default base.map(c => ({
  ...c,
  rules: {
    ...c.rules,
    'no-use-before-define': ['error', { functions: false, variables: true, classes: false }],
  },
}));
