import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0C0F",
          borderRadius: 7,
          fontSize: 18,
          color: "#8172F2",
        }}
      >
        ▶
      </div>
    ),
    { ...size },
  );
}
