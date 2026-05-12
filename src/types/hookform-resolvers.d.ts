declare module '@hookform/resolvers/zod' {
  import type { Resolver } from 'react-hook-form'
  import { z } from 'zod'

  export function zodResolver<T>(
    schema: z.ZodType<T>,
    options?: {
      mode?: 'sync' | 'async'
      nativeEnumNaming?: boolean
    }
  ): Resolver<T>
}