export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-border/80 bg-card/30 rounded-xl border border-dashed px-5 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-muted-foreground mt-1 text-xs">{description}</p> : null}
    </div>
  );
}
