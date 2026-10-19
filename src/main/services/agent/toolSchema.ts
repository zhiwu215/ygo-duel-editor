export interface JsonSchema {
  type?: string

  description?: string

  properties?: Record<string, JsonSchema>

  required?: string[]

  items?: JsonSchema

  isOptional?: boolean

  [key: string]: unknown
}

function cleanSchema(schema: JsonSchema): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'isOptional') continue
    if (k === 'properties' && v && typeof v === 'object') {
      const cleanedProperties: Record<string, unknown> = {}
      for (const [propName, propVal] of Object.entries(v as Record<string, JsonSchema>)) {
        cleanedProperties[propName] = cleanSchema(propVal)
      }
      result.properties = cleanedProperties
    } else if (k === 'items' && v && typeof v === 'object') {
      result.items = cleanSchema(v as JsonSchema)
    } else {
      result[k] = v
    }
  }
  return result
}

export const Type = {
  Object: (props: Record<string, JsonSchema>): Record<string, unknown> => {
    const required = Object.keys(props).filter((k) => !props[k]?.isOptional)
    const base: JsonSchema = {
      type: 'object',
      properties: props,
      ...(required.length > 0 ? { required } : {})
    }
    return cleanSchema(base)
  },
  String: (opts?: { description?: string }): JsonSchema => ({
    type: 'string',
    ...opts
  }),
  Number: (opts?: { description?: string }): JsonSchema => ({
    type: 'number',
    ...opts
  }),
  Boolean: (opts?: { description?: string }): JsonSchema => ({
    type: 'boolean',
    ...opts
  }),
  Array: (items: JsonSchema, opts?: { description?: string }): JsonSchema => ({
    type: 'array',
    items,
    ...opts
  }),
  Optional: (item: JsonSchema): JsonSchema => ({
    ...item,
    isOptional: true
  })
}
