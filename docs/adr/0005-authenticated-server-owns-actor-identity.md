# Authenticated server owns actor identity

Mutation actor identity comes exclusively from the authenticated JWT, never from client-supplied `createdById` or `performedById`. Backend controllers/services for Task, Project, Event, Incident, comment, and Announcement flows enforce the rule, while web callers stop sending authoritative actor IDs.
