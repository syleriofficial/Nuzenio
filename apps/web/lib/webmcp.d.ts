interface NuzenioModelContext {
  registerTool(
    tool: {
      name: string;
      title?: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
      execute(input: unknown): object | Promise<object>;
    },
    options?: { signal?: AbortSignal },
  ): void | Promise<void>;
}

interface Document {
  readonly modelContext?: NuzenioModelContext;
}
