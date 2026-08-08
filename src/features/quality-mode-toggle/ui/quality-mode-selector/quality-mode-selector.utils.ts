export function optionContainerClassName(selected: boolean, emphasized: boolean): string {
  if (selected) return "border-primary bg-primary/[0.055]";
  if (emphasized) return "border-transparent bg-background/55 hover:bg-background/90";
  return "border-border/80 bg-background/55 hover:border-foreground/20 hover:bg-background/90";
}
