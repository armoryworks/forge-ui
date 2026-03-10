import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { FormValidationService } from './form-validation.service';

describe('FormValidationService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  describe('getViolations', () => {
    it('should return empty array for valid form', () => {
      const form = new FormGroup({
        name: new FormControl('John', Validators.required),
        email: new FormControl('john@test.com', [Validators.required, Validators.email]),
      });

      TestBed.runInInjectionContext(() => {
        const violations = FormValidationService.getViolations(form, {
          name: 'Name',
          email: 'Email',
        });

        expect(violations()).toEqual([]);
      });
    });

    it('should return required violation message', () => {
      const form = new FormGroup({
        name: new FormControl('', Validators.required),
      });

      TestBed.runInInjectionContext(() => {
        const violations = FormValidationService.getViolations(form, {
          name: 'Job Title',
        });

        expect(violations()).toContain('Job Title is required');
      });
    });

    it('should return email violation message', () => {
      const form = new FormGroup({
        email: new FormControl('not-an-email', Validators.email),
      });

      TestBed.runInInjectionContext(() => {
        const violations = FormValidationService.getViolations(form, {
          email: 'Email Address',
        });

        expect(violations()).toContain('Email Address must be a valid email');
      });
    });

    it('should return minlength violation message', () => {
      const form = new FormGroup({
        password: new FormControl('ab', Validators.minLength(8)),
      });

      TestBed.runInInjectionContext(() => {
        const violations = FormValidationService.getViolations(form, {
          password: 'Password',
        });

        expect(violations()).toContain('Password must be at least 8 characters');
      });
    });

    it('should return maxlength violation message', () => {
      const form = new FormGroup({
        code: new FormControl('TOOLONGCODE', Validators.maxLength(5)),
      });

      TestBed.runInInjectionContext(() => {
        const violations = FormValidationService.getViolations(form, {
          code: 'Part Code',
        });

        expect(violations()).toContain('Part Code must be at most 5 characters');
      });
    });

    it('should return min violation message', () => {
      const form = new FormGroup({
        quantity: new FormControl(-1, Validators.min(0)),
      });

      TestBed.runInInjectionContext(() => {
        const violations = FormValidationService.getViolations(form, {
          quantity: 'Quantity',
        });

        expect(violations()).toContain('Quantity must be at least 0');
      });
    });

    it('should return max violation message', () => {
      const form = new FormGroup({
        priority: new FormControl(999, Validators.max(100)),
      });

      TestBed.runInInjectionContext(() => {
        const violations = FormValidationService.getViolations(form, {
          priority: 'Priority',
        });

        expect(violations()).toContain('Priority must be at most 100');
      });
    });

    it('should return pattern violation message', () => {
      const form = new FormGroup({
        code: new FormControl('abc', Validators.pattern(/^[A-Z]+$/)),
      });

      TestBed.runInInjectionContext(() => {
        const violations = FormValidationService.getViolations(form, {
          code: 'Part Number',
        });

        expect(violations()).toContain('Part Number is invalid');
      });
    });

    it('should handle multiple violations on different fields', () => {
      const form = new FormGroup({
        name: new FormControl('', Validators.required),
        email: new FormControl('bad', Validators.email),
      });

      TestBed.runInInjectionContext(() => {
        const violations = FormValidationService.getViolations(form, {
          name: 'Name',
          email: 'Email',
        });

        expect(violations().length).toBe(2);
        expect(violations()).toContain('Name is required');
        expect(violations()).toContain('Email must be a valid email');
      });
    });

    it('should use field key as fallback label when not in labels map', () => {
      const form = new FormGroup({
        unknownField: new FormControl('', Validators.required),
      });

      TestBed.runInInjectionContext(() => {
        const violations = FormValidationService.getViolations(form, {});

        expect(violations()).toContain('unknownField is required');
      });
    });

    it('should handle custom error with message property', () => {
      const form = new FormGroup({
        custom: new FormControl(''),
      });
      form.controls['custom'].setErrors({ custom: { message: 'Custom validation failed' } });

      TestBed.runInInjectionContext(() => {
        const violations = FormValidationService.getViolations(form, {
          custom: 'Custom Field',
        });

        expect(violations()).toContain('Custom validation failed');
      });
    });

    it('should handle unknown error key with fallback message', () => {
      const form = new FormGroup({
        field: new FormControl(''),
      });
      form.controls['field'].setErrors({ unknownValidator: true });

      TestBed.runInInjectionContext(() => {
        const violations = FormValidationService.getViolations(form, {
          field: 'My Field',
        });

        expect(violations()).toContain('My Field is invalid');
      });
    });

    it('should update violations reactively when form status changes', () => {
      const form = new FormGroup({
        name: new FormControl('', Validators.required),
      });

      TestBed.runInInjectionContext(() => {
        const violations = FormValidationService.getViolations(form, {
          name: 'Name',
        });

        expect(violations().length).toBe(1);

        form.controls['name'].setValue('John');

        expect(violations().length).toBe(0);
      });
    });
  });
});
