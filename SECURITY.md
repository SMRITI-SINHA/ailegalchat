# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅        |

## Reporting a Vulnerability

If you find a security vulnerability in Chakshi AI Hub, please **do not** open a public GitHub issue.

Instead, report it responsibly:

**Email:** security@chakshi.in  
**Response time:** We aim to acknowledge reports within 48 hours and provide a fix timeline within 7 business days.

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

We will credit researchers who report valid vulnerabilities (unless you prefer to remain anonymous).

## Security Controls

Chakshi AI Hub implements the following security controls:

- **Authentication:** JWT (RS256) via Supabase, verified on every request
- **Authorization:** PostgreSQL Row-Level Security — users only see their own data
- **Transport Security:** TLS 1.2+ enforced on all connections (HSTS enabled)
- **Input Validation:** Zod schema validation on all API inputs
- **XSS Protection:** DOMPurify (client) + sanitize-html (server) on all user content
- **Rate Limiting:** 60 req/min global, 20 req/min on AI endpoints, per user ID
- **Security Headers:** Helmet.js (X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS)
- **CORS:** Strict origin whitelist — only chakshi.in and chakshi.com
- **Iframe Embedding:** CSP frame-ancestors restricts embedding to Chakshi domains only
- **Audit Logging:** All user actions logged with userId, IP, and timestamp
- **Error Handling:** No stack traces or internal details exposed to clients
- **File Uploads:** 50MB limit, strict MIME type whitelist

## Zero Data Retention

Chakshi AI Hub does not retain user-submitted legal documents or chat content beyond the active session. Uploaded documents are processed in memory and stored only in your personal account namespace with database-level row isolation.

## SOC 2 Compliance

Chakshi is pursuing SOC 2 Type II certification. Our controls are designed to meet the AICPA Trust Service Criteria for Security and Confidentiality.

## Responsible Disclosure

We follow responsible disclosure principles. We ask that you:
1. Give us reasonable time to fix the issue before public disclosure
2. Do not access or modify data belonging to other users
3. Do not perform denial-of-service attacks

Thank you for helping keep Chakshi secure.
