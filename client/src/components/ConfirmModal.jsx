import Modal from "./Modal";

export default function ConfirmModal({
  title = "Are you sure?",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{message}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-soft" onClick={onClose}>
          {cancelText}
        </button>
        <button
          type="button"
          className={`btn ${danger ? "btn-danger" : ""}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}