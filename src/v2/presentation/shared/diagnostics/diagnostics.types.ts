export declare namespace DiagnosticsTypes {
  type LogEntry = Readonly<{
    id: string;
    message: string;
    timestamp: number;
  }>;

  type RunInfo = Readonly<{
    dtype: string;
    inferencePath: string;
  }>;

  type SheetProps = Readonly<{
    fallbackUsed?: boolean;
    lightweightMode?: boolean;
    logs: readonly LogEntry[];
    modelLoadBytes?: Readonly<{ loaded: number; total: number | null }>;
    runInfo?: RunInfo | null;
  }>;
}
