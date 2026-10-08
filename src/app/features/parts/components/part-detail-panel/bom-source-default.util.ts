import { BOMSourceType } from '../../models/bom-source-type.type';

/**
 * Default BOM line source for a picked child part, from its procurement
 * source: Make stays Make, Buy and Subcontract become Buy. Returns null when
 * there is no sensible default (Phantom, unknown), so Stock stays a manual choice.
 */
export function defaultBomSourceFor(procurementSource: unknown): BOMSourceType | null {
  switch (procurementSource) {
    case 'Make':
      return 'Make';
    case 'Buy':
    case 'Subcontract':
      return 'Buy';
    default:
      return null;
  }
}
