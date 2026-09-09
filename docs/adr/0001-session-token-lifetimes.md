# Session token lifetimes

Status: Accepted

Date: 2026-07-27

## Context

The current backend issues refresh tokens with a 15-minute lifetime and does not keep refreshed access-token lifetimes consistent. Web and mobile clients need one shared session-recovery rule.

## Decision

ORBIT uses a 15-minute access token and a rotating 30-day refresh session. Browser refresh values are opaque and live only in an `HttpOnly`, `SameSite=Strict` cookie; the database stores keyed HMAC-SHA-256 fingerprints. A client may attempt one automatic refresh only after a `401 Unauthorized` response, then retry the original request once. A `403 Forbidden` response must not trigger refresh. Explicit credential rejection clears the session, while transient network or server failure preserves the recoverable refresh session and fails closed on cached authorization.

Web adopts this refresh handling and keeps only the short-lived access token plus a non-sensitive session marker in web storage. Native clients must use a secure cookie jar for the same cookie-based contract; exposing refresh values to JavaScript or ordinary response bodies is intentionally unsupported.

## Consequences

- Backend login and refresh responses expose the access token and current user while rotating the refresh cookie.
- Clients avoid refresh loops and do not treat authorization failures as expired sessions.
- Logout and password changes revoke server-side refresh sessions.
- Implementation belongs to issue [#3](https://github.com/Nucleo-Estudantes-Informatica-ISEP/orbit/issues/3).
