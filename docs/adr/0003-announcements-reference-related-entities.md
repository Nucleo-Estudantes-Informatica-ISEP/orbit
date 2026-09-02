# Announcements reference related entities

System-generated Announcements carry a validated `relatedEntityType` (`TASK`, `EVENT`, or `PROJECT`) and `relatedEntityId`, allowing each client to map the same domain reference to its own route. Task assignment, event creation, and project creation populate these fields; ordinary Announcements still open their own detail.
