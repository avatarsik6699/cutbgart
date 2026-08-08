import {
  useActiveDocumentModel,
  useActiveDocumentViewSelector,
  type ActiveDocumentViewSnapshot,
} from "../../model";
import { EditorToolDraftGuard } from "../editor-tools";
import type { RefObject } from "react";

const selectPendingNavigation = (snapshot: ActiveDocumentViewSnapshot) =>
  snapshot.pendingNavigation;

export function NavigationGuard(props: {
  editingRoot: RefObject<HTMLDivElement | null>;
}) {
  const model = useActiveDocumentModel();
  const pending = useActiveDocumentViewSelector(selectPendingNavigation);
  if (pending === null) return null;

  return (
    <div className="[grid-area:guard]">
      <EditorToolDraftGuard
        onContinue={() => {
          model.keepEditing();
          props.editingRoot.current
            ?.querySelector<HTMLElement>('[data-testid="tool-panel-slot"]')
            ?.focus();
        }}
        onDiscard={() => model.discardAndContinue()}
      />
    </div>
  );
}
