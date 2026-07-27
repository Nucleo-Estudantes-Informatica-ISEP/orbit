# Session token lifetimes

ORBIT uses a 15-minute access token and a 7-day refresh token. Clients perform one automatic refresh after an unauthorized response, retry requests once, and clear the session if refresh fails. This corrects the backend's current 15-minute refresh token and inconsistent refreshed access-token lifetime; web adopts refresh handling, while mobile stores both tokens only in Secure Store.
