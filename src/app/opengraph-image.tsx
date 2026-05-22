import { ImageResponse } from "next/og";

// TODO(M8): Replace the default OG image with launch-ready brand artwork.
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#FAF0F0",
        color: "#611113",
        display: "flex",
        fontSize: 72,
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      Vitaminaty
    </div>,
    size,
  );
}
