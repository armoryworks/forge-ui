import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { onOrAfter } from '../validators/on-or-after.validator';
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

        expect(violations()).toContain('Part Number format is invalid');
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

    it('should derive a readable label from the field key when not in labels map', () => {
      const form = new FormGroup({
        unknownField: new FormControl('', Validators.required),
      });

      TestBed.runInInjectionContext(() => {
        const violations = FormValidationService.getViolations(form, {});

        expect(violations()).toContain('Unknown field is required');
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

  describe('collectViolationItems with group-level errors', () => {
    it('lists a cross-field error that carries a message, jumping to its field', () => {
      const form = new FormGroup(
        { from: new FormControl('a'), to: new FormControl('b') },
        { validators: [() => ({ range: { message: 'To must be after From', field: 'to' } })] },
      );

      expect(FormValidationService.collectViolationItems(form, {})).toEqual([
        { controlName: 'to', message: 'To must be after From' },
      ]);
      expect(FormValidationService.collectViolations(form, {})).toEqual(['To must be after From']);
    });

    it('uses an empty controlName when the group error names no field', () => {
      const form = new FormGroup({ a: new FormControl('') }, { validators: [() => ({ g: { message: 'Whole form' } })] });

      expect(FormValidationService.collectViolationItems(form, {})).toEqual([{ controlName: '', message: 'Whole form' }]);
    });

    it('skips group errors without a message', () => {
      const form = new FormGroup({ a: new FormControl('') }, { validators: [() => ({ g: true })] });

      expect(FormValidationService.collectViolationItems(form, {})).toEqual([]);
    });
  });

  describe('collectViolationItems with nested groups', () => {
    it('reports errors inside nested groups under their path', () => {
      const form = new FormGroup({
        name: new FormControl('ok'),
        address: new FormGroup({
          postalCode: new FormControl('', Validators.required),
          city: new FormControl('', Validators.required),
        }),
      });

      expect(FormValidationService.collectViolationItems(form, { 'address.city': 'City' })).toEqual([
        { controlName: 'address.postalCode', message: 'Postal code is required' },
        { controlName: 'address.city', message: 'City is required' },
      ]);
    });
  });

  describe('labelFromControlName', () => {
    it('splits camelCase and snake_case names into sentence case', () => {
      expect(FormValidationService.labelFromControlName('unitPrice')).toBe('Unit price');
      expect(FormValidationService.labelFromControlName('min_qty')).toBe('Min qty');
    });
  });

  describe('messageFor', () => {
    it('prefixes a server message with the field label', () => {
      expect(FormValidationService.messageFor('serverError', { message: 'already in use' }, 'Code')).toBe('Code: already in use');
    });

    it('does not repeat the label when the server message already names the field', () => {
      expect(FormValidationService.messageFor('serverError', { message: 'Name must contain visible characters.' }, 'Name'))
        .toBe('Name must contain visible characters.');
    });

    it('describes a whole-number failure', () => {
      expect(FormValidationService.messageFor('wholeNumber', true, 'Machines')).toBe('Machines must be a whole number');
    });
  });

  describe('messageFor with a translator', () => {
    const catalogs: Record<string, Record<string, string>> = {
      en: {
        'validation.messages.wholeNumber': '{{label}} must be a whole number',
        'validation.messages.positive': '{{label}} must be greater than 0',
        'validation.endOnOrAfterStartDate': 'End date must be on or after the start date',
      },
      es: {
        'validation.messages.wholeNumber': '{{label}} debe ser un número entero',
        'validation.messages.positive': '{{label}} debe ser mayor que 0',
        'validation.endOnOrAfterStartDate': 'La fecha de fin debe ser igual o posterior a la fecha de inicio',
      },
    };
    let lang = 'en';

    beforeEach(() => {
      lang = 'en';
      FormValidationService.setTranslator((key, params) =>
        (catalogs[lang][key] ?? key).replace('{{label}}', String(params['label'])));
    });

    afterEach(() => FormValidationService.setTranslator(null));

    it('reads the whole-number and greater-than-zero messages in the current language', () => {
      expect(FormValidationService.messageFor('wholeNumber', true, 'Máquinas')).toBe('Máquinas must be a whole number');
      lang = 'es';
      expect(FormValidationService.messageFor('wholeNumber', true, 'Máquinas')).toBe('Máquinas debe ser un número entero');
      expect(FormValidationService.messageFor('positive', true, 'Cantidad')).toBe('Cantidad debe ser mayor que 0');
    });

    it('translates a date-order error each time it is shown, so a language switch applies', () => {
      const form = new FormGroup({
        startDate: new FormControl<Date | null>(new Date(2026, 9, 10)),
        endDate: new FormControl<Date | null>(new Date(2026, 9, 9), onOrAfter('startDate', 'validation.endOnOrAfterStartDate')),
      });
      form.controls.endDate.updateValueAndValidity();

      expect(FormValidationService.collectViolations(form, { endDate: 'End date' }))
        .toEqual(['End date must be on or after the start date']);
      lang = 'es';
      expect(FormValidationService.collectViolations(form, { endDate: 'End date' }))
        .toEqual(['La fecha de fin debe ser igual o posterior a la fecha de inicio']);
    });
  });

  it('shows the key of a translated error when no translator is set', () => {
    expect(FormValidationService.messageFor('onOrAfter', { messageKey: 'validation.dueOnOrAfterBillDate' }, 'Due date'))
      .toBe('validation.dueOnOrAfterBillDate');
  });
});
