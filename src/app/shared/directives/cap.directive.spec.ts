import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CapabilityService } from '../services/capability.service';
import { CapDirective } from './cap.directive';
import { CapNotDirective } from './cap-not.directive';

@Component({
  standalone: true,
  imports: [CapDirective, CapNotDirective],
  template: `
    <div class="positive" *appCap="cap()">positive</div>
    <div class="negative" *appCapNot="cap()">negative</div>
  `,
})
class HostComponent {
  readonly cap = signal('CAP-EXT-CHAT');
}

describe('CapDirective', () => {
  let isEnabled: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isEnabled = vi.fn().mockReturnValue(false);
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: CapabilityService, useValue: { isEnabled } },
      ],
    });
  });

  it('renders the template when the capability is enabled', () => {
    isEnabled.mockReturnValue(true);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const positive = fixture.nativeElement.querySelector('.positive');
    expect(positive).toBeTruthy();
  });

  it('does not render the template when the capability is disabled', () => {
    isEnabled.mockReturnValue(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const positive = fixture.nativeElement.querySelector('.positive');
    expect(positive).toBeNull();
  });

  it('renders reactively when the cap input changes after mount', () => {
    isEnabled.mockImplementation((code: string) =>
      code === 'CAP-EXT-CHAT' ? false : true,
    );
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.positive')).toBeNull();

    // Switch the bound code to one that resolves to enabled.
    fixture.componentInstance.cap.set('CAP-OTHER');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.positive')).toBeTruthy();
  });
});

describe('CapNotDirective', () => {
  let isEnabled: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isEnabled = vi.fn().mockReturnValue(false);
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: CapabilityService, useValue: { isEnabled } },
      ],
    });
  });

  it('renders the template when the capability is DISABLED', () => {
    isEnabled.mockReturnValue(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.negative')).toBeTruthy();
  });

  it('does not render the template when the capability is enabled', () => {
    isEnabled.mockReturnValue(true);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.negative')).toBeNull();
  });
});
