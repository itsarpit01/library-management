import { useState } from "react";
import Cropper from "react-easy-crop";
import Modal from "./Modal";
import { getCroppedFile } from "../utils/cropImage";

export default function ImageCropModal({
  imageSrc,
  aspect = 1,
  title = "Crop & Rotate Image",
  onClose,
  onComplete,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleCropComplete = (_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const croppedFile = await getCroppedFile(
        imageSrc,
        croppedAreaPixels,
        rotation,
        "edited-image.jpg"
      );
      onComplete(croppedFile);
    } catch (err) {
      console.error("Error cropping image:", err);
    } finally {
      setProcessing(false);
    }
  };

  const rotateLeft = () => setRotation((r) => (r - 90) % 360);
  const rotateRight = () => setRotation((r) => (r + 90) % 360);

  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ position: "relative", width: "100%", height: 320, background: "#111", borderRadius: 8, overflow: "hidden" }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={handleCropComplete}
        />
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Zoom Slider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ minWidth: 60, fontSize: "0.9rem" }}>Zoom:</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1 }}
          />
        </div>

        {/* Rotate Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ minWidth: 60, fontSize: "0.9rem" }}>Rotate:</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-soft btn-sm" onClick={rotateLeft}>
              ↺ -90°
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={rotateRight}>
              ↻ +90°
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => { setRotation(0); setZoom(1); }}>
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="modal-actions" style={{ marginTop: 20 }}>
        <button type="button" className="btn btn-soft" onClick={onClose} disabled={processing}>
          Cancel
        </button>
        <button type="button" className="btn" onClick={handleSave} disabled={processing}>
          {processing ? "Applying..." : "Apply & Save"}
        </button>
      </div>
    </Modal>
  );
}