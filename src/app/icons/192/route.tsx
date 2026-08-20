import { ImageResponse } from "next/og";

export const dynamic = "force-static";

// Maskable: keep the mark inside the ~66% center safe zone so Android's
// circular/rounded-square crop never clips it.
export async function GET() {
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
          fontSize: 76,
          color: "#8172F2",
        }}
      >
        ▶
      </div>
    ),
    { width: 192, height: 192 },
  );
}
