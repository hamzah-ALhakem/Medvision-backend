# MedVision — Security Documentation

**Project:** MedVision Medical Platform  
**Author:** [Your Name] — Security Engineer  
**Date:** June 2026  

---

## Implemented Security Controls

| # | Control | Where | Status |
|---|---------|-------|--------|
| 1 | JWT authentication (jsonwebtoken) | Backend | ✅ |
| 2 | Password hashing (bcryptjs, salt=10) | Backend | ✅ |
| 3 | Security headers (Helmet.js) | Backend `server.js` | ✅ |
| 4 | CORS restricted to frontend domain only | Backend `server.js` | ✅ |
| 5 | Rate limiting on auth routes (IP-based, 10 req/15min) | Backend `auth.routes.js` | ✅ |
| 6 | Role-based access control (PATIENT / DOCTOR / ADMIN) | Backend middleware | ✅ |
| 7 | SQL injection prevention (Prisma parameterized queries) | Backend | ✅ |
| 8 | Input validation on all routes (express-validator) | Backend validators | ✅ |
| 9 | Password never returned in any API response | Backend all controllers | ✅ |
| 10 | Email verification on registration (magic link) | Backend + Frontend | ✅ |
| 11 | Password reset via expiring token (1-hour window) | Backend + Frontend | ✅ |
| 12 | HTTPS enforcement in production (301 redirect) | Backend `server.js` | ✅ SEC-06 |
| 13 | Expired JWT cleared on page load | Frontend `AuthContext.jsx` | ✅ SEC-02 |
| 14 | Per-account login lockout (5 attempts → 15 min) | Backend `auth.service.js` | ✅ SEC-04 |
| 15 | Password change invalidates existing sessions (tokenVersion) | Backend middleware + controller | ✅ SEC-05 |

---

## Known Limitations

### SEC-01 — JWT Stored in localStorage (XSS Risk)

**Risk Level:** Medium

Authentication tokens are stored in the browser's `localStorage`.
Any JavaScript running on the page can read them via `localStorage.getItem('token')`.
If an attacker successfully injects malicious JavaScript (XSS), they could steal the token
and impersonate the user for up to 7 days.

**Industry-standard fix:** Store tokens in `HttpOnly` cookies instead.
These cannot be read by JavaScript at all, completely eliminating the XSS token-theft vector.

**Why not implemented here:** Switching to `HttpOnly` cookies requires:
- Backend: Add `Set-Cookie` header on login, read cookie instead of Authorization header
- Backend: Add CSRF protection (cookies are vulnerable to CSRF without it)
- Frontend: Remove all `localStorage` token usage, update axios config

This is a significant refactor beyond the current project scope.

**Mitigations already in place:**
- Helmet.js sets `X-XSS-Protection` and `Content-Security-Policy` headers
- Input validation on all routes prevents stored XSS via API inputs
- 7-day token expiry limits maximum exposure window
- Expired tokens cleared on page load (SEC-02)

---

### SEC-03 — No Token Invalidation on Logout

**Risk Level:** Low–Medium

When a user logs out, the frontend deletes the token from `localStorage`.
However, the JWT itself remains cryptographically valid on the server until its 7-day expiry.
If the token was captured before logout (e.g., from browser history, a shared device,
or network capture), it can still be used for the remaining validity period.

**Industry-standard fix:** Maintain a server-side token blocklist (typically using Redis).
On every authenticated request, check that the token ID is not in the blocklist.
On logout, add the token to the blocklist with TTL matching the token's remaining lifetime.

**Why not implemented here:** Requires:
- Infrastructure: Redis instance (or equivalent)
- Backend: Blocklist check on every API request (latency overhead)
- Backend: Blocklist cleanup job

This adds infrastructure complexity and per-request latency beyond project scope.

**Mitigations already in place:**
- Password change immediately invalidates all existing sessions (tokenVersion — SEC-05)
- 7-day expiry limits the maximum exposure window
- HTTPS prevents token interception in transit (SEC-06)
- Expired tokens cleared on page load (SEC-02)

---

## Security Testing

All security controls are verified by automated tests:

- **271 backend tests** — including a dedicated security test suite (`tests/security/security.test.js`)
- **SEC-01 to SEC-27** — Authentication bypass, RBAC, data isolation, injection, sensitive data exposure
- **Bug fix verification** — All 6 security-related bugs confirmed fixed
- **Load testing** — Double-booking prevention held under concurrent load

See `BACKEND_TESTING_REPORT.md` for full test results.
