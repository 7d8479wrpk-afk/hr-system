import { Fragment, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './lib/auth'

const Mode = import.meta.env.PROD ? StrictMode : Fragment

createRoot(document.getElementById('root')!).render(
  <Mode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </Mode>,
)
