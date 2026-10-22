import { useEffect, useRef, useState } from "react";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function DropZone({
  currentUrl,
  onFile,
  maxSizeMB = 2,
  shape = "rect",
  label = "Drag and drop an image here",
}) {
  const inputRef = useRef(null);
  const urlRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const clearPreview = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPreview(null);
  };

  const handleFile = (file) => {
    setError("");
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      setError("Only JPG, PNG or WebP images are allowed");
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Image must be under ${maxSizeMB} MB`);
      return;
    }
    clearPreview();
    urlRef.current = URL.createObjectURL(file);
    setPreview(urlRef.current);
    onFile(file);
  };

  const remove = (e) => {
    e.stopPropagation();
    clearPreview();
    setError("");
    if (inputRef.current) inputRef.current.value = "";
    onFile(null);
  };

  const open = () => inputRef.current?.click();
  const shown = preview || currentUrl;

  return (
    <div className="dz-wrap">
      <div
        className={`dropzone ${shape} ${dragging ? "dragging" : ""}`}
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open())}
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
        {shown ? (
          <>
            <img src={shown} alt="Preview" />
            {preview && (
              <button type="button" className="dz-remove" onClick={remove} aria-label="Remove image">
                ×
              </button>
            )}
            <span className="dz-change">Click or drop to change</span>
          </>
        ) : (
          <div className="dz-empty">
            <strong>{label}</strong>
            <span>or click to browse</span>
            <small>JPG, PNG, WebP up to {maxSizeMB} MB</small>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}