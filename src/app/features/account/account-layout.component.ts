import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AccountSidebarComponent } from './components/account-sidebar/account-sidebar.component';
import { EmployeeProfileService } from './services/employee-profile.service';

@Component({
  selector: 'app-account-layout',
  standalone: true,
  imports: [RouterOutlet, AccountSidebarComponent],
  template: `
    <div class="account-layout">
      <app-account-sidebar />
      <div class="account-layout__content">
        <router-outlet />
      </div>
    </div>
  `,
  styles: `
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    :host {
      display: flex;
      flex: 1;
      min-height: 0;
    }

    .account-layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .account-layout__content {
      flex: 1;
      overflow-y: auto;
      @include custom-scrollbar(6px);
    }

    @include mobile {
      .account-layout {
        flex-direction: column;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountLayoutComponent implements OnInit {
  private readonly profileService = inject(EmployeeProfileService);

  ngOnInit(): void {
    this.profileService.load();
  }
}
