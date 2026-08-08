import { Moon, Sun } from "lucide-react";

import { m } from "@/paraglide/messages";
import { useTheme } from "@/shared/lib";

import { Button } from "../controls";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? m.themeSwitchToLight() : m.themeSwitchToDark();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
      onClick={toggleTheme}
    >
      {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  );
}
