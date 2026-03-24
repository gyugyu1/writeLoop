import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "writeLoop 링크 미리보기 이미지";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

function LogoMark() {
  return (
    <svg width="220" height="220" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="og-blue" x1="23" y1="38" x2="63" y2="89" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3D86F6" />
          <stop offset="1" stopColor="#1D57B8" />
        </linearGradient>
        <linearGradient id="og-orange" x1="67" y1="39" x2="107" y2="89" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFBC42" />
          <stop offset="1" stopColor="#FF8A00" />
        </linearGradient>
        <linearGradient id="og-pencil" x1="44" y1="94" x2="94" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor="#184AA3" />
          <stop offset="1" stopColor="#2F74D2" />
        </linearGradient>
      </defs>
      <path
        d="M53 93c-16.5 0-30-12-30-27s13.5-27 30-27c11.7 0 19.4 4.5 26 12l-8 7.5c-4.8-5.2-9.9-8.2-18-8.2-9.8 0-17.7 7.2-17.7 15.7S43.2 81.7 53 81.7c7.7 0 12.8-2.6 17.7-8.2l8 7.4C72.4 88.4 64.7 93 53 93Z"
        fill="url(#og-blue)"
      />
      <path
        d="M75 39c16.5 0 30 12 30 27S91.5 93 75 93c-11.7 0-19.4-4.5-26-12l8-7.5c4.8 5.2 9.9 8.2 18 8.2 9.8 0 17.7-7.2 17.7-15.7S84.8 50.3 75 50.3c-7.7 0-12.8 2.6-17.7 8.2l-8-7.4C55.6 43.6 63.3 39 75 39Z"
        fill="url(#og-orange)"
      />
      <g transform="rotate(40 64 64)">
        <rect x="56" y="17" width="16" height="82" rx="8" fill="url(#og-pencil)" />
        <rect x="56" y="17" width="16" height="10" rx="5" fill="#2A6CC6" />
        <rect x="56" y="27" width="16" height="6" fill="#FFA21E" />
        <rect x="56" y="74" width="16" height="6" fill="#FFA21E" />
        <path d="M56 99H72L64 112L56 99Z" fill="#214E97" />
        <path d="M61 112H67L64 118L61 112Z" fill="#7C8AA5" />
      </g>
    </svg>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "56px 64px",
          background:
            "radial-gradient(circle at 22% 70%, rgba(42, 116, 210, 0.28), transparent 26%), radial-gradient(circle at 78% 72%, rgba(255, 173, 59, 0.32), transparent 28%), linear-gradient(135deg, #f4ede1 0%, #ece3d1 100%)",
          color: "#10244c",
          fontFamily: "sans-serif"
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: "690px"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
              color: "#b8621b",
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase"
            }}
          >
            Daily English Writing Loop
          </div>
          <div
            style={{
              marginTop: "22px",
              fontSize: 74,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              lineHeight: 1.02
            }}
          >
            writeLoop
          </div>
          <div
            style={{
              marginTop: "24px",
              fontSize: 34,
              lineHeight: 1.45,
              color: "#30415f"
            }}
          >
            오늘의 질문으로 짧게 쓰고, 한국어 피드백과 다시쓰기로
            <br />
            매일 꾸준히 영어 작문 습관을 만드는 서비스
          </div>
        </div>

        <div
          style={{
            width: 280,
            height: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "48px",
            background: "rgba(255,255,255,0.32)",
            boxShadow: "0 28px 80px rgba(21, 41, 76, 0.16)"
          }}
        >
          <LogoMark />
        </div>
      </div>
    ),
    size
  );
}
