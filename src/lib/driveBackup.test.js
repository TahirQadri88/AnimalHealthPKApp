import { describe, it, expect } from 'vitest';
import { getISOWeekFilename, getDriveScript } from './driveBackup';

// uploadToDrive is a fetch against a user-deployed endpoint and is not unit-tested; the
// filename it derives is, because that is what decides whether a weekly backup overwrites
// last week's copy or piles up a new file every run.
describe('getISOWeekFilename', () => {
  it('names the file by ISO week, so a week has exactly one backup', () => {
    const name = getISOWeekFilename();
    expect(name).toMatch(/^AnimalHealthPK_Backup_\d{4}-W\d{2}\.json$/);
  });

  it('is stable within a run', () => {
    expect(getISOWeekFilename()).toBe(getISOWeekFilename());
  });

  it('pads the week number, so W07 sorts before W12 in a file listing', () => {
    expect(getISOWeekFilename().split('-W')[1]).toHaveLength(7);  // NN.json
  });
});

describe('getDriveScript', () => {
  it('hands back the Apps Script the user pastes into script.google.com', () => {
    const src = getDriveScript();
    expect(src).toContain('function doPost');
    expect(src).toContain('function doGet');
  });
});
