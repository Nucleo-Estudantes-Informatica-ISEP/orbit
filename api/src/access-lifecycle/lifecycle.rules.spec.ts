import { ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  assertScope,
  assertDecision,
  assertOperationIdentity,
  policyMatches,
  protectAdminLinks,
} from './lifecycle.rules';

describe('access lifecycle security rules', () => {
  it('hides private links inside operation and approval snapshots without changing the stored snapshot', () => {
    const source = {
      operations: [
        {
          resourceSnapshot: {
            adminUrl: 'https://chat.whatsapp.com/private',
            name: 'Group',
          },
        },
      ],
      approvals: [{ snapshot: { adminUrl: 'https://example.com/private' } }],
    };
    const view = protectAdminLinks(source, false);
    expect(view.operations[0].resourceSnapshot.adminUrl).toBeNull();
    expect(view.approvals[0].snapshot.adminUrl).toBeNull();
    expect(source.operations[0].resourceSnapshot.adminUrl).toContain('private');
    expect(protectAdminLinks(source, true)).toBe(source);
  });
  it('requires every target department to be within the operator scope', () => {
    expect(() => assertScope('a', false, ['a', 'b'])).toThrow(
      ForbiddenException,
    );
    expect(() => assertScope('a', false, [])).toThrow(ForbiddenException);
    expect(() => assertScope('a', false, ['a'])).not.toThrow();
    expect(() => assertScope('a', true, ['b'])).not.toThrow();
  });
  it('prevents self approval and decisions after submission has been decided', () => {
    expect(() => assertDecision('one', 'one', 'PENDING_APPROVAL')).toThrow(
      ForbiddenException,
    );
    expect(() => assertDecision('one', 'two', 'APPROVED')).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertDecision('one', 'two', 'PENDING_APPROVAL'),
    ).not.toThrow();
  });
  it('requires a revocation account while the provider verifies its identity', () => {
    expect(() => assertOperationIdentity('REVOKE', '')).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertOperationIdentity('REVOKE', 'person@example.com'),
    ).not.toThrow();
    expect(() => assertOperationIdentity('REVOKE', 'remote-id')).not.toThrow();
  });
  it('applies department and position selectors together', () => {
    const policy = { departmentIds: ['it'], positions: ['COORDINATOR'] };
    expect(policyMatches(policy, ['it'], ['MEMBER'])).toBe(false);
    expect(policyMatches(policy, ['marketing'], ['COORDINATOR'])).toBe(false);
    expect(policyMatches(policy, ['it'], ['COORDINATOR'])).toBe(true);
    expect(
      policyMatches({ departmentIds: [], positions: [] }, ['it'], []),
    ).toBe(true);
  });
});
