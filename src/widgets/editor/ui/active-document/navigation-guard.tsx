import {
  useActiveDocumentModel,
  useActiveDocumentViewSelector,
  type ActiveDocumentViewSnapshot,
} from "../../model";
import { EditorToolDraftGuard } from "../editor-tools";

const selectPendingNavigation = (snapshot: ActiveDocumentViewSnapshot) =>
  snapshot.pendingNavigation;

export function NavigationGuard() {
  const model = useActiveDocumentModel();
  const pending = useActiveDocumentViewSelector(selectPendingNavigation);
  if (pending === null) return null;

  return (
    <div className="[grid-area:guard]">
      <EditorToolDraftGuard
        onContinue={() => model.keepEditing()}
        onDiscard={() => model.discardAndContinue()}
      />
    </div>
  );
}
