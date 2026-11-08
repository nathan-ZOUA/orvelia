# ORVÉLIA — Enterprise E-Commerce Platform (3-Portal Architecture)

**Lead Software Architect, Full-Stack Engineer & Creative Director:** Nathan Zoua (`NZ`)  
**Positioning:** *Luxury Meets Modern Technology* — International & African Sovereign E-Commerce Platform  
**Core Stack:** Next.js (App Router, Strict TypeScript), Tailwind CSS, PostgreSQL 16, Prisma ORM (25 Relational Models), OWASP Top 10 Security Engine, Multi-Gateway Payment Engine (Notch Pay, CinetPay, CamPay, Flutterwave v3), Shopify Hybrid GraphQL Connector (`Storefront API` + `Admin API`).

---

## 1. Executive Summary (Upwork Portfolio Case Study)

**ORVÉLIA** is an enterprise-grade, multi-portal luxury e-commerce application engineered from the ground up to meet the highest standards of international luxury retail (Paris, Geneva, Dubai) and African fintech integration (Douala, Yaoundé, Abidjan, Dakar).

Unlike standard e-commerce templates, ORVÉLIA separates operations into **three strictly isolated RBAC portals**:
1. **🛍️ Portal 1 — Storefront & Client Portal (`CUSTOMER`)**: Immersive editorial experience, 7 signature collections, dynamic multi-criteria filtering with real-time stock reservation, 6-step checkout (guest or member), and a complete client space (order history, DHL tracking, wishlist, GDPR account anonymization).
2. **🎧 Portal 2 — Operations & Live Concierge Portal (`SUPPORT_AGENT` / `CATALOG_MANAGER`)**: Real-time bidirectional customer-to-human-agent messaging console (`Conversations` + `Messages`), read receipts (`readAt`), secure attachment handling, authorized order dossier inspection, and one-click ticket resolution.
3. **🏛️ Portal 3 — Executive & Super-Admin Portal (`SUPER_ADMIN` / `FINANCE_ADMIN`)**: Real-time revenue KPIs, Chart.js analytics, instant catalog publishing, live stock incrementation, order fulfillment workflow, `.env.local` backend key diagnostics, and an interactive **OWASP SIEM Security Center**.

---

## 2. Clean Modular Project Structure

```text
orvelia-enterprise/
├── .env.example                                  # Clean environment template (Zero hardcoded secrets)
├── .env.local                                    # Local server configuration (Git-ignored in production)
├── middleware.ts                                 # Next.js Edge Middleware (RBAC, Rate Limiting, CSRF, Security Headers)
├── prisma/
│   └── schema.prisma                             # 25 ACID-compliant PostgreSQL relational models & indexes
├── src/
│   ├── lib/
│   │   ├── security/
│   │   │   └── owasp-guard.ts                    # RBAC Guard, Sliding-Window Rate Limiter, HMAC CSRF, XSS Sanitizer
│   │   ├── payments/
│   │   │   └── payment-engine.ts                 # State Machine + NotchPay, CinetPay, CamPay & Flutterwave Adapters
│   │   └── shopify/
│   │       └── shopify-connector.ts              # Hybrid Shopify Storefront & Admin GraphQL Synchronizer
│   └── app/
│       └── api/
│           ├── checkout/
│           │   └── route.ts                      # Server-side price recalculation & gateway initiation via process.env
│           └── webhooks/
│               ├── notchpay/route.ts             # Constant-time HMAC-SHA256 verification (x-notch-signature)
│               └── flutterwave/route.ts          # Constant-time verif-hash check + S2S /v3/transactions/{id}/verify
├── tests/
│   └── run_verification_suite.py                 # Automated verification suite (Schema, Payments, Security, WCAG, i18n)
└── docs/
    └── ORVELIA_DOCUMENTATION_COMPLETE.md         # Architecture, KYB/KYC Payment Guide & Production Deployment Runbook
```

---

## 3. Defense-in-Depth Security Architecture (OWASP Top 10 Compliance)

| OWASP Category | Threat Mitigated | Implementation in ORVÉLIA |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | Unauthorized access to Admin or Staff tools | `authorizePortalAccess()` in `middleware.ts` enforces strict role separation across `CUSTOMER_PORTAL`, `OPERATIONS_PORTAL`, and `ADMIN_PORTAL`. |
| **A02: Cryptographic Failures** | Exposed API keys or forged webhook events | Zero API keys in frontend code; all gateway keys are read exclusively from `process.env`. Webhooks are verified using constant-time `crypto.timingSafeEqual` HMAC-SHA256. |
| **A03: Injection (SQLi & XSS)** | Malicious `<script>` payloads or SQL injection | Strict server & client HTML entity escaping (`sanitizeStrictString` / `escapeHtmlStrict`) combined with Prisma ORM parameterized queries. |
| **A04: Insecure Design & Brute Force** | Credential stuffing & checkout spam | Sliding-window rate limiter (`enforceRateLimit`: 20 req/min on sensitive APIs, 60 req/min global) + idempotency keys (`txRef`) preventing double charges. |
| **A05: Security Misconfiguration** | Clickjacking, MIME sniffing, missing TLS | `getEnterpriseSecurityHeaders()` injects `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and strict `Permissions-Policy`. |
| **A08: Software & Data Integrity** | Client-side cart total or currency tampering | Server recalculates all item prices, coupon discounts (`ORVELIA10`, `PRIVILEGE20`), shipping, and Cameroon VAT (`19.25%`) before initiating any charge. |

---

## 4. Quick Start & Backend Key Configuration

1. **Configure your backend environment variables** in `.env.local` (never in frontend files):
   ```ini
   PAYMENT_ACTIVE_PROVIDER="NOTCHPAY"
   NOTCHPAY_PUBLIC_KEY="pk_test_..."
   NOTCHPAY_SECRET_KEY="sk_test_..."
   NOTCHPAY_WEBHOOK_HASH="hsk_test_..."
   DATABASE_URL="postgresql://user:password@localhost:5432/orvelia_db"
   AUTH_SECRET="generate_with_openssl_rand_base64_32"
   ```
2. **Initialize PostgreSQL & Prisma**:
   ```bash
   npx prisma migrate dev --name init_orvelia_25_models
   npx prisma generate
   ```
3. **Run the automated verification suite**:
   ```bash
   python3 tests/run_verification_suite.py
   ```
# orvelia
