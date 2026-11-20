import { safeAnnouncement } from './announcement-html';

describe('announcement HTML policy', () => {
  it('cleans previously stored markup while preserving formatting and permitted links', () => {
    const row = safeAnnouncement({
      id: 'example',
      content:
        '<p data-example="kept-in-source"><strong>Meeting</strong><img alt="Map"><a href="https://example.invalid">Agenda</a></p>',
    });
    expect(row).toEqual({
      id: 'example',
      content:
        '<p><strong>Meeting</strong><a href="https://example.invalid">Agenda</a></p>',
    });
  });
});
