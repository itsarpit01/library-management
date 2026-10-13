import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import StatCard from "../components/StatCard";
import { BookIcon, RequestIcon, CheckIcon, ClockIcon } from "../components/Icons";

export default function PurchaserHome() {
  const { user } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState(null);
  const [issuedCount, setIssuedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/dashboard/my"), api.get("/issues/my")])
      .then(([statsRes, issuesRes]) => {
        setRequests(statsRes.data.purchaseRequests);
        const list = Array.isArray(issuesRes.data) ? issuesRes.data : issuesRes.data.data || [];
        setIssuedCount(list.filter((i) => i.status === "issued").length);
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <p className="empty">Loading dashboard...</p>;
  if (!requests) return <p className="empty">Could not load dashboard.</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Hello, {user?.name}</h2>
          <p>Here is a summary of your activity.</p>
        </div>
        <Link to="/purchaser/books" className="btn">Browse books</Link>
      </div>

      <div className="stat-grid">
        <StatCard icon={BookIcon} label="Books issued to me" value={issuedCount} />
        <StatCard icon={ClockIcon} label="Pending requests" value={requests.pending} tone="warning" />
        <StatCard icon={CheckIcon} label="Approved requests" value={requests.approved} tone="success" />
        <StatCard icon={RequestIcon} label="Total requests" value={requests.total} />
      </div>
    </>
  );
}