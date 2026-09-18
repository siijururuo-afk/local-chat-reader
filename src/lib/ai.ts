export interface AIProvider {
  readonly name: string
  complete(prompt: string, context: string): Promise<string>
}

export class NoAIProvider implements AIProvider {
  readonly name = 'Not configured'
  async complete(): Promise<string> { throw new Error('Configure an AI provider before using AI actions.') }
}
