import type { Template } from "@/lib/postcard";

export function AirmailEdge({ edge }: { edge: Template["edge"] }) {
  if (edge === "none") return null;
  if (edge === "navy") return <div className="h-1 bg-navy" />;
  if (edge === "dashed")
    return (
      <div className="h-1 bg-[repeating-linear-gradient(90deg,var(--color-accent)_0_10px,transparent_10px_20px)]" />
    );
  return <div className="airmail h-1" />;
}
