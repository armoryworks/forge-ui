import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';

import { DynamicFormControlModel } from '@danielhokanson/ng-dynamic-forms-core';

import { qbFormControlMapFn } from './qb-form-control-map';

@Component({
  selector: 'dynamic-qb-form-control',
  standalone: true,
  template: `<ng-container #controlHost></ng-container>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicQbFormControlComponent implements OnInit, OnChanges, OnDestroy {
  @Input() group!: UntypedFormGroup;
  @Input() model!: DynamicFormControlModel;

  @ViewChild('controlHost', { read: ViewContainerRef, static: true })
  controlHost!: ViewContainerRef;

  private componentRef: ComponentRef<unknown> | null = null;

  ngOnInit(): void {
    this.createComponent();
  }

  ngOnChanges(): void {
    this.createComponent();
  }

  ngOnDestroy(): void {
    this.destroyComponent();
  }

  private createComponent(): void {
    if (!this.model || !this.group) return;

    const componentType = qbFormControlMapFn(this.model);
    if (!componentType) return;

    this.destroyComponent();
    this.componentRef = this.controlHost.createComponent(componentType);

    const instance = this.componentRef.instance as Record<string, unknown>;
    instance['group'] = this.group;
    instance['model'] = this.model;
  }

  private destroyComponent(): void {
    if (this.componentRef) {
      this.componentRef.destroy();
      this.componentRef = null;
    }
    this.controlHost?.clear();
  }
}
