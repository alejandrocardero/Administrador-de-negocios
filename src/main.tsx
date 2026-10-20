import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@/contexts/AuthContext'
import { BusinessProvider } from '@/contexts/BusinessContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <BusinessProvider>
          <App />
        </BusinessProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)