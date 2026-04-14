import { useQuery } from "@tanstack/react-query";
import axios from "axios";

type Summary = {
  solved_count: number;
  submissions_count: number;
  streak: number;
};

export default function DashboardPage() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";
  const { data, isLoading } = useQuery({
    queryKey: ["progress"],
    queryFn: async () => {
      const response = await axios.get(`${apiBaseUrl}/progress/summary`);
      return response.data as Summary;
    },
  });

  if (isLoading) return <p>Loading dashboard...</p>;
  if (!data) return <p>No data.</p>;

  return (
    <div className="problem-grid">
      <div className="card">
        <h2>Progress Dashboard</h2>
        <p style={{ fontSize: 28, margin: "8px 0" }}>{data.solved_count}</p>
        <p>Solved Problems</p>
      </div>
      <div className="card">
        <h2>Submissions</h2>
        <p style={{ fontSize: 28, margin: "8px 0" }}>{data.submissions_count}</p>
        <p>Total Attempts</p>
      </div>
      <div className="card">
        <h2>Streak</h2>
        <p style={{ fontSize: 28, margin: "8px 0" }}>{data.streak}</p>
        <p>Current Day Streak</p>
      </div>
    </div>
  );
}
