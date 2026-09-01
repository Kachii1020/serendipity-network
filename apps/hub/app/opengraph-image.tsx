import { ImageResponse } from "next/og";

export const alt = "Serendipity — build a source-backed Tokyo night";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background: "#dceeff",
        color: "#111111",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "64px 72px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>
        SERENDIPITY
        <span
          style={{
            background: "#5c4ade",
            display: "flex",
            height: 22,
            marginLeft: 16,
            marginTop: 8,
            transform: "rotate(45deg)",
            width: 22,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 86,
          fontWeight: 900,
          letterSpacing: "-4px",
          lineHeight: 0.94,
          maxWidth: 860,
          textTransform: "uppercase",
        }}
      >
        One Tokyo night. Three hubs. Official price evidence.
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        {[
          ["Real places", "#55db9c"],
          ["Official menu prices", "#ffd731"],
          ["AI-ready planner", "#fb8050"],
        ].map(([name, color]) => (
          <div
            key={name}
            style={{
              background: color,
              border: "2px solid #111",
              borderRadius: 999,
              display: "flex",
              fontSize: 26,
              fontWeight: 800,
              padding: "14px 28px",
            }}
          >
            {name}
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
