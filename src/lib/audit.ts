/**
 * Audit logging system for security events
 * Logs to Supabase table `audit_logs` with RLS
 */

import { supabase } from './supabase'

export type AuditEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_change'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'business_switch'
  | 'admin_action'
  | 'data_export'
  | 'permission_denied'
  | 'suspicious_activity'
  | 'config_change'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'role_assigned'
  | 'role_revoked'

export interface AuditLogEntry {
  event_type: AuditEventType
  user_id?: string
  business_id?: string
  target_user_id?: string
  target_business_id?: string
  ip_address?: string
  user_agent?: string
  details?: Record<string, unknown>
  severity: 'info' | 'warning' | 'error' | 'critical'
}

/**
 * Logs a security audit event
 * Uses the service role key on the server side (edge function)
 * On client, calls an edge function to log securely
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<{ success: boolean; error?: string }> {
  try {
    // In production, this should call an edge function with service_role key
    // For now, we'll use the anon client with a dedicated audit function
    
    const { error } = await (supabase.rpc as any)('log_audit_event', {
      p_event_type: entry.event_type,
      p_user_id: entry.user_id || null,
      p_business_id: entry.business_id || null,
      p_target_user_id: entry.target_user_id || null,
      p_target_business_id: entry.target_business_id || null,
      p_ip_address: entry.ip_address || null,
      p_user_agent: entry.user_agent || navigator.userAgent,
      p_details: entry.details || {},
      p_severity: entry.severity,
    })

    if (error) {
      console.error('Audit log error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Audit log exception:', error)
    return { success: false, error: 'Failed to log audit event' }
  }
}

/**
 * Convenience functions for common audit events
 */
export const audit = {
  loginSuccess: (userId: string, businessId: string, ip?: string) =>
    logAuditEvent({
      event_type: 'login_success',
      user_id: userId,
      business_id: businessId,
      ip_address: ip,
      severity: 'info',
    }),

  loginFailed: (email: string, reason: string, ip?: string) =>
    logAuditEvent({
      event_type: 'login_failed',
      ip_address: ip,
      details: { email, reason },
      severity: 'warning',
    }),

  logout: (userId: string, businessId: string) =>
    logAuditEvent({
      event_type: 'logout',
      user_id: userId,
      business_id: businessId,
      severity: 'info',
    }),

  passwordChange: (userId: string, businessId: string) =>
    logAuditEvent({
      event_type: 'password_change',
      user_id: userId,
      business_id: businessId,
      severity: 'info',
    }),

  passwordResetRequested: (email: string, ip?: string) =>
    logAuditEvent({
      event_type: 'password_reset_requested',
      ip_address: ip,
      details: { email },
      severity: 'info',
    }),

  passwordResetCompleted: (userId: string) =>
    logAuditEvent({
      event_type: 'password_reset_completed',
      user_id: userId,
      severity: 'info',
    }),

  businessSwitch: (userId: string, fromBusinessId: string, toBusinessId: string) =>
    logAuditEvent({
      event_type: 'business_switch',
      user_id: userId,
      business_id: toBusinessId,
      target_business_id: fromBusinessId,
      severity: 'info',
    }),

  adminAction: (userId: string, businessId: string, action: string, details: Record<string, unknown>) =>
    logAuditEvent({
      event_type: 'admin_action',
      user_id: userId,
      business_id: businessId,
      details: { action, ...details },
      severity: 'info',
    }),

  dataExport: (userId: string, businessId: string, exportType: string, recordCount: number) =>
    logAuditEvent({
      event_type: 'data_export',
      user_id: userId,
      business_id: businessId,
      details: { exportType, recordCount },
      severity: 'warning',
    }),

  permissionDenied: (userId: string, businessId: string, resource: string, action: string) =>
    logAuditEvent({
      event_type: 'permission_denied',
      user_id: userId,
      business_id: businessId,
      details: { resource, action },
      severity: 'warning',
    }),

  suspiciousActivity: (userId: string | undefined, businessId: string | undefined, activity: string, details: Record<string, unknown>) =>
    logAuditEvent({
      event_type: 'suspicious_activity',
      user_id: userId,
      business_id: businessId,
      details: { activity, ...details },
      severity: 'critical',
    }),

  configChange: (userId: string, businessId: string, configKey: string, oldValue: unknown, newValue: unknown) =>
    logAuditEvent({
      event_type: 'config_change',
      user_id: userId,
      business_id: businessId,
      details: { configKey, oldValue, newValue },
      severity: 'warning',
    }),

  userCreated: (actorId: string, businessId: string, newUserId: string, role: string) =>
    logAuditEvent({
      event_type: 'user_created',
      user_id: actorId,
      business_id: businessId,
      target_user_id: newUserId,
      details: { role },
      severity: 'info',
    }),

  userDeleted: (actorId: string, businessId: string, deletedUserId: string) =>
    logAuditEvent({
      event_type: 'user_deleted',
      user_id: actorId,
      business_id: businessId,
      target_user_id: deletedUserId,
      severity: 'warning',
    }),

  roleAssigned: (actorId: string, businessId: string, targetUserId: string, role: string) =>
    logAuditEvent({
      event_type: 'role_assigned',
      user_id: actorId,
      business_id: businessId,
      target_user_id: targetUserId,
      details: { role },
      severity: 'info',
    }),

  roleRevoked: (actorId: string, businessId: string, targetUserId: string, role: string) =>
    logAuditEvent({
      event_type: 'role_revoked',
      user_id: actorId,
      business_id: businessId,
      target_user_id: targetUserId,
      details: { role },
      severity: 'warning',
    }),
}

/**
 * Hook for React components to easily log audit events
 */
import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useBusiness } from '@/contexts/BusinessContext'

export function useAuditLog() {
  const { user } = useAuth()
  const { currentBusiness } = useBusiness()

  const log = useCallback(async (entry: Omit<AuditLogEntry, 'user_id' | 'business_id' | 'user_agent'>) => {
    return logAuditEvent({
      ...entry,
      user_id: user?.id,
      business_id: currentBusiness?.id,
      user_agent: navigator.userAgent,
    })
  }, [user?.id, currentBusiness?.id])

  return { log, ...audit }
}