import {
  useLocation,
  useNavigate,
  useParams,
  useRouterState,
  useSearch,
} from "@tanstack/react-router";

/**
 * Single entry point for TanStack Router hooks (`docs/FRONTEND_CONVENTIONS.md`
 * §5.1) — feature/widget/page code must consume this instead of importing
 * `useNavigate`/`useParams`/`useSearch`/`useLocation` directly from
 * `@tanstack/react-router`. `params`/`search` use `strict: false` since this
 * hook is, by design, called from shared code with no single owning route —
 * see TanStack Router's "Using strict: false for Shared Components" guide.
 */
export function useRouter() {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const location = useLocation();

  return { navigate, params, search, location };
}

/**
 * Real router navigation truth for `NavigationProgress`
 * (`docs/PHASE_44.md` T13) — `state.isLoading` reflects TanStack Router's own
 * pending/foreground transition, never editor processing/inference state.
 */
export function useRouterLoadingState(): boolean {
  return useRouterState({ select: (state) => state.isLoading });
}
