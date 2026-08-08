import { m } from "@/paraglide/messages";
import { useRouterLoadingState } from "@/shared/lib";

export function NavigationProgress() {
  const isLoading = useRouterLoadingState();

  return (
    <>
      <div
        aria-hidden="true"
        data-slot="navigation-progress"
        data-active={isLoading}
        className="navigation-progress-track"
      >
        <div className="navigation-progress-bar" />
      </div>
      <span className="sr-only" role="status">
        {isLoading ? m.navigationLoading() : ""}
      </span>
    </>
  );
}
