/** One immutable, hashed copy of something a communication carried. */
export interface CommunicationArtifact {
  id: number;
  /** Message (the raw .eml) or Attachment. */
  kind: 'Message' | 'Attachment';
  /** Full 64-character digest. Shortened for display; a reviewer verifying needs all of it. */
  sha256: string;
  contentType: string;
  byteSize: number;
  originalFilename: string | null;
  ingestedAt: string;
}
