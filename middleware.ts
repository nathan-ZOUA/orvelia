// ============================================================================
// ORVÉLIA — NEXT.JS EDGE SECURITY & RBAC MIDDLEWARE
// Architect & Lead Engineering: Nathan Zoua (NZ)
// Protects /admin/* (Portal 3), /operations/* (Portal 2), and /api/* endpoints.
// ============================================================================

import {
  authorizePortalAccess,
  enforceRateLimit,
  getEnterpriseSecurityHeaders,
  verifyCsrfToken,
  PortalRole,
} from './src/lib/security/owasp-guard';

export interface EdgeRequestContext {
  pathname: string;
  method: string;
  clientIpHash: string;
  sessionId: string;
  userRole: PortalRole;
  csrfHeader?: string | null;
}

export function runOrveliaSecurityMiddleware(req: EdgeRequestContext) {
  const securityHeaders = getEnterpriseSecurityHeaders();

  // 1. Rate Limiting global (plus strict sur /api/auth et /api/checkout)
  const isSensitiveRoute =
    req.pathname.startsWith('/api/auth') ||
    req.pathname.startsWith('/api/checkout') ||
    req.pathname.startsWith('/api/webhooks');
  const limit = enforceRateLimit(
    req.clientIpHash,
    isSensitiveRoute ? 'SENSITIVE_API' : 'GLOBAL_WEB',
    isSensitiveRoute ? 20 : 60,
    60_000
  );

  if (!limit.allowed) {
    return {
      status: 429,
      headers: {
        ...securityHeaders,
        'Retry-After': String(limit.resetInSeconds),
      },
      body: { error: 'TOO_MANY_REQUESTS', retryAfterSeconds: limit.resetInSeconds },
    };
  }

  // 2. Isolation RBAC stricte des 3 Portails
  if (req.pathname.startsWith('/admin') || req.pathname.startsWith('/api/admin')) {
    const auth = authorizePortalAccess('ADMIN_PORTAL', req.userRole);
    if (!auth.granted) {
      return { status: 403, headers: securityHeaders, body: { error: auth.reason } };
    }
  } else if (req.pathname.startsWith('/operations') || req.pathname.startsWith('/api/operations')) {
    const auth = authorizePortalAccess('OPERATIONS_PORTAL', req.userRole);
    if (!auth.granted) {
      return { status: 403, headers: securityHeaders, body: { error: auth.reason } };
    }
  }

  // 3. Vérification CSRF sur toutes les mutations d'état (POST / PUT / DELETE hors webhooks signés)
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
  const isWebhook = req.pathname.startsWith('/api/webhooks/');
  if (isMutation && !isWebhook && process.env.CSRF_PROTECTION_ENABLED !== 'false') {
    const secret = process.env.AUTH_SECRET || '';
    const validCsrf = verifyCsrfToken(req.csrfHeader, req.sessionId, secret);
    if (!validCsrf) {
      return {
        status: 403,
        headers: securityHeaders,
        body: { error: 'CSRF_TOKEN_INVALID_OR_MISSING' },
      };
    }
  }

  return {
    status: 200,
    headers: {
      ...securityHeaders,
      'X-RateLimit-Remaining': String(limit.remaining),
    },
    body: { status: 'ALLOWED' },
  };
}

export function middleware(request: any) {
  const pathname = request.nextUrl?.pathname || '/';
  const ip = request.headers?.get('x-forwarded-for') || '127.0.0.1';
  const role = (request.cookies?.get('orvelia_role')?.value || 'CUSTOMER') as PortalRole;
  const session = request.cookies?.get('orvelia_session')?.value || 'guest_session';
  const csrf = request.headers?.get('x-csrf-token');

  const res = runOrveliaSecurityMiddleware({
    pathname,
    method: request.method || 'GET',
    clientIpHash: ip,
    sessionId: session,
    userRole: role,
    csrfHeader: csrf,
  });

  if (res.status !== 200) {
    return new Response(JSON.stringify(res.body), {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        ...(res.headers as Record<string, string>),
      },
    });
  }

  return undefined;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
