import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/db"
import { Limiters, getIp } from "@/lib/rate-limit"
import { auditVoid, AuditActions } from "@/lib/audit"

const LOCKOUT_THRESHOLD = 5       // failed attempts before lockout
const LOCKOUT_DURATION_MS = 15 * 60 * 1000  // 15 minutes

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        // Extract IP for rate limiting and audit logging
        const ip = getIp(req as unknown as Request)

        // --- Rate limiting: 5 login attempts per IP per 15 minutes ---
        const limited = await Limiters.login(ip)
        if (!limited.success) {
          throw new Error("Too many login attempts. Please try again later.")
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email,
          },
          include: {
            tenant: true,
          },
        })

        if (!user || !user.passwordHash) {
          // Don't reveal whether the email exists
          auditVoid({
            tenantId: "unknown",
            action: AuditActions.LOGIN_FAILED,
            metadata: { email: credentials.email, reason: "user_not_found" },
            ipAddress: ip,
          })
          throw new Error("Invalid credentials")
        }

        if (!user.isActive) {
          auditVoid({
            tenantId: user.tenantId,
            userId: user.id,
            action: AuditActions.LOGIN_FAILED,
            metadata: { reason: "account_inactive" },
            ipAddress: ip,
          })
          throw new Error("Account is inactive")
        }

        // --- Account lockout check ---
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          const secondsLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
          auditVoid({
            tenantId: user.tenantId,
            userId: user.id,
            action: AuditActions.LOGIN_FAILED,
            metadata: { reason: "account_locked", secondsLeft },
            ipAddress: ip,
          })
          throw new Error(
            `Account is temporarily locked. Try again in ${Math.ceil(secondsLeft / 60)} minute(s).`
          )
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isPasswordValid) {
          const newAttempts = user.failedLoginAttempts + 1
          const shouldLock = newAttempts >= LOCKOUT_THRESHOLD

          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: newAttempts,
              ...(shouldLock && {
                lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
              }),
            },
          })

          if (shouldLock) {
            auditVoid({
              tenantId: user.tenantId,
              userId: user.id,
              action: AuditActions.ACCOUNT_LOCKED,
              metadata: { attempts: newAttempts, lockDurationMs: LOCKOUT_DURATION_MS },
              ipAddress: ip,
            })
          } else {
            auditVoid({
              tenantId: user.tenantId,
              userId: user.id,
              action: AuditActions.LOGIN_FAILED,
              metadata: { reason: "invalid_password", attempt: newAttempts },
              ipAddress: ip,
            })
          }

          throw new Error("Invalid credentials")
        }

        // --- Successful login: reset lockout counters ---
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        })

        auditVoid({
          tenantId: user.tenantId,
          userId: user.id,
          action: AuditActions.LOGIN_SUCCESS,
          ipAddress: ip,
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          timezone: user.timezone || user.tenant.timezone,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.tenantId = user.tenantId
        token.timezone = user.timezone || "UTC"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.tenantId = token.tenantId as string
        session.user.timezone = token.timezone as string
      }
      return session
    },
  },
}
