import { Resend } from "resend"

// Lazy-initialize Resend client to avoid errors at build time
let resend: Resend | null = null

function getResendClient(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY || "")
  }
  return resend
}

const FROM_EMAIL = process.env.EMAIL_FROM || "Ancora <noreply@ancora.app>"

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

/**
 * Send an email via Resend.
 * Falls back to console.log in development if RESEND_API_KEY is not set.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  const { to, subject, html, text } = options

  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] RESEND_API_KEY not set. Email would have been sent:")
    console.log(`  To: ${Array.isArray(to) ? to.join(", ") : to}`)
    console.log(`  Subject: ${subject}`)
    console.log(`  Body: ${text || "(HTML only)"}`)
    return { success: true, id: "dev-mode" }
  }

  try {
    const resendClient = getResendClient()
    const result = await resendClient.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    })

    if (result.error) {
      console.error("[Email] Send failed:", result.error)
      return { success: false, error: result.error.message }
    }

    return { success: true, id: result.data?.id }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Email] Exception:", message)
    return { success: false, error: message }
  }
}

// ============================================
// Email Templates
// ============================================

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f4f4f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 24px; font-weight: 700; color: #09090b; margin: 0; }
    .header p { color: #71717a; font-size: 14px; margin-top: 4px; }
    .content { margin-bottom: 24px; }
    .btn { display: inline-block; background: #18181b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 14px; }
    .footer { text-align: center; color: #a1a1aa; font-size: 12px; margin-top: 32px; }
    .amount { font-size: 28px; font-weight: 700; color: #18181b; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f4f4f5; }
    .label { color: #71717a; font-size: 14px; }
    .value { font-weight: 500; font-size: 14px; }
    .warning { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px 16px; color: #92400e; font-size: 14px; margin: 16px 0; }
    .success { background: #dcfce7; border: 1px solid #86efac; border-radius: 8px; padding: 12px 16px; color: #166534; font-size: 14px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>Ancora</h1>
      </div>
      ${content}
    </div>
    <div class="footer">
      <p>This email was sent by Ancora Retainer Management</p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Invoice sent notification
 */
export async function sendInvoiceNotification(params: {
  to: string
  clientName: string
  invoiceNumber: string
  amount: number
  dueDate: string
  portalUrl: string
}) {
  const html = baseTemplate(`
    <div class="content">
      <p>Hi ${params.clientName},</p>
      <p>A new invoice has been generated for your account:</p>
      <div style="text-align: center; margin: 24px 0;">
        <p class="amount">$${params.amount.toFixed(2)}</p>
        <p class="label">Invoice ${params.invoiceNumber}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="label" style="padding: 8px 0;">Invoice Number</td>
          <td class="value" style="padding: 8px 0; text-align: right;">${params.invoiceNumber}</td>
        </tr>
        <tr>
          <td class="label" style="padding: 8px 0;">Amount Due</td>
          <td class="value" style="padding: 8px 0; text-align: right;">$${params.amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label" style="padding: 8px 0;">Due Date</td>
          <td class="value" style="padding: 8px 0; text-align: right;">${params.dueDate}</td>
        </tr>
      </table>
      <div style="text-align: center; margin-top: 24px;">
        <a href="${params.portalUrl}" class="btn">View Invoice & Pay</a>
      </div>
    </div>
  `)

  return sendEmail({
    to: params.to,
    subject: `Invoice ${params.invoiceNumber} - $${params.amount.toFixed(2)}`,
    html,
    text: `Invoice ${params.invoiceNumber} for $${params.amount.toFixed(2)} is due on ${params.dueDate}. View and pay at: ${params.portalUrl}`,
  })
}

/**
 * Payment received notification
 */
export async function sendPaymentReceivedNotification(params: {
  to: string
  clientName: string
  invoiceNumber: string
  amount: number
  paymentDate: string
}) {
  const html = baseTemplate(`
    <div class="content">
      <p>Hi ${params.clientName},</p>
      <div class="success">
        Payment of <strong>$${params.amount.toFixed(2)}</strong> received for invoice ${params.invoiceNumber}.
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="label" style="padding: 8px 0;">Invoice</td>
          <td class="value" style="padding: 8px 0; text-align: right;">${params.invoiceNumber}</td>
        </tr>
        <tr>
          <td class="label" style="padding: 8px 0;">Amount Paid</td>
          <td class="value" style="padding: 8px 0; text-align: right;">$${params.amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label" style="padding: 8px 0;">Payment Date</td>
          <td class="value" style="padding: 8px 0; text-align: right;">${params.paymentDate}</td>
        </tr>
      </table>
      <p>Thank you for your prompt payment!</p>
    </div>
  `)

  return sendEmail({
    to: params.to,
    subject: `Payment Received - Invoice ${params.invoiceNumber}`,
    html,
    text: `Payment of $${params.amount.toFixed(2)} received for invoice ${params.invoiceNumber} on ${params.paymentDate}. Thank you!`,
  })
}

/**
 * Retainer low hours warning
 */
export async function sendRetainerLowNotification(params: {
  to: string
  clientName: string
  retainerName: string
  usedHours: number
  includedHours: number
  percentUsed: number
  portalUrl: string
}) {
  const html = baseTemplate(`
    <div class="content">
      <p>Hi ${params.clientName},</p>
      <div class="warning">
        Your retainer <strong>${params.retainerName}</strong> has reached
        <strong>${params.percentUsed}%</strong> of included hours this period.
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="label" style="padding: 8px 0;">Hours Used</td>
          <td class="value" style="padding: 8px 0; text-align: right;">${params.usedHours}h of ${params.includedHours}h</td>
        </tr>
        <tr>
          <td class="label" style="padding: 8px 0;">Remaining</td>
          <td class="value" style="padding: 8px 0; text-align: right;">${(params.includedHours - params.usedHours).toFixed(1)}h</td>
        </tr>
      </table>
      <p>Additional hours beyond the included amount will be billed at your overage rate.</p>
      <div style="text-align: center; margin-top: 24px;">
        <a href="${params.portalUrl}" class="btn">View Retainer Details</a>
      </div>
    </div>
  `)

  return sendEmail({
    to: params.to,
    subject: `Retainer Alert: ${params.retainerName} at ${params.percentUsed}%`,
    html,
    text: `Your retainer ${params.retainerName} has used ${params.usedHours}h of ${params.includedHours}h (${params.percentUsed}%). Remaining: ${(params.includedHours - params.usedHours).toFixed(1)}h. View details at: ${params.portalUrl}`,
  })
}

/**
 * Internal admin notification for payment received
 */
export async function sendAdminPaymentNotification(params: {
  to: string | string[]
  clientName: string
  invoiceNumber: string
  amount: number
}) {
  const html = baseTemplate(`
    <div class="content">
      <div class="success">
        Payment of <strong>$${params.amount.toFixed(2)}</strong> received from
        <strong>${params.clientName}</strong> for invoice ${params.invoiceNumber}.
      </div>
    </div>
  `)

  return sendEmail({
    to: params.to,
    subject: `Payment Received: ${params.clientName} - $${params.amount.toFixed(2)}`,
    html,
    text: `Payment of $${params.amount.toFixed(2)} received from ${params.clientName} for invoice ${params.invoiceNumber}.`,
  })
}

/**
 * Magic link login email
 */
export async function sendMagicLinkEmail(params: {
  to: string
  loginUrl: string
}) {
  const html = baseTemplate(`
    <div class="content">
      <p>You requested a login link for the Ancora Client Portal.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${params.loginUrl}" class="btn">Sign In to Portal</a>
      </div>
      <p class="label" style="text-align: center;">This link expires in 15 minutes.</p>
      <p class="label" style="font-size: 12px; color: #a1a1aa;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `)

  return sendEmail({
    to: params.to,
    subject: "Your Ancora Login Link",
    html,
    text: `Sign in to the Ancora Client Portal: ${params.loginUrl} (expires in 15 minutes)`,
  })
}
