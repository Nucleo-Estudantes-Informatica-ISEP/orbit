# Separate member self-service from user administration

Profile editing uses authenticated self-service endpoints for changing the member's own name and for changing a password after verifying the current password. Generic `/users/:id` administration remains permission-gated and retains role, status, department, and email management. Web migrates to the self-service contract before mobile consumes it.
