import { useQuery } from "@tanstack/react-query";
import { Link, Route, Routes, useSearchParams } from "react-router-dom";
import { fetchProblems } from "./api/client";
import ProblemsPage from "./pages/ProblemsPage";
import ProblemDetailPage from "./pages/ProblemDetailPage";
import DashboardPage from "./pages/DashboardPage";

export default function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedTracks = ["all", "ETL", "SQL", "Python", "PySpark", "AWS Data Engineering"] as const;
  const topicOptions: Array<{ value: (typeof allowedTracks)[number]; label: string }> = [
    { value: "all", label: "All Topics" },
    { value: "ETL", label: "ETL Pipelines" },
    { value: "SQL", label: "Database" },
    { value: "Python", label: "Python" },
    { value: "PySpark", label: "PySpark" },
    { value: "AWS Data Engineering", label: "AWS Data Engineering" },
  ];
  const { data: problems } = useQuery({ queryKey: ["problems"], queryFn: fetchProblems });
  const categoryStats = Object.entries(
    (problems ?? []).reduce<Record<string, number>>((acc, problem) => {
      for (const tag of problem.tags ?? []) {
        acc[tag] = (acc[tag] ?? 0) + 1;
      }
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
  const trackParam = searchParams.get("track");
  const track = allowedTracks.includes((trackParam as (typeof allowedTracks)[number]) ?? "all")
    ? (trackParam ?? "all")
    : "all";

  function onTrackChange(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("track");
    else next.set("track", value);
    setSearchParams(next);
  }

  return (
    <div className="container">
      <div className="app-header">
        <h1 className="app-title">Data Engineer Practice</h1>
      </div>
      <div className="category-strip">
        {categoryStats.length > 0 ? (
          categoryStats.map((item) => (
            <span key={item.name} className="category-item">
              {item.name} <span className="category-count">{item.count}</span>
            </span>
          ))
        ) : (
          <span className="category-item">Loading categories...</span>
        )}
      </div>
      <nav className="top-nav">
        <div className="nav-links">
          <Link className="nav-link" to="/">Problems</Link>
          <Link className="nav-link" to="/dashboard">Dashboard</Link>
        </div>
      </nav>
      <div className="topics-row">
        {topicOptions.map((topic) => (
          <button
            key={topic.value}
            className={`topic-chip ${track.toLowerCase() === topic.value.toLowerCase() ? "active" : ""}`}
            onClick={() => onTrackChange(topic.value)}
          >
            {topic.label}
          </button>
        ))}
      </div>
      <Routes>
        <Route path="/" element={<ProblemsPage />} />
        <Route path="/problems/:slug" element={<ProblemDetailPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </div>
  );
}
