import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { requestPersistentStorage } from './lib/offlineStorage'

// Everything this app can do offline rests on the Firestore cache in IndexedDB, and by
// default a browser may evict that under storage pressure — which on a phone is normal.
// Ask for the durable bucket instead. It is a request, not a guarantee, and it is
// fire-and-forget: it must never delay or break start-up, which is why it cannot throw.
requestPersistentStorage().then(granted => {
  if (granted === false) console.warn('[offline] the browser refused persistent storage — the offline cache may be evicted');
})

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
