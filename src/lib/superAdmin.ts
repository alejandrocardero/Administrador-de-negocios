const SUPER_ADMIN_EMAILS = [
  'alejandrolazarocard@gmail.com',
]

export function isSuperAdmin(email?: string): boolean {
  if (!email) return false
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase())
}