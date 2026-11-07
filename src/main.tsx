import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { BusinessProvider } from '@/contexts/BusinessContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import i18n from './i18n' // Initialize i18n
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <ErrorBoundary>
        <AuthProvider>
          <BusinessProvider>
            <App />
            <Toaster richColors position="top-right" />
          </BusinessProvider>
        </AuthProvider>
      </ErrorBoundary>
    </I18nextProvider>
  </StrictMode>,
)