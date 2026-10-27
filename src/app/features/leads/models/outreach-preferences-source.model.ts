import { Observable } from 'rxjs';

import { OutreachPreferences, UpdateOutreachPreferencesRequest } from './suppression.model';

/** Loads and saves one party's outreach preferences, for the outreach-preferences dialog. */
export interface OutreachPreferencesSource {
  load(): Observable<OutreachPreferences | null>;
  save(request: UpdateOutreachPreferencesRequest): Observable<OutreachPreferences>;
}
