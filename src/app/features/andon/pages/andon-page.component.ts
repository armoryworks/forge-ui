import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { AndonBoardComponent } from '../components/andon-board/andon-board.component';

@Component({
  selector: 'app-andon-page',
  standalone: true,
  imports: [TranslatePipe, PageLayoutComponent, AndonBoardComponent],
  templateUrl: './andon-page.component.html',
  styleUrl: './andon-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AndonPageComponent {}
