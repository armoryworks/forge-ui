export interface BOMUsage {
  id: number;
  parentPartId: number;
  parentPartNumber: string;
  /** Parent assembly's canonical short name (renamed from parentDescription in
   * the Phase-4 Name+Description split). */
  parentName: string;
  quantity: number;
}
