import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// The Khyber Traders type: DM Sans for reading and typing, EB Garamond for headings and money.
// Self-hosted and Latin only, so they are cached with the app and work offline.
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-600.css'
import '@fontsource/eb-garamond/latin-400.css'
import '@fontsource/eb-garamond/latin-500.css'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/latin-800.css'
import App from './App'
import { requestPersistentStorage } from './lib/offlineStorage'
import { captureInstallPrompt } from './lib/installPrompt'

// Everything this app can do offline rests on the Firestore cache in IndexedDB, and by
// default a browser may evict that under storage pressure — which on a phone is normal.
// Ask for the durable bucket instead. It is a request, not a guarantee, and it is
// fire-and-forget: it must never delay or break start-up, which is why it cannot throw.
requestPersistentStorage().then(granted => {
  if (granted === false) console.warn('[offline] the browser refused persistent storage — the offline cache may be evicted');
})

// beforeinstallprompt fires once, early, and often before any screen is mounted. Capture it
// here or the offer is gone — and an installed app is how the browser is persuaded to keep
// the offline cache it refuses to keep for an ordinary tab.
captureInstallPrompt()

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  componentDidCatch(error) {
    this.setState({ error })
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:'20px',fontFamily:'monospace',color:'red',background:'#fff',minHeight:'100vh'}}>
          <h2>App Error</h2>
          <pre style={{whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{String(this.state.error)}</pre>
          <pre style={{whiteSpace:'pre-wrap',wordBreak:'break-all',fontSize:'12px',color:'#666'}}>{this.state.error?.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

const root = createRoot(document.getElementById('root'))
root.render(<ErrorBoundary><App /></ErrorBoundary>)
