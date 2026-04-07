import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Apex CRM Error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: "100vh", display: "flex", alignItems: "center",
          justifyContent: "center", background: "#F5F5F4",
          fontFamily: "Inter, sans-serif", padding: "2rem",
        }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "#FCEBEB", display: "flex",
              alignItems: "center", justifyContent: "center",
              margin: "0 auto 1.25rem",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1A1917", marginBottom: 8, letterSpacing: "-0.3px" }}>
              Something went wrong
            </div>
            <div style={{ fontSize: 14, color: "#7A7875", lineHeight: 1.7, marginBottom: "1.5rem" }}>
              Apex CRM ran into an unexpected error. Your data is safe — try refreshing the page.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 24px", background: "#185FA5", color: "#fff",
                border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", marginRight: 10,
              }}
            >
              Refresh page
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: "10px 24px", background: "transparent", color: "#7A7875",
                border: "0.5px solid rgba(0,0,0,0.18)", borderRadius: 9,
                fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Try again
            </button>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details style={{ marginTop: "1.5rem", textAlign: "left" }}>
                <summary style={{ fontSize: 12, color: "#7A7875", cursor: "pointer" }}>
                  Error details (dev only)
                </summary>
                <pre style={{ fontSize: 11, color: "#A32D2D", marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
