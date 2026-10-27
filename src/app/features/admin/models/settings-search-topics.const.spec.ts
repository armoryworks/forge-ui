import { matchSettingsTopics } from './settings-search-topics.const';

describe('matchSettingsTopics', () => {
  const highlights = (search: string) => matchSettingsTopics(search).map((t) => t.highlight);

  it('offers the numbering section for number searches', () => {
    expect(highlights('number')).toContain('numbering');
    expect(highlights('manual numbering')).toContain('numbering');
    expect(highlights('Num')).toContain('numbering');
  });

  it('offers the company profile for fax and company searches', () => {
    expect(highlights('fax')).toEqual(['company-profile']);
    expect(highlights('company')).toContain('company-profile');
  });

  it('offers the company profile for time zone searches in English and Spanish', () => {
    expect(highlights('time zone')).toContain('company-profile');
    expect(highlights('timezone')).toContain('company-profile');
    expect(highlights('zona horaria')).toContain('company-profile');
  });

  it('offers the default job priority setting for priority searches', () => {
    expect(highlights('priority')).toEqual(['jobs.default_priority']);
  });

  it('ignores searches shorter than three characters', () => {
    expect(matchSettingsTopics('nu')).toEqual([]);
    expect(matchSettingsTopics('   ')).toEqual([]);
  });

  it('does not match a keyword buried inside another word', () => {
    expect(highlights('being')).not.toContain('company-profile');
  });

  it('returns nothing for capability-only searches', () => {
    expect(matchSettingsTopics('kanban')).toEqual([]);
  });
});
