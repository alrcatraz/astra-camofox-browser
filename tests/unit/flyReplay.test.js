/**
 * Tests for horizontal scaling: tab ID encoding and fly-replay routing.
 */

// We can't easily import from server.js (it starts Express), so replicate the
// pure functions here. These MUST stay in sync with server.js.
function parseTabOwner(tabId, flyMachineId) {
  if (!flyMachineId || !tabId) return null;
  const idx = tabId.indexOf('_');
  if (idx === -1) return null;
  const candidate = tabId.slice(0, idx);
  if (candidate.includes('-')) return null;
  return candidate;
}

function isLocalTab(tabId, flyMachineId) {
  const owner = parseTabOwner(tabId, flyMachineId);
  return owner === null || owner === flyMachineId;
}

describe('Tab ID machine encoding', () => {
  const MACHINE_A = '178139e6fe42d8';
  const MACHINE_B = 'abc123def45678';

  test('parseTabOwner extracts machine ID from prefixed tab ID', () => {
    const tabId = `${MACHINE_A}_a1b2c3d4-e5f6-7890-abcd-ef1234567890`;
    expect(parseTabOwner(tabId, MACHINE_A)).toBe(MACHINE_A);
  });

  test('parseTabOwner returns null for legacy UUID tab IDs', () => {
    const tabId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(parseTabOwner(tabId, MACHINE_A)).toBe(null);
  });

  test('parseTabOwner returns null when not on Fly (no machineId)', () => {
    const tabId = `${MACHINE_A}_a1b2c3d4-e5f6-7890-abcd-ef1234567890`;
    expect(parseTabOwner(tabId, '')).toBe(null);
  });

  test('parseTabOwner returns null for empty tabId', () => {
    expect(parseTabOwner('', MACHINE_A)).toBe(null);
    expect(parseTabOwner(null, MACHINE_A)).toBe(null);
    expect(parseTabOwner(undefined, MACHINE_A)).toBe(null);
  });

  test('isLocalTab returns true for local machine tab', () => {
    const tabId = `${MACHINE_A}_a1b2c3d4-e5f6-7890-abcd-ef1234567890`;
    expect(isLocalTab(tabId, MACHINE_A)).toBe(true);
  });

  test('isLocalTab returns false for remote machine tab', () => {
    const tabId = `${MACHINE_B}_a1b2c3d4-e5f6-7890-abcd-ef1234567890`;
    expect(isLocalTab(tabId, MACHINE_A)).toBe(false);
  });

  test('isLocalTab returns true for legacy UUID (no prefix)', () => {
    const tabId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(isLocalTab(tabId, MACHINE_A)).toBe(true);
  });

  test('isLocalTab returns true when not on Fly', () => {
    const tabId = `${MACHINE_A}_a1b2c3d4-e5f6-7890-abcd-ef1234567890`;
    expect(isLocalTab(tabId, '')).toBe(true);
  });

  test('parseTabOwner handles edge case: UUID whose first segment has no dash', () => {
    // Fly machine IDs are hex without dashes. UUIDs have dashes.
    // A tab like "abcdef12_rest" looks like a machine-prefixed tab.
    const tabId = 'abcdef12_some-uuid-here';
    expect(parseTabOwner(tabId, 'abcdef12')).toBe('abcdef12');
    expect(parseTabOwner(tabId, 'different1')).toBe('abcdef12');
  });
});
