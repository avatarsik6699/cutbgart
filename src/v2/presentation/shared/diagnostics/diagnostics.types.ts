export type DiagnosticsLogEntry = Readonly<{
  id: string;
  message: string;
  timestamp: number;
}>;

export type DiagnosticsRunInfo = Readonly<{
  dtype: string;
  inferencePath: string;
}>;

export type DiagnosticsSheetProps = Readonly<{
  fallbackUsed?: boolean;
  lightweightMode?: boolean;
  logs: readonly DiagnosticsLogEntry[];
  modelLoadBytes?: Readonly<{ loaded: number; total: number | null }>;
  runInfo?: DiagnosticsRunInfo | null;
}>;
