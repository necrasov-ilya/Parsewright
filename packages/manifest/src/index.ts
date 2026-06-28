import { z } from "zod";

export const FieldTypeSchema = z.enum(["string", "number", "boolean", "array", "object"]);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const TransformSchema = z.enum(["trim", "number", "price", "lowercase", "uppercase"]);
export type Transform = z.infer<typeof TransformSchema>;

export const WaitStrategySchema = z.object({
  kind: z.enum(["load", "domcontentloaded", "networkidle", "selector_or_timeout"]).default("selector_or_timeout"),
  selector: z.string().optional(),
  timeoutMs: z.number().int().positive().max(60000).default(10000),
  settleMs: z.number().int().nonnegative().max(10000).default(500)
});
export type WaitStrategy = z.infer<typeof WaitStrategySchema>;

export const FieldSchema = z.object({
  type: FieldTypeSchema,
  required: z.boolean().default(true),
  nullable: z.boolean().default(false),
  maxLength: z.number().int().positive().default(500)
});
export type FieldDefinition = z.infer<typeof FieldSchema>;

export const ExtractionRuleSchema = z.object({
  selector: z.string(),
  attribute: z.string().optional(),
  multiple: z.boolean().default(false),
  transforms: z.array(TransformSchema).default([])
});
export type ExtractionRule = z.infer<typeof ExtractionRuleSchema>;

export const ParsewrightManifestSchema = z.object({
  version: z.literal("0.1"),
  id: z.string().min(1),
  name: z.string().min(1),
  goal: z.string().min(1),
  source: z.object({
    url: z.string().url(),
    wait: WaitStrategySchema
  }),
  schema: z.record(FieldSchema),
  fields: z.record(ExtractionRuleSchema),
  license: z.string().default("MIT"),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});
export type ParsewrightManifest = z.infer<typeof ParsewrightManifestSchema>;

export function parseManifest(input: unknown): ParsewrightManifest {
  return ParsewrightManifestSchema.parse(input);
}

export function createManifestId(url: string, goal: string): string {
  const seed = `${new URL(url).hostname}-${goal}`.toLowerCase();
  return seed.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "parser";
}
