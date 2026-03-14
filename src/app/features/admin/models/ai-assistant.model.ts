export interface AiAssistant {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  systemPrompt: string;
  allowedEntityTypes: string[];
  starterQuestions: string[];
  isActive: boolean;
  isBuiltIn: boolean;
  sortOrder: number;
  temperature: number;
  maxContextChunks: number;
}
