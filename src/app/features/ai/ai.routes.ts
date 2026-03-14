import { Routes } from '@angular/router';
import { AiComponent } from './ai.component';

export const AI_ROUTES: Routes = [
  { path: '', redirectTo: 'general', pathMatch: 'full' },
  { path: ':assistantId', component: AiComponent },
];
