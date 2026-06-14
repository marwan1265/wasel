export interface Model {
  id: string
  name: string
  provider: string
  providerId: string
  enabled: boolean
  toolCallType: 'native' | 'manual'
  toolCallModel?: string
  /**
   * Whether the model can accept image inputs (vision). When omitted or false,
   * image attachments are disabled in the UI and stripped server-side before
   * the request reaches the provider.
   */
  vision?: boolean
}
