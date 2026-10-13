# Metadata and Classification Rules

## Metadata Provider Architecture

Specialized metadata must be implemented through independent providers.

Example:

```ts
interface MetadataProvider {
  canHandle(file: FileNode): boolean;
  extract(path: string): Promise<Record<string, unknown>>;
}
```

Possible providers:

- image metadata
- PDF metadata
- Office metadata
- audio metadata
- video metadata
- archive metadata

## Classification

Use:

```text
extension
mimeType
fileType
category
subcategory
```

Classification should be centralized.

## No False Precision

Never infer exact metadata from filename alone.

For example, do not claim a PDF page count unless a PDF parser actually obtained it.

## Unknown Values

Use a consistent unknown representation.

Do not mix:

```text
"unknown"
""
null
undefined
N/A
```

arbitrarily.

## Custom Metadata

Allow a generic metadata object for future extension:

```ts
metadata?: Record<string, unknown>;
```

Keep frequently queried properties normalized for efficient filtering/search.

## ACC taxonomy

When ACC Accelerator fields are present on items, Prisma:

- maps codes to full display names via `metadata/accTaxonomy.ts` + `taxonomy/accAcceleratorTaxonomy.json`;
- exposes ACC group-by levels in the View panel;
- can resolve ACC web links (`utils/accLinks`) after sign-in / Resolve ACC links.

Do not invent ACC labels from filenames. Prefer taxonomy tables and stored metadata.
