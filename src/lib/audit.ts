/**
 * Audit logging utility (SOC2 compliance).
 *
 * Records security-relevant and data-modifying events to the AuditLog table.
 * Failures are caught and logged to stderr — audit logging must never break
 * the primary operation.
 *
 * Usage:
 *   await audit({
 *     tenantId: session.user.tenantId,
 *     userId: session.user.id,
 *     action: "USER_UPDATED",
 *     entityType: "User",
 *     entityId: userId,
 *     metadata: { changes: diff },
 *     ipAddress: getIp(request),
 *   })
 */

import { prisma } from "@/db"

export type AuditEntry = {
  tenantId: string
  /** The authenticated user performing the action (null for pre-auth events) */
  userId?: string | null
  /** Action constant, e.g. "LOGIN_SUCCESS", "USER_UPDATED" */
  action: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Write an audit log entry. Never throws — errors are swallowed so they
 * don't interrupt the main request path.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ? (entry.metadata as object) : undefined,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    })
  } catch (err) {
    // Audit log failure must not break the primary operation
    console.error("[audit] Failed to write audit log:", err)
  }
}

/**
 * Non-blocking fire-and-forget audit call.
 * Use when you don't want to await the write (e.g. inside NextAuth callbacks).
 */
export function auditVoid(entry: AuditEntry): void {
  audit(entry).catch((err) => console.error("[audit] Unhandled write error:", err))
}

// ---------------------------------------------------------------------------
// Canonical action constants
// ---------------------------------------------------------------------------

export const AuditActions = {
  // Authentication
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  ACCOUNT_LOCKOUT_CHECKED: "ACCOUNT_LOCKOUT_CHECKED",

  // Users
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  USER_ACTIVATED: "USER_ACTIVATED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",

  // Clients
  CLIENT_CREATED: "CLIENT_CREATED",
  CLIENT_UPDATED: "CLIENT_UPDATED",
  CLIENT_DELETED: "CLIENT_DELETED",

  // Retainers
  RETAINER_CREATED: "RETAINER_CREATED",
  RETAINER_UPDATED: "RETAINER_UPDATED",

  // Invoices
  INVOICE_CREATED: "INVOICE_CREATED",
  INVOICE_UPDATED: "INVOICE_UPDATED",
  INVOICE_SENT: "INVOICE_SENT",
  INVOICE_VOIDED: "INVOICE_VOIDED",

  // Integrations
  INTEGRATION_CONNECTED: "INTEGRATION_CONNECTED",
  INTEGRATION_DISCONNECTED: "INTEGRATION_DISCONNECTED",

  // Settings
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
} as const

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions]
