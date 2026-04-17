import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { BroadcastService } from '../../../../shared/services/broadcast.service';
import { ChatComponent } from '../../chat.component';

@Component({
  selector: 'app-chat-popout',
  standalone: true,
  imports: [ChatComponent, TranslatePipe],
  templateUrl: './chat-popout.component.html',
  styleUrl: './chat-popout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPopoutComponent implements OnInit, OnDestroy {
  private readonly broadcast = inject(BroadcastService);

  ngOnInit(): void {
    this.broadcast.sendChatEvent({ type: 'chat-window-opened' });
    window.addEventListener('beforeunload', this.onBeforeUnload);
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }

  private onBeforeUnload = (): void => {
    this.broadcast.sendChatEvent({ type: 'chat-window-closed' });
  };
}
