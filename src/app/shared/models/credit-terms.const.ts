import { SelectOption } from '../components/select/select.component';

export const CREDIT_TERMS_OPTIONS: SelectOption[] = [
  { value: null, label: '-- None --' },
  { value: 'DueOnReceipt', label: 'Due on Receipt' },
  { value: 'Net15', label: 'Net 15' },
  { value: 'Net30', label: 'Net 30' },
  { value: 'Net45', label: 'Net 45' },
  { value: 'Net60', label: 'Net 60' },
  { value: 'Net90', label: 'Net 90' },
];

export const PAYMENT_TERMS_OPTIONS: SelectOption[] = [
  { value: '', label: '-- None --' },
  { value: 'Due on Receipt', label: 'Due on Receipt' },
  { value: 'Net 15', label: 'Net 15' },
  { value: 'Net 30', label: 'Net 30' },
  { value: 'Net 45', label: 'Net 45' },
  { value: 'Net 60', label: 'Net 60' },
  { value: 'COD', label: 'COD' },
];
