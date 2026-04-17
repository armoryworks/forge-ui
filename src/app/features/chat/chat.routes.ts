import { Routes } from '@angular/router';
import { ChatComponent } from './chat.component';

export const CHAT_ROUTES: Routes = [
  { path: '', component: ChatComponent },
  {
    path: 'popout',
    loadComponent: () => import('./components/chat-popout/chat-popout.component').then(m => m.ChatPopoutComponent),
  },
];
