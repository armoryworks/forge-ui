import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { EmployeeProfileService } from '../../account/services/employee-profile.service';

@Component({
  selector: 'app-mobile-account-section',
  standalone: true,
  imports: [RouterLink, RouterOutlet, TranslatePipe],
  templateUrl: './mobile-account-section.component.html',
  styleUrl: './mobile-account-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileAccountSectionComponent implements OnInit {
  private readonly profileService = inject(EmployeeProfileService);

  ngOnInit(): void {
    this.profileService.load();
  }
}
