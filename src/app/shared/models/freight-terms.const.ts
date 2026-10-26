export const FREIGHT_TERMS = ['Prepaid', 'PrepaidAndAdd', 'Collect', 'ThirdParty'] as const;

export type FreightTerms = (typeof FREIGHT_TERMS)[number];
