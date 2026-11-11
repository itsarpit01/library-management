import { useCallback, useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import ReissueModal from "../components/ReissueModal";
import Modal from "../components/Modal";
import { SearchIcon, ReturnIcon } from "../components/Icons";

export default function PurchaserIssues() {
  const { user } = useAuth();
  const toast = useToast();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toReissue, setToReissue] = useState(null);
  const [toReturn, setToReturn] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [returning, setReturning] = useState(false);
  const [payingFineId, setPayingFineId] = useState(null);

  // Post-return Fine Prompt Modal State
  const [finePrompt, setFinePrompt] = useState(null); // { issueId, bookTitle, fine, issue }

  // Search, Status, and Date Range Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/issues/my");
      setIssues(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Tab switch par auto-refresh
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", load);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  // Cancel Reissue Request Handler
  const handleCancelReissue = async (id) => {
    if (!window.confirm("Are you sure you want to cancel your reissue request?")) return;
    setCancellingId(id);
    try {
      await api.patch(`/issues/${id}/cancel-reissue`);
      toast.success("Reissue request cancelled successfully");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to cancel reissue request"));
    } finally {
      setCancellingId(null);
    }
  };

  // Pay Fine Online via Razorpay
  const handlePayFine = async (issue) => {
    if (!window.Razorpay) {
      toast.error("Razorpay SDK failed to load. Please refresh the page and try again.");
      return;
    }

    setPayingFineId(issue._id);

    try {
      const res = await api.post("/payment/create-fine-order", { issueId: issue._id });
      const { orderId, amount, currency, keyId, fine, bookTitle } = res.data;

      window.dispatchEvent(new Event("quota-updated"));

      const options = {
        key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount,
        currency: currency || "INR",
        name: "LibraryHub",
        description: `Late Fine Settlement: ${bookTitle} (₹${fine})`,
        order_id: orderId,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        theme: {
          color: "#dc2626",
        },
        handler: async function (response) {
          try {
            const verifyRes = await api.post("/payment/verify-fine", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              issueId: issue._id,
            });

            toast.success(verifyRes.data.message || `Fine of ₹${fine} paid successfully!`);
            load();
            window.dispatchEvent(new Event("quota-updated"));
          } catch (err) {
            toast.error(getErrorMessage(err));
          } finally {
            setPayingFineId(null);
          }
        },
        modal: {
          ondismiss: async function () {
            try {
              await api.post("/payment/mark-failed", {
                orderId: orderId,
                reason: "Fine payment popup closed by user",
              });
            } catch {
              // ignore
            }
            window.dispatchEvent(new Event("quota-updated"));
            setPayingFineId(null);
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on("payment.failed", async function (response) {
        toast.error(`Payment failed: ${response.error?.description || "Something went wrong"}`);
        try {
          await api.post("/payment/mark-failed", {
            orderId: orderId,
            reason: response.error?.description || "Bank declined payment",
          });
        } catch {
          // ignore
        }
        window.dispatchEvent(new Event("quota-updated"));
        setPayingFineId(null);
      });

      razorpayInstance.open();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to start fine payment"));
      setPayingFineId(null);
    }
  };

  // Return Book Handler
  const confirmReturn = async () => {
    if (!toReturn) return;
    const targetBookTitle = toReturn.book?.title;
    const targetIssueId = toReturn._id;
    setReturning(true);

    try {
      const res = await api.patch(`/issues/${targetIssueId}/return`);
      const fine = res.data?.fine ?? res.data?.currentFine ?? 0;
      setToReturn(null);
      await load();
      window.dispatchEvent(new Event("quota-updated"));

      if (fine > 0) {
        // Step 1: Open clean post-return modal with [Pay Fine Now] or [Pay Later]
        setFinePrompt({
          issueId: targetIssueId,
          bookTitle: targetBookTitle,
          fine,
          issue: { ...toReturn, currentFine: fine, fine },
        });
      } else {
        toast.success("Book returned successfully");
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to return book"));
      setToReturn(null);
    } finally {
      setReturning(false);
    }
  };

  const filteredIssues = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    return issues.filter((i) => {
      if (statusFilter) {
        if (statusFilter === "overdue" && !i.isOverdue) return false;
        if (statusFilter === "issued" && (i.status !== "issued" || i.isOverdue)) return false;
        if (statusFilter === "returned" && i.status !== "returned") return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = i.book?.title?.toLowerCase().includes(q);
        const matchAuthor = i.book?.author?.toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor) return false;
      }

      if (startDate || endDate) {
        const d = i.issueDate ? new Date(i.issueDate).toISOString().slice(0, 10) : "";
        const from = startDate || "1970-01-01";
        const to = endDate || todayStr;
        if (d < from || d > to) return false;
      }

      return true;
    });
  }, [issues, statusFilter, searchQuery, startDate, endDate]);

  const clearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  const statusBadge = (i) => {
    if (i.status === "returned") return <span className="badge badge-success">Returned</span>;
    if (i.isOverdue) return <span className="badge badge-danger">Overdue</span>;
    if (i.reissueRequested) {
      return (
        <span
          className="badge"
          style={{
            backgroundColor: "#fff3e0",
            color: "#e65100",
            border: "1px solid #ffb74d",
          }}
        >
          Reissue Requested
        </span>
      );
    }
    return <span className="badge badge-warning">Issued</span>;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My Issued Books</h2>
          <p>Books currently issued to you and your past borrowing history.</p>
        </div>
      </div>

      {/* Toolbar: Search, Status, and Date Range Filter */}
      <div
        className="toolbar"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "nowrap",
          overflowX: "auto",
          paddingBottom: 4,
          marginBottom: 16,
        }}
      >
        <div className="search-box" style={{ maxWidth: 240, minWidth: 160, flex: "0 1 240px" }}>
          <SearchIcon size={16} />
          <input
            placeholder="Search book or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="toolbar-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: "auto", minWidth: 130, flexShrink: 0 }}
        >
          <option value="">All Statuses</option>
          <option value="issued">Currently Issued</option>
          <option value="overdue">Overdue</option>
          <option value="returned">Returned</option>
        </select>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "nowrap",
            whiteSpace: "nowrap",
            background: "var(--card-bg, #f9fafb)",
            padding: "4px 8px",
            borderRadius: 8,
            border: "1px solid var(--border, #e5e7eb)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #666)", fontWeight: 600 }}>From:</span>
          <input
            type="date"
            className="toolbar-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: 125, padding: "4px 6px", fontSize: "0.8rem" }}
            title="Issue date from"
          />
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #666)", fontWeight: 600 }}>To:</span>
          <input
            type="date"
            className="toolbar-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: 125, padding: "4px 6px", fontSize: "0.8rem" }}
            title="Issue date to (leave blank for today)"
          />
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={clearDateRange}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary, #888)", padding: "0 2px", fontSize: 16, lineHeight: 1 }}
              title="Clear date range"
            >✕</button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="empty">Loading your issues...</p>
      ) : filteredIssues.length === 0 ? (
        <p className="empty">No matching issued books found.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th>Issued Date</th>
                <th>Due Date</th>
                <th>Returned Date</th>
                <th>Status</th>
                <th>Fine</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((i) => (
                <tr key={i._id}>
                  <td>
                    <strong>{i.book?.title}</strong>
                    <span className="cell-sub">by {i.book?.author}</span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(i.issueDate)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span style={{ color: i.isOverdue ? "var(--danger, #e53935)" : "inherit" }}>
                      {formatDate(i.dueDate)}
                    </span>
                    {i.reissueCount > 0 && (
                      <span className="cell-sub">{i.reissueCount}x</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(i.returnDate)}</td>
                  <td>{statusBadge(i)}</td>

                  {/* Fine Column with Razorpay Pay Button */}
                  <td style={{ whiteSpace: "nowrap" }}>
                    {i.finePaid ? (
                      <span
                        className="badge badge-success"
                        style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                        title={`Fine settled on ${formatDate(i.finePaidAt)}`}
                      >
                        Paid (₹{i.rawFine || i.fine})
                      </span>
                    ) : i.currentFine > 0 ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: "#dc2626", fontWeight: 700 }}>₹{i.currentFine}</span>
                        <button
                          className="btn btn-sm"
                          onClick={() => handlePayFine(i)}
                          disabled={payingFineId === i._id}
                          style={{
                            padding: "3px 8px",
                            fontSize: "0.72rem",
                            background: "linear-gradient(135deg, #ef4444, #dc2626)",
                            color: "#fff",
                            border: "none",
                            fontWeight: 700,
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                          title="Pay late fine online via Razorpay"
                        >
                          {payingFineId === i._id ? "Processing..." : "Pay Fine"}
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td style={{ textAlign: "right" }}>
                    {i.status === "issued" && (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                        {i.reissueRequested ? (
                          <button
                            className="btn btn-sm"
                            onClick={() => handleCancelReissue(i._id)}
                            disabled={cancellingId === i._id}
                            style={{
                              whiteSpace: "nowrap",
                              background: "#fee2e2",
                              color: "#b91c1c",
                              border: "1px solid #fca5a5",
                              fontWeight: 600,
                            }}
                            title="Cancel your pending reissue request"
                          >
                            {cancellingId === i._id ? "Cancelling..." : "Cancel Request"}
                          </button>
                        ) : (
                          <button
                            className="btn btn-soft btn-sm"
                            onClick={() => setToReissue(i)}
                            disabled={(i.reissueCount || 0) >= 2 || i.isOverdue}
                            style={{ whiteSpace: "nowrap" }}
                            title={
                              i.isOverdue
                                ? "Overdue books cannot be reissued. Please return."
                                : (i.reissueCount || 0) >= 2
                                ? "Max reissues reached"
                                : "Request a due date extension"
                            }
                          >
                            Reissue
                          </button>
                        )}

                        <button
                          className="btn btn-soft btn-sm"
                          onClick={() => setToReturn(i)}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <ReturnIcon size={16} /> Return
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toReissue && (
        <ReissueModal
          issue={toReissue}
          mode="request"
          onClose={() => setToReissue(null)}
          onSaved={() => {
            setToReissue(null);
            load();
          }}
        />
      )}

      {/* Return Confirmation Modal */}
      {toReturn && (
        <Modal title="Return book" onClose={() => setToReturn(null)}>
          <p>
            Are you sure you want to return <strong>{toReturn.book?.title}</strong>?
          </p>
          {toReturn.currentFine > 0 && (
            <p style={{ marginTop: 10 }}>
              <span className="badge badge-danger">Late fine accrued: ₹{toReturn.currentFine}</span>
            </p>
          )}
          <div className="modal-actions">
            <button className="btn btn-soft" onClick={() => setToReturn(null)}>
              Cancel
            </button>
            <button className="btn" onClick={confirmReturn} disabled={returning}>
              {returning ? "Returning..." : "Confirm return"}
            </button>
          </div>
        </Modal>
      )}

      {/* Post-Return Late Fine Settlement Modal */}
      {finePrompt && (
        <Modal
          title="Book Returned Successfully"
          onClose={() => setFinePrompt(null)}
        >
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#fee2e2",
                color: "#dc2626",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h3 style={{ margin: "0 0 6px 0", fontSize: "1.2rem" }}>Late Fine Accrued</h3>
            <p style={{ margin: "0 0 16px 0", color: "var(--text-secondary, #666)", fontSize: "0.92rem" }}>
              <strong>{finePrompt.bookTitle}</strong> has been returned. A late fine of{" "}
              <strong style={{ color: "#dc2626", fontSize: "1.05rem" }}>₹{finePrompt.fine}</strong> is due.
            </p>

            <div
              style={{
                background: "rgba(220, 38, 38, 0.05)",
                border: "1px solid rgba(220, 38, 38, 0.15)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: "0.82rem",
                color: "#991b1b",
                marginBottom: 20,
                textAlign: "left",
              }}
            >
              Note: Unpaid fines pause new book requests. You can pay now online or clear it anytime from your My Issues table.
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => setFinePrompt(null)}
              >
                Pay Later
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                }}
                onClick={() => {
                  const issueObj = finePrompt.issue;
                  setFinePrompt(null);
                  handlePayFine(issueObj);
                }}
              >
                Pay Fine Now (₹{finePrompt.fine})
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}