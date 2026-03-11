import { RagSearchResult } from './rag-search-result.model';

export interface RagSearchResponse {
  results: RagSearchResult[];
  generatedAnswer: string | null;
}
