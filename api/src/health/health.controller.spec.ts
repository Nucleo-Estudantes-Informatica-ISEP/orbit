import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports a healthy process', () => {
    expect(new HealthController().getHealth()).toEqual({ status: 'ok' });
  });
});
