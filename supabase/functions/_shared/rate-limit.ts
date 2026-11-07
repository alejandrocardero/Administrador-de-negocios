/**
 * Rate limiting utility for Supabase Edge Functions
 * In-memory implementation with automatic cleanup
 * For production with multiple instances, use Redis/Upstash
 */

interface RateLimitEntry {
  count: number
  resetAt: number
  blockedUntil?: number
}

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  blockDurationMs?: number
  keyPrefix?: string
}

// Default configurations per endpoint type
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  auth: { windowMs: 60_000, maxRequests: 10, blockDurationMs: 300_000 }, // 10/min, block 5min
  api: { windowMs: 60_000, maxRequests: 30, blockDurationMs: 60_000 },   // 30/min, block 1min
  onboard: { windowMs: 60_000, maxRequests: 5, blockDurationMs: 600_000 }, // 5/min, block 10min
  default: { windowMs: 60_000, maxRequests: 60 }, // 60/min
}

// In-memory store (use Redis in production with multiple instances)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup interval
let cleanupInterval: number | null = null

/**
 * Starts the cleanup interval for expired entries
 */
function startCleanupInterval(): void {
  if (cleanupInterval) return
  
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now && (!entry.blockedUntil || entry.blockedUntil < now)) {
        rateLimitStore.delete(key)
      }
    }
  }, 60_000) // Clean every minute
}

/**
 * Stops the cleanup interval
 */
export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

/**
 * Generates a rate limit key from request
 */
function getRateLimitKey(req: Request, prefix: string = 'rl'): string {
  // Use IP from headers (Supabase sets these)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('x-real-ip') ||
             req.headers.get('cf-connecting-ip') ||
             'unknown'
  
  const path = new URL(req.url).pathname
  return `${prefix}:${ip}:${path}`
}

/**
 * Checks and updates rate limit for a request
 */
export function checkRateLimit(
  req: Request,
  configName: keyof typeof DEFAULT_CONFIGS = 'default'
): { allowed: boolean; remaining: number; resetAt: number; retryAfter?: number } {
  startCleanupInterval()
  
  const config = DEFAULT_CONFIGS[configName] || DEFAULT_CONFIGS.default
  const key = getRateLimitKey(req, config.keyPrefix || configName)
  const now = Date.now()
  
  const entry = rateLimitStore.get(key)
  
  // Check if blocked
  if (entry?.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
    }
  }
  
  // Reset window if expired
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    }
  }
  
  // Increment count
  entry.count++
  
  if (entry.count > config.maxRequests) {
    // Block if configured
    const blockedUntil = config.blockDurationMs ? now + config.blockDurationMs : entry.resetAt
    entry.blockedUntil = blockedUntil
    
    return {
      allowed: false,
      remaining: 0,
      resetAt: blockedUntil,
      retryAfter: Math.ceil((blockedUntil - now) / 1000),
    }
  }
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Adds rate limit headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  rateLimitInfo: ReturnType<typeof checkRateLimit>
): Response {
  const headers = new Headers(response.headers)
  headers.set('X-RateLimit-Limit', String(DEFAULT_CONFIGS[configName]?.maxRequests || 60))
  headers.set('X-RateLimit-Remaining', String(Math.max(0, rateLimitInfo.remaining)))
  headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimitInfo.resetAt / 1000)))
  
  if (rateLimitInfo.retryAfter) {
    headers.set('Retry-After', String(rateLimitInfo.retryAfter))
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Gets the config name from request path
 */
function getConfigNameFromPath(pathname: string): keyof typeof DEFAULT_CONFIGS {
  if (pathname.includes('/auth/') || pathname.includes('/login') || pathname.includes('/signup')) {
    return 'auth'
  }
  if (pathname.includes('/onboard')) {
    return 'onboard'
  }
  if (pathname.startsWith('/api/') || pathname.startsWith('/functions/')) {
    return 'api'
  }
  return 'default'
}

// Need to fix the configName reference in addRateLimitHeaders
// Let me fix this by passing configName explicitly
let configName: keyof typeof DEFAULT_CONFIGS = 'default'

export function checkRateLimitWithHeaders(
  req: Request
): { 
  response: Response | null; // null if allowed, Response if blocked
  rateLimitInfo: ReturnType<typeof checkRateLimit>
} {
  configName = getConfigNameFromPath(new URL(req.url).pathname)
  const rateLimitInfo = checkRateLimit(req, configName)
  
  if (!rateLimitInfo.allowed) {
    const response = new Response(
      JSON.stringify({ 
        error: 'Too Many Requests', 
        message: `Rate limit exceeded. Try again in ${rateLimitInfo.retryAfter} seconds.`,
        retryAfter: rateLimitInfo.retryAfter,
      }),
      { 
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(DEFAULT_CONFIGS[configName].maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateLimitInfo.resetAt / 1000)),
          'Retry-After': String(rateLimitInfo.retryAfter || 60),
        },
      }
    )
    return { response, rateLimitInfo }
  }
  
  return { response: null, rateLimitInfo }
}

/**
 * Middleware wrapper for edge functions
 */
export function withRateLimit(
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 })
    }
    
    const { response, rateLimitInfo } = checkRateLimitWithHeaders(req)
    
    if (response) {
      // Add CORS headers to error response
      const origin = req.headers.get('Origin')
      const corsHeaders = {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      }
      
      const blockedResponse = new Response(response.body, {
        status: response.status,
        headers: { ...response.headers, ...corsHeaders },
      })
      return blockedResponse
    }
    
    // Call the actual handler
    const handlerResponse = await handler(req)
    
    // Add rate limit headers to successful response
    const headers = new Headers(handlerResponse.headers)
    headers.set('X-RateLimit-Limit', String(DEFAULT_CONFIGS[configName].maxRequests))
    headers.set('X-RateLimit-Remaining', String(Math.max(0, rateLimitInfo.remaining)))
    headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimitInfo.resetAt / 1000)))
    
    return new Response(handlerResponse.body, {
      status: handlerResponse.status,
      statusText: handlerResponse.statusText,
      headers,
    })
  }
}

/**
 * Gets current rate limit status for a key (for debugging/admin)
 */
export function getRateLimitStatus(key: string): RateLimitEntry | undefined {
  return rateLimitStore.get(key)
}

/**
 * Clears rate limit for a specific key (admin action)
 */
export function clearRateLimit(key: string): boolean {
  return rateLimitStore.delete(key)
}

/**
 * Clears all rate limits (admin action)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear()
}