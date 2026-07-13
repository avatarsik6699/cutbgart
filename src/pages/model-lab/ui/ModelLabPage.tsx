import { ModelLab } from "../../../features/model-lab";
import { env } from "../../../shared/config";

export function ModelLabPage() {
  if (!env.modelLabEnabled) {
    return (
      <main data-testid="model-lab-disabled" className="mx-auto max-w-2xl space-y-3 p-8">
        <h1 className="text-2xl font-semibold">Model lab отключён</h1>
        <p className="text-muted-foreground">
          Запустите сборку с VITE_ENABLE_MODEL_LAB=true. Модели не загружались.
        </p>
      </main>
    );
  }
  return <ModelLab />;
}
