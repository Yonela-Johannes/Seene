import { Surface } from "@thatg33k/seene";

export default function HomeShowcase() {
  return (
    <Surface
      id="home"
      style={{
        width: 1400,
        height: 980,
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        boxSizing: "border-box",
        gap: "32px",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "200px",
            background: "#f3f4f6",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <h1
            style={{
              fontSize: "36px",
              fontWeight: "600",
              color: "#1f2937",
              margin: 0,
            }}
          >
            Welcome to Seene
          </h1>
        </div>

        <div
          style={{
            width: "100%",
            height: "180px",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#374151",
              margin: "0 0 12px 0",
            }}
          >
            Product Features
          </h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: "20px",
              color: "#6b7280",
              fontSize: "14px",
              lineHeight: 1.6,
            }}
          >
            <li style={{ marginBottom: "8px" }}>Advanced camera controls with smooth interpolation</li>
            <li style={{ marginBottom: "8px" }}>Configurable scene durations (15s to 120s)</li>
            <li style={{ marginBottom: "8px" }}>Multiple presentation presets</li>
            <li style={{ marginBottom: "8px" }}>Focus depth and effects system</li>
          </ul>
        </div>

        <div
          style={{
            width: "100%",
            height: "180px",
            background: "#f9fafb",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#4b5563",
              margin: "0 0 12px 0",
            }}
          >
            Scene Timeline
          </h3>
          <div
            style={{
              width: "100%",
              height: "60px",
              background: "#e5e7eb",
              borderRadius: "8px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "10%",
                top: "50%",
                transform: "translateY(-50%)",
                width: "80%",
                height: "4px",
                background: "#3b82f6",
                borderRadius: "2px",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "10%",
                top: "50%",
                transform: "translateY(-50%)",
                width: "2px",
                height: "60px",
                background: "#3b82f6",
                borderRadius: "1px",
                zIndex: 1,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: "12px",
                height: "12px",
                background: "#3b82f6",
                borderRadius: "50%",
                zIndex: 2,
              }}
            />
          </div>
          <div
            style={{
              marginTop: "12px",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "#9ca3af",
            }}
          >
            <span>0s</span>
            <span>3s</span>
            <span>6s</span>
            <span>9s</span>
            <span>12s</span>
          </div>
        </div>

        <div
          style={{
            width: "100%",
            height: "200px",
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: "12px",
            padding: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "32px",
                fontWeight: "700",
                color: "#d97706",
                marginBottom: "8px",
              }}
            >
              Cinematic Mode
            </div>
            <div
              style={{
                fontSize: "14px",
                color: "#b45309",
              }}
            >
              Camera rotation and focus reveal in progress...
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
}