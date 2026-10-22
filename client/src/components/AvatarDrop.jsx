import { useEffect, useRef, useState } from "react";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function AvatarDrop({ currentUrl, name, onFile, maxSizeMB = 2 }) {
  const urlRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [broken, setBroken] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const handleFile = (file) => {
    setError("");
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError("Only JPG, PNG or WebP");
    if (file.size > maxSizeMB * 1024 * 1024) return setError(`Under ${maxSizeMB} MB`);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(file);
    setPreview(urlRef.current);
    setBroken(false);
    onFile(file);
  };

  const src = preview || currentUrl;

  return (
    <div>
      <label
        htmlFor="avatarInput"
        className={`avatar-drop ${dragging ? "dragging" : ""}`}
        title="Click or drag and drop a photo"
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget.contains(e.relatedTarget)) return;
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        {src && !broken ? (
          <img src={src} alt="" onError={() => setBroken(true)} />
        ) : (
          <span className="avatar-letter">{name?.[0]?.toUpperCase()}</span>
        )}
        <span className="avatar-cam">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </span>
        <input
          id="avatarInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}