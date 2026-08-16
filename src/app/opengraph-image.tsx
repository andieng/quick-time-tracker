import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0C0F",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(circle at 30% 30%, rgba(129,114,242,0.28), transparent 60%)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              display: "flex",
              width: 100,
              height: 100,
              borderRadius: 22,
              background: "#14171C",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 46,
              color: "#8172F2",
            }}
          >
            ▶
          </div>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color: "#F4F4F6" }}>
            Quick Time Tracker
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 30, color: "#9A9CA5" }}>
          Free, minimal time tracker — start instantly as a guest
        </div>
      </div>
    ),
    { ...size },
  );
}
