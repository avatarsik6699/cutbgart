export declare namespace FileAdmissionTypes {
  type State =
    | Readonly<{ kind: "idle" }>
    | Readonly<{ kind: "preparing"; message: string; onCancel: () => void }>
    | Readonly<{ kind: "error"; message: string; onRetry: () => void }>;

  type Props = Readonly<{
    buttonClassName?: string;
    buttonLabel?: string;
    disabled?: boolean;
    dropzoneClassName?: string;
    multiple?: boolean;
    onFiles: (files: readonly File[]) => void;
    state?: State;
  }>;

  type ClipboardFeedback =
    | Readonly<{ kind: "idle" }>
    | Readonly<{ kind: "reading"; message: string }>
    | Readonly<{ kind: "error"; message: string }>;

  type ControlProps = Readonly<{
    className?: string;
    disabled?: boolean;
    multiple?: boolean;
    onFiles: (files: readonly File[]) => void;
  }>;

  type ChooseButtonProps = Readonly<{
    className?: string;
    disabled?: boolean;
    label?: string;
    multiple?: boolean;
    onFiles: (files: readonly File[]) => void;
  }>;

  type ClipboardParams = Readonly<{
    disabled?: boolean;
    multiple?: boolean;
    onFiles: (files: readonly File[]) => void;
  }>;

  type ClipboardResult = Readonly<{
    feedback: ClipboardFeedback;
    readClipboard: () => Promise<void>;
  }>;
}
