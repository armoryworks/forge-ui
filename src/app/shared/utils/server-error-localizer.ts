import { ServerValidationError } from './server-validation.utils';

/** Looks up a catalog key; returns the key itself when the catalog has no entry (ngx-translate's behaviour). */
export type ServerErrorTranslator = (key: string, params?: Record<string, unknown>) => string;

const CODE_KEYS: Record<string, string> = {
  'effective-range-order': 'apiErrors.codes.effectiveRangeOrder',
  'lot-number-too-long': 'apiErrors.codes.lotNumberTooLong',
  'role-template-empty': 'apiErrors.codes.roleTemplateEmpty',
  'role-template-too-many': 'apiErrors.codes.roleTemplateTooMany',
  'name-not-visible': 'apiErrors.codes.nameNotVisible',
  'lead-name-required': 'apiErrors.codes.leadNameRequired',
  'packing-slip-too-long': 'apiErrors.codes.packingSlipTooLong',
  'whole-quantity-required': 'apiErrors.codes.wholeQuantityRequired',
  'file-too-large': 'apiErrors.codes.fileTooLarge',
  'email-invalid-character': 'apiErrors.codes.emailInvalidCharacter',
  'auto-approve-over-max': 'apiErrors.codes.autoApproveOverMax',
  'too-many-leads': 'apiErrors.codes.tooManyLeads',
  'too-many-milestones': 'apiErrors.codes.tooManyMilestones',
  'journal-needs-two-lines': 'apiErrors.codes.journalNeedsTwoLines',
  'journal-line-one-side': 'apiErrors.codes.journalLineOneSide',
  'andon-type-required': 'apiErrors.codes.andonTypeRequired',
  'material-category-conflict': 'apiErrors.codes.materialCategoryConflict',
  'operation-progress-empty': 'apiErrors.codes.operationProgressEmpty',
  'activation-code-invalid': 'apiErrors.codes.activationCodeInvalid',
  'preset-compare-count': 'apiErrors.codes.presetCompareCount',
  'cron-invalid': 'apiErrors.codes.cronInvalid',
  'invalid-date': 'apiErrors.codes.invalidDate',
  'invalid-number': 'apiErrors.codes.invalidNumber',
  'whole-number-required': 'apiErrors.codes.wholeNumberRequired',
  'invalid-boolean': 'apiErrors.codes.invalidBoolean',
  'invalid-identifier': 'apiErrors.codes.invalidIdentifier',
  'invalid-option': 'apiErrors.codes.invalidOption',
  'body-required': 'apiErrors.codes.bodyRequired',
  'invalid-value': 'apiErrors.codes.invalidValue',
  'currency-inactive': 'apiErrors.codes.currencyInactive',
  'payment-currency-mismatch': 'apiErrors.codes.paymentCurrencyMismatch',
  'bill-po-currency-mismatch': 'apiErrors.codes.billPoCurrencyMismatch',
  'invoice-so-currency-mismatch': 'apiErrors.codes.invoiceSoCurrencyMismatch',
  'fx-rate-invalid': 'apiErrors.codes.fxRateInvalid',
  'fx-rate-same-currency': 'apiErrors.codes.fxRateSameCurrency',
  'freight-line-part': 'apiErrors.codes.freightLinePart',
  'freight-line-po-line': 'apiErrors.codes.freightLinePoLine',
  'so-freight-already-billed': 'apiErrors.codes.soFreightAlreadyBilled',
  'freight-purchase-order-not-found': 'apiErrors.codes.freightPurchaseOrderNotFound',
  'determination-key-not-configurable': 'apiErrors.codes.determinationKeyNotConfigurable',
  'determination-account-not-found': 'apiErrors.codes.determinationAccountNotFound',
  'determination-account-not-postable': 'apiErrors.codes.determinationAccountNotPostable',
  'determination-account-control': 'apiErrors.codes.determinationAccountControl',
  'determination-account-type': 'apiErrors.codes.determinationAccountType',
  'discount-not-allowed': 'apiErrors.codes.discountNotAllowed',
  'payment-terms-not-found': 'apiErrors.codes.paymentTermsNotFound',
  'payment-terms-inactive': 'apiErrors.codes.paymentTermsInactive',
  'payment-terms-due-date': 'apiErrors.codes.paymentTermsDueDate',
  'payment-terms-discount-days': 'apiErrors.codes.paymentTermsDiscountDays',
  'payment-terms-duplicate': 'apiErrors.codes.paymentTermsDuplicate',
  'payment-terms-system': 'apiErrors.codes.paymentTermsSystem',
  'credit-exceeds-invoice-line': 'apiErrors.codes.creditExceedsInvoiceLine',
  'credit-memo-applied': 'apiErrors.codes.creditMemoApplied',
  'invoice-has-credits': 'apiErrors.codes.invoiceHasCredits',
  'credit-memo-not-draft': 'apiErrors.codes.creditMemoNotDraft',
  'credit-memo-total': 'apiErrors.codes.creditMemoTotal',
  'credit-memo-not-open': 'apiErrors.codes.creditMemoNotOpen',
  'credit-exceeds-open': 'apiErrors.codes.creditExceedsOpen',
  'credit-exceeds-balance': 'apiErrors.codes.creditExceedsBalance',
  'credit-memo-invoice': 'apiErrors.codes.creditMemoInvoice',
  'refund-exceeds-open': 'apiErrors.codes.refundExceedsOpen',
  'writeoff-exceeds-balance': 'apiErrors.codes.writeoffExceedsBalance',
  'credit-memo-write-off-reserved': 'apiErrors.codes.creditMemoWriteOffReserved',
  'credit-memo-write-off-refund': 'apiErrors.codes.creditMemoWriteOffRefund',
  'return-location-required': 'apiErrors.codes.returnLocationRequired',
  'return-lot-required': 'apiErrors.codes.returnLotRequired',
  'return-quantity-required': 'apiErrors.codes.returnQuantityRequired',
  'return-quantity-exceeds': 'apiErrors.codes.returnQuantityExceeds',
  'return-already-disposed': 'apiErrors.codes.returnAlreadyDisposed',
  'return-no-part': 'apiErrors.codes.returnNoPart',
  'return-credit-amount-required': 'apiErrors.codes.returnCreditAmountRequired',
};

const PROBLEM_CODE_KEYS: Record<string, string> = {
  OPENING_INVENTORY_USE_STOCK_LOAD: 'apiErrors.codes.openingInventoryUseStockLoad',
};

const VALIDATOR_KEYS: Record<string, string> = {
  NotEmptyValidator: 'apiErrors.validators.required',
  NotNullValidator: 'apiErrors.validators.required',
  MaximumLengthValidator: 'apiErrors.validators.maxLength',
  MinimumLengthValidator: 'apiErrors.validators.minLength',
  LengthValidator: 'apiErrors.validators.length',
  GreaterThanValidator: 'apiErrors.validators.greaterThan',
  GreaterThanOrEqualValidator: 'apiErrors.validators.atLeast',
  LessThanValidator: 'apiErrors.validators.lessThan',
  LessThanOrEqualValidator: 'apiErrors.validators.atMost',
  InclusiveBetweenValidator: 'apiErrors.validators.between',
  ExclusiveBetweenValidator: 'apiErrors.validators.between',
  EmailValidator: 'apiErrors.validators.email',
  RegularExpressionValidator: 'apiErrors.validators.format',
  EnumValidator: 'apiErrors.validators.invalidOption',
  PrecisionScaleValidator: 'apiErrors.validators.precision',
};

const LABEL_NAMESPACES = ['common', 'columns'];

/**
 * The catalog key for a server validation error code: an explicit API code
 * (`lead-name-required`) or a FluentValidation validator name (`NotEmptyValidator`).
 * Undefined for codes the UI does not word itself.
 */
export function serverErrorKey(code: string | null | undefined): string | undefined {
  return code ? CODE_KEYS[code] ?? VALIDATOR_KEYS[code] : undefined;
}

/**
 * A readable label for a server field path (`lines[0].unitPrice` → the `common.unitPrice`
 * or `columns.unitPrice` translation, else "Unit price").
 */
export function serverFieldLabel(field: string, translate: ServerErrorTranslator): string {
  const leaf = field.replace(/\[\d+\]/g, '').split('.').pop() ?? '';
  const name = leaf.charAt(0).toLowerCase() + leaf.slice(1);
  if (!name) return '';
  for (const ns of LABEL_NAMESPACES) {
    const key = `${ns}.${name}`;
    const label = translate(key);
    if (label && label !== key) return label;
  }
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The error in the UI language when the server sent a code the catalog words,
 * with the rule's limits (`maxLength`, `from`, ...) and the field label filled in.
 * Falls back to the server's own message for uncoded errors, unknown codes, or when the server
 * did not send a limit the wording needs (a comparison against another field, for example).
 */
export function localizeServerError(error: ServerValidationError, translate: ServerErrorTranslator): string {
  const key = serverErrorKey(error.code);
  if (!key) return error.message;
  const text = translate(key, { ...(error.params ?? {}), field: serverFieldLabel(error.field, translate) });
  return text && text !== key && !text.includes('{{') ? text : error.message;
}

/**
 * The catalog key for the `code` a ProblemDetails response carries (a posting-engine refusal such as
 * `OPENING_INVENTORY_USE_STOCK_LOAD`), or undefined for codes the UI does not word itself.
 */
export function problemCodeKey(code: unknown): string | undefined {
  return typeof code === 'string' ? PROBLEM_CODE_KEYS[code] : undefined;
}
