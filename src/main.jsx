import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

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
