/**
 * Manual Jest mock for the db module.
 * Replaces apps/server/src/db.ts in all test runs.
 *
 * Provides a jest.fn() for db.query so individual tests can configure
 * return values with mockResolvedValueOnce / mockReturnValue.
 */
export const db = {
    query: jest.fn(),
};
