# Session token lifetimes

Status: Proposed

Date: 2026-07-27

## Context

The current backend issues refresh tokens with a 15-minute lifetime and does not keep refreshed access-token lifetimes consistent. Web and mobile clients need one shared session-recovery rule.

## Decision

ORBIT uses a 15-minute access token and a 7-day refresh token. A client may attempt one automatic refresh only after a `401 Unauthorized` response, then retry the original request once. A `403 Forbidden` response must not trigger refresh. If refresh or retry fails, the client clears its session.

Web adopts this refresh handling. Mobile stores access and refresh tokens only in Secure Store.

## Consequences

- Backend login and refresh responses must expose consistent token lifetimes.
- Clients avoid refresh loops and do not treat authorization failures as expired sessions.
- Implementation belongs to issue [#3](https://github.com/Nucleo-Estudantes-Informatica-ISEP/orbit/issues/3).
