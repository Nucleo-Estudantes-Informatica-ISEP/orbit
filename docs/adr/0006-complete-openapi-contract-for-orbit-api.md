# Complete the ORBIT API contract before generated mobile integration

The shared API receives a comprehensive contract update covering every module rather than documenting only mobile-used endpoints. It replaces unvalidated request bodies with DTOs, validates body/query/parameter inputs, documents request and response schemas through OpenAPI, enables strict unknown-field rejection where compatibility permits, adds contract tests, updates web callers, and makes the generated specification the source for client generation.
