import { useState, useCallback, useRef } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function fmt(n) {
  return (n * 100).toFixed(1) + "%";
}

function ConfidenceBar({ value, color }) {
  return (
    <div className="bar-track">
      <div
        className="bar-fill"
        style={{ width: fmt(value), background: color }}
      />
    </div>
  );
}

const PALETTE = ["#e8f4f8", "#a8d5e2", "#7ab8c7", "#4e9caf", "#2c7a8f"];

export default function App() {
  const [status, setStatus] = useState("idle");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const classify = useCallback(async (file) => {
    if (!file) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    setPreview(URL.createObjectURL(file));

    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch(`${API_URL}/classify`, { method: "POST", body });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Classification failed");
      }
      const data = await res.json();
      setResult(data);
      setStatus("done");
    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  }, []);

  const handleFile = (f) => {
    if (f && f.type.startsWith("image/")) classify(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const onInputChange = (e) => handleFile(e.target.files[0]);

  return (
    <div className="shell">
      {/* ── header ── */}
      <header className="header">
        <div className="logo">
          <span className="logo-bracket">[</span>
          <span className="logo-text">LENS</span>
          <span className="logo-bracket">]</span>
        </div>
        <p className="tagline">ImageNet · MobileNetV2 · FastAPI</p>
      </header>

      <main className="main">
        {/* ── upload zone ── */}
        <section
          className={`dropzone ${dragging ? "over" : ""} ${status === "loading" ? "scanning" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current.click()}
          aria-label="Upload image for classification"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onInputChange}
            className="hidden-input"
          />

          {preview ? (
            <div className="preview-wrap">
              <img src={preview} alt="Preview" className="preview-img" />
              {status === "loading" && (
                <div className="scan-overlay">
                  <div className="scan-line" />
                  <p className="scan-label">Classifying…</p>
                </div>
              )}
            </div>
          ) : (
            <div className="upload-prompt">
              <div className="upload-icon">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="upload-primary">Drop an image here</p>
              <p className="upload-secondary">
                or click to browse · JPEG, PNG, WebP · max 10 MB
              </p>
            </div>
          )}
        </section>

        {/* ── error ── */}
        {status === "error" && (
          <div className="error-card">
            <span className="error-icon">!</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ── results ── */}
        {status === "done" && result && (
          <section className="results">
            {/* top prediction hero */}
            <div className="hero-card">
              <div className="hero-label">Top prediction</div>
              <div className="hero-name">{result.top_label}</div>
              <div className="hero-conf">{fmt(result.top_confidence)}</div>
              <div className="hero-meta">
                {result.inference_ms} ms · {result.image_size[0]}×
                {result.image_size[1]} px
              </div>
            </div>

            {/* top-5 breakdown */}
            <div className="predictions-grid">
              {result.predictions.map((p, i) => (
                <div key={p.class_id} className="pred-row">
                  <div className="pred-rank">#{i + 1}</div>
                  <div className="pred-info">
                    <div className="pred-name">{p.label}</div>
                    <ConfidenceBar value={p.confidence} color={PALETTE[i]} />
                  </div>
                  <div className="pred-pct">{fmt(p.confidence)}</div>
                </div>
              ))}
            </div>

            {/* try another */}
            <button
              className="retry-btn"
              onClick={() => {
                setStatus("idle");
                setPreview(null);
                setResult(null);
              }}
            >
              Classify another image
            </button>
          </section>
        )}
      </main>

      <footer className="footer">
        <span>Powered by MobileNetV2 · 1000 ImageNet classes</span>
        <a
          href={`${API_URL}/docs`}
          target="_blank"
          rel="noreferrer"
          className="docs-link"
        >
          API docs ↗
        </a>
      </footer>
    </div>
  );
}
