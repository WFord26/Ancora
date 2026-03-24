/**
 * Next.js Edge Middleware
 *
 * Responsibilities:
 * 1. Detect subdomain and enforce authorization
 * 2. Redirect www/root to /landing, admin to /admin
 * 3. Add security headers to all responses
 *
 * Note: Redis-backed rate limiting runs in Node.js API route handlers via
 * src/lib/rate-limit.ts and cannot run here (Edge Runtime restriction).
 */

import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

/**
 * Extract subdomain from Host header
 * Examples:
 *   - localhost:3000 → undefined (root)
 *   - app.localhost:3000 → "app"
 *   - www.example.com → "www"
 *   - admin.example.com → "admin"
 */
function getSubdomain(host: string): string | undefined {
  const parts = host.split(":")[0].split(".")
  
  // Single part (localhost) or two parts (example.com) = no subdomain
  if (parts.length <= 2) {
    return undefined
  }
  
  // Return everything except the last two parts (domain.com)
  const subdomain = parts.slice(0, -2).join(".")
  return subdomain || undefined
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get("host") || ""
  const subdomain = getSubdomain(host)

  // ------------------------------------------------------------------
  // Subdomain-based routing logic
  // ------------------------------------------------------------------
  
  // Admin subdomain
  if (subdomain === "admin") {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/admin", request.url))
    }
    
    if (!pathname.startsWith("/admin")) {
      // Rewrite admin routes
      request.nextUrl.pathname = `/admin${pathname}`
      return NextResponse.rewrite(request.nextUrl)
    }
  }

  // Landing/WWW subdomain
  if (subdomain === "www" || (!subdomain && pathname === "/")) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/landing", request.url))
    }
    if (pathname.startsWith("/auth/")) {
      request.nextUrl.pathname = `/landing${pathname}`
      return NextResponse.rewrite(request.nextUrl)
    }
  }

  // ------------------------------------------------------------------
  // Authentication & Authorization checks
  // ------------------------------------------------------------------
  
  const isPublicRoute = 
    pathname === "/" || 
    pathname === "/landing" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/integrations/callback") ||
    pathname.startsWith("/public/")

  const isDashboardPath = pathname.startsWith("/dashboard")
  const isPortalPath = pathname.startsWith("/portal") && !pathname.includes("/login")
  const isAdminPath = pathname.startsWith("/admin/") && !pathname.startsWith("/admin/auth")
  const isProtectedApi = pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/api/integrations/callback")

  if ((isDashboardPath || isPortalPath || isAdminPath || isProtectedApi) && !isPublicRoute) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token) {
      if (isProtectedApi) {
        return new NextResponse(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        )
      }
      const loginUrl = new URL("/auth/signin", request.url)
      loginUrl.searchParams.set("callbackUrl", request.url)
      return NextResponse.redirect(loginUrl)
    }

    // Role-based routing at the edge (server still double-checks)
    if (isDashboardPath && token.role === "CLIENT") {
      return NextResponse.redirect(new URL("/portal", request.url))
    }
    if (isPortalPath && token.role !== "CLIENT") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    if (isAdminPath && token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  // ------------------------------------------------------------------
  // Security headers on all responses
  // ------------------------------------------------------------------
  const response = NextResponse.next()

  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  )
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  )
  // Permissive CSP — tighten per environment as needed
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-eval in dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  )

  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js)).*)",
  ],
}
