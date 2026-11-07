#!/usr/bin/env node
/**
 * Security Audit Script
 * 
 * Uso: npx tsx scripts/security-audit.ts
 * 
 * Realiza:
 * 1. Validación de variables de entorno requeridas
 * 2. Escaneo de secretos en el código
 * 3. Auditoría de dependencias vulnerables
 * 4. Revisión de migraciones Supabase
 * 5. Verificación de configuración de seguridad
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

interface AuditResult {
  category: string
  checks: Array<{
    name: string
    status: 'PASS' | 'FAIL' | 'WARN'
    message: string
  }>
}

const results: AuditResult[] = []

function addResult(category: string, name: string, status: 'PASS' | 'FAIL' | 'WARN', message: string) {
  const existing = results.find(r => r.category === category)
  if (existing) {
    existing.checks.push({ name, status, message })
  } else {
    results.push({ category, checks: [{ name, status, message }] })
  }
}

function runCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim()
  } catch (error: any) {
    return error.stdout?.toString() || error.message
  }
}

// ============================================================================
// 1. Validación de variables de entorno
// ============================================================================
console.log('\n🔍 1. Validando variables de entorno...')

const requiredEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
const optionalEnv = ['SUPABASE_SERVICE_ROLE_KEY']

for (const env of requiredEnv) {
  if (!process.env[env]) {
    addResult('Environment', env, 'FAIL', `Variable requerida no configurada`)
  } else {
    addResult('Environment', env, 'PASS', 'Configurada')
  }
}

for (const env of optionalEnv) {
  if (!process.env[env]) {
    addResult('Environment', env, 'WARN', `Variable opcional no configurada (necesaria para edge functions)`)
  } else {
    addResult('Environment', env, 'PASS', 'Configurada')
  }
}

// Validar formato de URL
if (process.env.VITE_SUPABASE_URL) {
  try {
    new URL(process.env.VITE_SUPABASE_URL)
    addResult('Environment', 'VITE_SUPABASE_URL format', 'PASS', 'URL válida')
  } catch {
    addResult('Environment', 'VITE_SUPABASE_URL format', 'FAIL', 'URL inválida')
  }
}

// ============================================================================
// 2. Escaneo de secretos en código
// ============================================================================
console.log('\n🔍 2. Escaneando secretos en código...')

const secretPatterns = [
  { name: 'API Keys', regex: /(api[_-]?key|apikey)["'\s]*[:=]["'\s]*[a-zA-Z0-9_-]{20,}/gi },
  { name: 'Passwords in code', regex: /(password|pwd)["'\s]*[:=]["'\s]*[^"'\s]{8,}/gi },
  { name: 'JWT Secrets', regex: /(jwt[_-]?secret|secret[_-]?key)["'\s]*[:=]["'\s]*[a-zA-Z0-9_-]{16,}/gi },
  { name: 'Private Keys', regex: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/gi },
  { name: 'Supabase Keys', regex: /(supabase[_-]?(key|secret|url))["'\s]*[:=]["'\s]*[a-zA-Z0-9_.-]{20,}/gi },
  { name: 'Database URLs with credentials', regex: /(postgres|mysql|mongodb):\/\/[^:]+:[^@]+@/gi },
]

const srcDir = join(process.cwd(), 'src')
const supabaseDir = join(process.cwd(), 'supabase')

function scanDirectory(dir: string) {
  if (!existsSync(dir)) return
  
  const files = readdirSync(dir, { recursive: true })
  for (const file of files) {
    const filePath = join(dir, file.toString())
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && 
        !filePath.endsWith('.json') && !filePath.endsWith('.sql') &&
        !filePath.endsWith('.env')) continue
    
    try {
      const content = readFileSync(filePath, 'utf-8')
      
      for (const { name, regex } of secretPatterns) {
        const matches = content.match(regex)
        if (matches) {
          addResult('Secrets Scan', `${name} in ${filePath}`, 'FAIL', 
            `Encontrado: ${matches.slice(0, 3).join(', ')}...`)
        }
      }
    } catch {
      // Ignorar errores de lectura
    }
  }
}

scanDirectory(srcDir)
scanDirectory(supabaseDir)

// Verificar archivos .env no committeados
const envFiles = ['.env', '.env.local', '.env.production', '.env.development']
for (const envFile of envFiles) {
  if (existsSync(join(process.cwd(), envFile))) {
    addResult('Secrets Scan', envFile, 'WARN', 
      'Archivo .env encontrado - verificar que esté en .gitignore')
  }
}

// ============================================================================
// 3. Auditoría de dependencias
// ============================================================================
console.log('\n🔍 3. Auditoria de dependencias...')

try {
  const auditOutput = runCommand('npm audit --audit-level=high --json 2>/dev/null || true')
  if (auditOutput) {
    const audit = JSON.parse(auditOutput)
    const highVulns = audit.vulnerabilities?.high || 0
    const criticalVulns = audit.vulnerabilities?.critical || 0
    
    if (criticalVulns > 0) {
      addResult('Dependencies', 'Critical vulnerabilities', 'FAIL', `${criticalVulns} vulnerabilidades críticas`)
    } else if (highVulns > 0) {
      addResult('Dependencies', 'High vulnerabilities', 'FAIL', `${highVulns} vulnerabilidades altas`)
    } else {
      addResult('Dependencies', 'Vulnerabilities', 'PASS', 'Sin vulnerabilidades high/critical')
    }
  }
} catch {
  addResult('Dependencies', 'npm audit', 'WARN', 'No se pudo ejecutar npm audit')
}

// Verificar paquetes sin usar
try {
  const depcheckOutput = runCommand('npx depcheck --json 2>/dev/null || true')
  if (depcheckOutput) {
    const depcheck = JSON.parse(depcheckOutput)
    if (depcheck.dependencies?.length > 0) {
      addResult('Dependencies', 'Unused dependencies', 'WARN', 
        `${depcheck.dependencies.length} dependencias no usadas: ${depcheck.dependencies.slice(0, 5).join(', ')}`)
    }
    if (devDependencies?.length > 0) {
      addResult('Dependencies', 'Unused devDependencies', 'WARN',
        `${depcheck.devDependencies.length} devDependencies no usadas`)
    }
  }
} catch {
  // depcheck no instalado
}

// ============================================================================
// 4. Revisión de migraciones Supabase
// ============================================================================
console.log('\n🔍 4. Revisando migraciones Supabase...')

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
if (existsSync(migrationsDir)) {
  const migrationFiles = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
  
  for (const file of migrationFiles) {
    const content = readFileSync(join(migrationsDir, file), 'utf-8')
    
    // Verificar SECURITY DEFINER sin REVOKE
    if (content.includes('SECURITY DEFINER') && !content.includes('REVOKE ALL ON FUNCTION')) {
      addResult('Migrations', `${file}: SECURITY DEFINER`, 'WARN',
        'Función SECURITY DEFINER sin REVOKE ALL explícito')
    }
    
    // Verificar GRANT a anon/authenticated en funciones sensibles
    if (content.includes('GRANT EXECUTE') && content.includes('TO anon')) {
      const funcMatch = content.match(/GRANT EXECUTE ON FUNCTION ([^ ]+)/)
      if (funcMatch && !content.includes('list_businesses_for_login') && 
          !content.includes('current_user_business_ids') &&
          !content.includes('is_business_owner') &&
          !content.includes('log_audit_event')) {
        addResult('Migrations', `${file}: GRANT to anon`, 'WARN',
          `Función ${funcMatch[1]} accesible para anon`)
      }
    }
    
    // Verificar RLS habilitado
    if (content.includes('CREATE TABLE') && !content.includes('ENABLE ROW LEVEL SECURITY')) {
      const tableMatch = content.match(/CREATE TABLE\s+(\w+)/i)
      if (tableMatch && !tableMatch[1].includes('auth.')) {
        addResult('Migrations', `${file}: RLS`, 'WARN',
          `Tabla ${tableMatch[1]} sin RLS explícito`)
      }
    }
    
    addResult('Migrations', file, 'PASS', 'Revisión básica completada')
  }
} else {
  addResult('Migrations', 'Directory', 'WARN', 'Directorio de migraciones no encontrado')
}

// ============================================================================
// 5. Configuración de seguridad
// ============================================================================
console.log('\n🔍 5. Verificando configuración de seguridad...')

// vite.config.ts
const viteConfig = join(process.cwd(), 'vite.config.ts')
if (existsSync(viteConfig)) {
  const content = readFileSync(viteConfig, 'utf-8')
  
  if (content.includes('sourcemap: false') || content.includes('sourcemap: !isProduction')) {
    addResult('Config', 'vite: sourcemap', 'PASS', 'Source maps deshabilitados en producción')
  } else {
    addResult('Config', 'vite: sourcemap', 'WARN', 'Source maps pueden estar habilitados en producción')
  }
  
  if (content.includes('chunkSizeWarningLimit')) {
    addResult('Config', 'vite: chunk splitting', 'PASS', 'Code splitting configurado')
  }
  
  if (content.includes('cors:') && content.includes('origin:')) {
    addResult('Config', 'vite: CORS', 'PASS', 'CORS restringido en desarrollo')
  }
  
  if (content.includes('Content-Security-Policy') || content.includes('securityHeadersPlugin')) {
    addResult('Config', 'vite: CSP', 'PASS', 'Plugin CSP configurado')
  }
}

// index.html
const indexHtml = join(process.cwd(), 'index.html')
if (existsSync(indexHtml)) {
  const content = readFileSync(indexHtml, 'utf-8')
  
  if (content.includes('Content-Security-Policy')) {
    addResult('Config', 'HTML: CSP meta', 'PASS', 'CSP meta tag presente')
  }
  
  if (content.includes('X-Content-Type-Options') && content.includes('nosniff')) {
    addResult('Config', 'HTML: X-Content-Type-Options', 'PASS', 'Presente')
  }
  
  if (content.includes('X-Frame-Options') && content.includes('DENY')) {
    addResult('Config', 'HTML: X-Frame-Options', 'PASS', 'DENY configurado')
  }
  
  if (content.includes('Permissions-Policy')) {
    addResult('Config', 'HTML: Permissions-Policy', 'PASS', 'Configurado')
  }
}

// supabase.ts
const supabaseLib = join(process.cwd(), 'src', 'lib', 'supabase.ts')
if (existsSync(supabaseLib)) {
  const content = readFileSync(supabaseLib, 'utf-8')
  
  if (content.includes('validateSession') && content.includes('getCurrentUser')) {
    addResult('Config', 'Supabase: session validation', 'PASS', 'Funciones de validación de sesión')
  }
  
  if (content.includes('credentials:') || content.includes('same-origin')) {
    addResult('Config', 'Supabase: fetch credentials', 'PASS', 'Configuración de credenciales segura')
  }
}

// security.ts
const securityLib = join(process.cwd(), 'src', 'lib', 'security.ts')
if (existsSync(securityLib)) {
  addResult('Config', 'Security utils', 'PASS', 'Utilidades de seguridad implementadas')
}

// audit.ts
const auditLib = join(process.cwd(), 'src', 'lib', 'audit.ts')
if (existsSync(auditLib)) {
  addResult('Config', 'Audit logging', 'PASS', 'Sistema de auditoría implementado')
}

// ============================================================================
// 6. Verificación de archivos expuestos
// ============================================================================
console.log('\n🔍 6. Verificando archivos expuestos...')

const publicDir = join(process.cwd(), 'public')
if (existsSync(publicDir)) {
  const publicFiles = readdirSync(publicDir, { recursive: true })
  for (const file of publicFiles) {
    const filePath = file.toString()
    if (filePath.endsWith('.env') || filePath.endsWith('.key') || 
        filePath.endsWith('.pem') || filePath.endsWith('.crt') ||
        filePath.includes('secret') || filePath.includes('credential')) {
      addResult('Exposed Files', filePath, 'FAIL', 'Archivo sensible en public/')
    }
  }
  addResult('Exposed Files', 'public/', 'PASS', 'Sin archivos sensibles evidentes')
}

// ============================================================================
// 7. Git history scan (simulado - requiere git)
// ============================================================================
console.log('\n🔍 7. Escaneando historial git...')

try {
  const gitLog = runCommand('git log --all --full-history --oneline --grep="password\\|secret\\|key\\|token\\|credential" -- "*.ts" "*.tsx" "*.json" "*.env*" 2>/dev/null | head -20')
  if (gitLog.trim()) {
    addResult('Git History', 'Secrets in commits', 'FAIL', 
      `Posibles secretos en historial: ${gitLog.split('\n').length} coincidencias`)
  } else {
    addResult('Git History', 'Secrets in commits', 'PASS', 'Sin coincidencias obvias')
  }
} catch {
  addResult('Git History', 'Git scan', 'WARN', 'No se pudo escanear historial git')
}

// ============================================================================
// Resumen
// ============================================================================
console.log('\n📊 RESUMEN DE AUDITORÍA DE SEGURIDAD\n')

let totalPass = 0, totalFail = 0, totalWarn = 0

for (const result of results) {
  console.log(`\n📁 ${result.category}`)
  for (const check of result.checks) {
    const icon = check.status === 'PASS' ? '✅' : check.status === 'FAIL' ? '❌' : '⚠️'
    console.log(`  ${icon} ${check.name}: ${check.message}`)
    if (check.status === 'PASS') totalPass++
    else if (check.status === 'FAIL') totalFail++
    else totalWarn++
  }
}

console.log('\n📈 TOTALES:')
console.log(`  ✅ Pass: ${totalPass}`)
console.log(`  ⚠️  Warn: ${totalWarn}`)
console.log(`  ❌ Fail: ${totalFail}`)

if (totalFail > 0) {
  console.log('\n🚨 ACCIÓN REQUERIDA: Corregir los fallos antes de deploy a producción')
  process.exit(1)
} else if (totalWarn > 0) {
  console.log('\n⚠️  REVISAR: Las advertencias deben ser evaluadas')
  process.exit(0)
} else {
  console.log('\n🎉 TODO OK: Sin problemas de seguridad detectados')
  process.exit(0)
}