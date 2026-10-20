import { inject, Pipe, PipeTransform } from '@angular/core';

import { DisplayLabelService } from '../services/display-label.service';

@Pipe({
  name: 'enumLabel',
  standalone: true,
  pure: false,
})
export class EnumLabelPipe implements PipeTransform {
  private readonly labels = inject(DisplayLabelService);

  transform(value: string | null | undefined, group?: string): string {
    return this.labels.enumLabel(value, group);
  }
}

@Pipe({
  name: 'roleLabel',
  standalone: true,
  pure: false,
})
export class RoleLabelPipe implements PipeTransform {
  private readonly labels = inject(DisplayLabelService);

  transform(value: string | readonly string[] | null | undefined): string {
    if (Array.isArray(value)) return value.map(r => this.labels.roleLabel(r)).join(', ');
    return this.labels.roleLabel(value as string | null | undefined);
  }
}
