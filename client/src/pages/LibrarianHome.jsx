import { useEffect, useState } from "react";
import api from "../api/axios";

export default function LibrarianHome() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((res) => setStats(res.data));
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <p>Overview of your library.</p>
        </div>
      </div>
      <div className="card">
        <pre style={{ margin: 0 }}>{JSON.stringify(stats, null, 2)}</pre>
      </div>
    </>
  );
}