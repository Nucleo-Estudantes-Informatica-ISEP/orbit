import { ProviderHttp } from './provider-http';

describe('Google intake authorization', () => {
  const fetchBefore = global.fetch;
  beforeEach(() => {
    process.env.ACCESS_GOOGLE_CLIENT_EMAIL = 'orbit@example.com';
    process.env.ACCESS_GOOGLE_PRIVATE_KEY = 'test';
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: 'test-token', expires_in: 3600 }),
      });
  });
  afterEach(() => {
    global.fetch = fetchBefore;
    delete process.env.ACCESS_GOOGLE_CLIENT_EMAIL;
    delete process.env.ACCESS_GOOGLE_PRIVATE_KEY;
    jest.restoreAllMocks();
  });
  it('uses separate read-only Forms and Sheets scopes and token caches', async () => {
    const http = new ProviderHttp();
    const sign = jest
      .spyOn(http, 'signedJwt')
      .mockReturnValue('test-assertion');
    await http.google('forms');
    await http.google('forms');
    await http.google('sheets');
    expect(sign).toHaveBeenCalledTimes(2);
    expect(sign).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        scope:
          'https://www.googleapis.com/auth/forms.body.readonly https://www.googleapis.com/auth/forms.responses.readonly',
      }),
      'test',
    );
    expect(sign).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      }),
      'test',
    );
  });
});
