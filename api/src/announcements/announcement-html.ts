import sanitizeHtml from 'sanitize-html';

export function sanitizeAnnouncementHtml(content: string) {
  return sanitizeHtml(content, {
    allowedTags: [
      'p',
      'br',
      'b',
      'strong',
      'i',
      'em',
      's',
      'u',
      'blockquote',
      'code',
      'pre',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'hr',
      'a',
    ],
    allowedAttributes: { a: ['href'], ol: ['start'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    nestingLimit: 32,
  });
}

export function safeAnnouncement<T extends { content: string }>(row: T): T {
  return { ...row, content: sanitizeAnnouncementHtml(row.content) };
}
