import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useBusiness } from '@/contexts/BusinessContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail, User, Lock, Building2 } from 'lucide-react'

interface LoginFormProps {
  mode?: 'email' | 'virtual'
  businessId?: string
  businessName?: string
  onSuccess?: () => void
}

export function LoginForm({ mode = 'email', businessId, businessName, onSuccess }: LoginFormProps) {
  const { login, loginVirtual } = useAuth()
  const { businesses } = useBusiness()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [selectedBusinessId, setSelectedBusinessId] = useState(businessId || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    let result
    if (mode === 'email') {
      result = await login(email, password)
    } else {
      if (!selectedBusinessId) {
        setError('Selecciona un negocio')
        setLoading(false)
        return
      }
      result = await loginVirtual(selectedBusinessId, username, password)
    }

    setLoading(false)

    if (result.success) {
      onSuccess?.()
    } else {
      setError(result.error || 'Error al iniciar sesión')
    }
  }

  if (mode === 'virtual' && businessId) {
    return (
      <Card className="w-full max-w-md mx-auto mt-12">
        <CardHeader className="text-center">
          <Building2 className="w-10 h-10 text-blue-600 mx-auto mb-2" />
          <CardTitle>Acceder a {businessName}</CardTitle>
          <CardDescription>Ingresa tus credenciales de {businessName}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="tu_usuario"
                  className="pl-10"
                  disabled={loading}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="tu_contraseña"
                  className="pl-10"
                  disabled={loading}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Building2 className="w-12 h-12 text-blue-600 mx-auto mb-3" />
          <CardTitle>AdminNegocio Pro</CardTitle>
          <CardDescription>Inicia sesión con tu email</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="pl-10"
                  disabled={loading}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="tu_contraseña"
                  className="pl-10"
                  disabled={loading}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {businesses.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="business">Negocio</Label>
                <select
                  id="business"
                  value={selectedBusinessId}
                  onChange={e => setSelectedBusinessId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                >
                  <option value="">Selecciona un negocio...</option>
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            <p>¿Primera vez? <a href="/onboarding" className="text-blue-600 hover:underline">Registrar mi negocio</a></p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function BusinessSelectorLogin() {
  const { businesses, loading: bizLoading } = useBusiness()
  const [selectedBusiness, setSelectedBusiness] = useState<typeof businesses[0] | null>(null)

  if (bizLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (!selectedBusiness) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Building2 className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <CardTitle>Selecciona tu Negocio</CardTitle>
            <CardDescription>Elige el negocio al que quieres acceder</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {businesses.map(biz => (
              <Button
                key={biz.id}
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => {
                  setSelectedBusiness(biz)
                }}
              >
                <Building2 className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-medium">{biz.nombre}</p>
                  <p className="text-xs text-slate-500">{biz.slug}</p>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <LoginForm
      mode="virtual"
      businessId={selectedBusiness.id}
      businessName={selectedBusiness.nombre}
      onSuccess={() => window.location.reload()}
    />
  )
}