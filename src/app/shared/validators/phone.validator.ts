import { Validators } from '@angular/forms';

export const PHONE_PATTERN = /^\(\d{3}\) \d{3}-\d{4}$/;

export const phoneValidator = Validators.pattern(PHONE_PATTERN);
