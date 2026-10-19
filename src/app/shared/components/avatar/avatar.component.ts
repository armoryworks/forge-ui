import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const LIGHT_INK = '#ffffff';
const DARK_INK = '#0f172a';

function relativeLuminance(color: string): number | null {
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const DARK_INK_LUMINANCE = relativeLuminance(DARK_INK)!;

export function avatarInk(background: string): string {
  const luminance = relativeLuminance(background);
  if (luminance === null) return LIGHT_INK;
  const onLight = 1.05 / (luminance + 0.05);
  const onDark = (luminance + 0.05) / (DARK_INK_LUMINANCE + 0.05);
  return onLight >= onDark ? LIGHT_INK : DARK_INK;
}

@Component({
  selector: 'app-avatar',
  standalone: true,
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  readonly initials = input.required<string>();
  readonly color = input<string>('#0d9488');
  readonly size = input<'sm' | 'md' | 'lg'>('sm');

  protected readonly ink = computed(() => avatarInk(this.color() ?? ''));
}
