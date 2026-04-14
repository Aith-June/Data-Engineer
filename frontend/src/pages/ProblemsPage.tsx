import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { fetchProblems } from "../api/client";

export default function ProblemsPage() {
  const [search, setSearch] = useState("");
  const [difficultyLevel, setDifficultyLevel] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTrack = (searchParams.get("track") ?? "all").toLowerCase();
  const { data, isLoading } = useQuery({ queryKey: ["problems"], queryFn: fetchProblems });
  const availableTags = useMemo(
    () => new Set((data ?? []).flatMap((p) => p.tags.map((tag) => tag.toLowerCase()))),
    [data],
  );
  const track = rawTrack === "all" || availableTags.has(rawTrack) ? rawTrack : "all";

  useEffect(() => {
    if (rawTrack !== "all" && track === "all") {
      const next = new URLSearchParams(searchParams);
      next.delete("track");
      setSearchParams(next);
    }
  }, [rawTrack, track, searchParams, setSearchParams]);

  const filtered = useMemo(
    () =>
      (data ?? []).filter((p) => {
        const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
        const matchesTrack =
          track === "all" || p.tags.some((tag) => tag.toLowerCase() === track);
        const matchesDifficulty =
          difficultyLevel === "all" || p.difficulty.toLowerCase() === difficultyLevel;
        return matchesSearch && matchesTrack && matchesDifficulty;
      }),
    [data, search, track, difficultyLevel],
  );
  const sorted = useMemo(() => {
    const difficultyRank: Record<string, number> = { easy: 1, medium: 2, hard: 3 };
    const list = [...filtered];
    list.sort((a, b) => (difficultyRank[a.difficulty.toLowerCase()] ?? 99) - (difficultyRank[b.difficulty.toLowerCase()] ?? 99));
    return list;
  }, [filtered]);

  if (isLoading) return <p>Loading problems...</p>;

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search problems"
        style={{ width: "100%", marginBottom: 12 }}
      />
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="difficulty-sort" style={{ marginRight: 8 }}>Difficulty:</label>
        <select
          id="difficulty-sort"
          value={difficultyLevel}
          onChange={(e) => setDifficultyLevel(e.target.value as "all" | "easy" | "medium" | "hard")}
        >
          <option value="all">All</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>
      <div className="problem-grid">
        {sorted.map((problem) => (
          <div key={problem.id} className="card">
            <h3>{problem.title}</h3>
            <p>{problem.difficulty}</p>
            <div style={{ marginBottom: 8 }}>
              {problem.tags.map((tag) => (
                <span key={tag} className="pill">{tag}</span>
              ))}
            </div>
            <Link to={`/problems/${problem.slug}`}>Solve</Link>
          </div>
        ))}
        {sorted.length === 0 ? (
          <div className="card">
            <h3>No questions match current filters</h3>
            <p>Try clearing search/topic filter to see all problems.</p>
            <button
              onClick={() => {
                setSearch("");
                setSearchParams({});
              }}
            >
              Clear Filters
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
