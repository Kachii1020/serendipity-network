import { ImageResponse } from "next/og";

export const size = { height: 180, width: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#dceeff",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "#5c4ade",
          border: "4px solid #111111",
          borderRadius: 18,
          display: "flex",
          height: 92,
          transform: "rotate(45deg)",
          width: 92,
        }}
      />
    </div>,
    size,
  );
}
