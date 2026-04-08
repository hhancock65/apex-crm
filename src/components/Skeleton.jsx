import React from "react";

function SkeletonBox({ width = "100%", height = 14, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "var(--surface)",
      animation: "skeleton-pulse 1.5s ease-in-out infinite",
      ...style,
    }} />
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      <style>{`@keyframes skeleton-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: "1.5rem" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ background: "var(--surface)", borderRadius: 10, padding: "1rem", border: "0.5px solid var(--border)" }}>
            <SkeletonBox width="60%" height={11} style={{ marginBottom: 8 }} />
            <SkeletonBox width="40%" height={26} style={{ marginBottom: 6 }} />
            <SkeletonBox width="50%" height={10} />
          </div>
        ))}
      </div>
      {/* Two col */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        {[...Array(2)].map((_, i) => (
          <div key={i} style={{ background: "var(--card-bg)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "1rem 1.25rem" }}>
            <SkeletonBox width="35%" height={11} style={{ marginBottom: 16 }} />
            {[...Array(3)].map((_, j) => (
              <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: j < 2 ? "0.5px solid var(--border)" : "none" }}>
                <SkeletonBox width={36} height={36} radius={18} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <SkeletonBox width="55%" height={12} style={{ marginBottom: 6 }} />
                  <SkeletonBox width="40%" height={10} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContactsSkeleton() {
  return (
    <div>
      <style>{`@keyframes skeleton-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <div style={{ background: "var(--card-bg)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "1rem 1.25rem" }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < 4 ? "0.5px solid var(--border)" : "none" }}>
            <SkeletonBox width={36} height={36} radius={18} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <SkeletonBox width="45%" height={13} style={{ marginBottom: 6 }} />
              <SkeletonBox width="65%" height={11} />
            </div>
            <SkeletonBox width={60} height={20} radius={20} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PipelineSkeleton() {
  return (
    <div>
      <style>{`@keyframes skeleton-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ background: "var(--surface)", borderRadius: 12, padding: 12, border: "0.5px solid var(--border)", minHeight: 120 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <SkeletonBox width="50%" height={11} />
              <SkeletonBox width={24} height={20} radius={20} />
            </div>
            {[...Array(i === 0 ? 2 : i === 1 ? 1 : 0)].map((_, j) => (
              <div key={j} style={{ background: "var(--card-bg)", border: "0.5px solid var(--border)", borderRadius: 9, padding: "10px 12px", marginBottom: 8 }}>
                <SkeletonBox width="70%" height={13} style={{ marginBottom: 6 }} />
                <SkeletonBox width="40%" height={13} style={{ marginBottom: 4 }} />
                <SkeletonBox width="55%" height={10} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GenericSkeleton() {
  return (
    <div>
      <style>{`@keyframes skeleton-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <div style={{ background: "var(--card-bg)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "1rem 1.25rem" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ padding: "12px 0", borderBottom: i < 3 ? "0.5px solid var(--border)" : "none" }}>
            <SkeletonBox width="80%" height={13} style={{ marginBottom: 6 }} />
            <SkeletonBox width="50%" height={11} />
          </div>
        ))}
      </div>
    </div>
  );
}
