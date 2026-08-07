import { generateJsonWithLocalLlm, LOCAL_LLM_MODEL } from './localLlmGenerate'

export { LOCAL_LLM_MODEL }

type GenerateJsonInput = {
  // Kept for compatibility with existing generator contracts. The fixed local server does not use it.
  apiKey: string
  instructions: string
  input: string
  schemaName: string
  schema: object
}

// All editor generation calls use the fixed local vLLM model.
export const generateJson = <T>(args: GenerateJsonInput): Promise<T> =>
  generateJsonWithLocalLlm<T>({ ...args, model: LOCAL_LLM_MODEL })
