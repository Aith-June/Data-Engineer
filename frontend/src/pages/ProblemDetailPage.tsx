import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { fetchHistory, fetchProblem, runOrSubmit } from "../api/client";
import type { Submission } from "../types";

function canonicalLanguage(lang: string): string {
  const normalized = lang.toLowerCase();
  if (normalized === "pyspark") return "python";
  return normalized;
}

export default function ProblemDetailPage() {
  const { slug = "" } = useParams();
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [latest, setLatest] = useState<Submission | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<"testcase" | "result" | "submissions">("testcase");
  const [execError, setExecError] = useState("");
  const [caseIndex, setCaseIndex] = useState(0);
  const [customInputText, setCustomInputText] = useState("");
  const [leftWidth, setLeftWidth] = useState(46);
  const [isDragging, setIsDragging] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
  const [localStreak, setLocalStreak] = useState(0);

  const { data: problem, isLoading } = useQuery({
    queryKey: ["problem", slug],
    queryFn: () => fetchProblem(slug),
    enabled: !!slug,
  });

  const { data: history } = useQuery({
    queryKey: ["history", slug],
    queryFn: () => fetchHistory(slug),
    enabled: !!slug,
  });

  const availableLanguages = useMemo(
    () => {
      const fromTests = new Set(
        (problem?.sample_tests ?? []).map((item) => String((item as { kind?: string }).kind ?? "").toLowerCase()),
      );
      const filtered = Object.entries(problem?.starter_code ?? {})
        .map(([lang]) => lang.toLowerCase())
        .filter((lang) => !fromTests.size || fromTests.has(lang) || fromTests.has(canonicalLanguage(lang)));
      if ((problem?.tags ?? []).some((tag) => tag.toLowerCase() === "pyspark") && filtered.includes("python")) {
        filtered.push("pyspark");
      }
      return Array.from(new Set(filtered));
    },
    [problem?.starter_code, problem?.sample_tests, problem?.tags],
  );
  const runtimePercentile = useMemo(() => {
    if (!latest) return null;
    const p = 100 - Math.min(99, Math.floor((latest.runtime_ms / 250) * 100));
    return Math.max(1, p);
  }, [latest]);

  useEffect(() => {
    if (!availableLanguages.length) return;
    if (!availableLanguages.includes(language)) {
      setLanguage(availableLanguages[0]);
      setCode("");
    }
  }, [availableLanguages, language]);

  useEffect(() => {
    const raw = localStorage.getItem("de_practice_streak");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { streak: number };
      setLocalStreak(parsed.streak ?? 0);
    } catch {
      setLocalStreak(0);
    }
  }, []);

  useEffect(() => {
    if (!timerRunning) return;
    const t = window.setInterval(() => setElapsedSeconds((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, [timerRunning]);

  useEffect(() => {
    if (!isDragging) return;
    function onMouseMove(event: MouseEvent) {
      const wrap = document.getElementById("problem-splitter-wrap");
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const pct = ((event.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(70, Math.max(30, pct)));
    }
    function onMouseUp() {
      setIsDragging(false);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  if (isLoading) return <p>Loading question...</p>;
  if (!problem) return <p>Question not found.</p>;

  const starter = problem.starter_code?.[language] ?? problem.starter_code?.[canonicalLanguage(language)] ?? "";
  const testsForLanguage = (problem.sample_tests ?? []).filter(
    (item) => canonicalLanguage(String((item as { kind?: string }).kind ?? "")) === canonicalLanguage(language),
  );
  const effectiveCaseIndex = caseIndex < testsForLanguage.length ? caseIndex : 0;
  const sample =
    (testsForLanguage[effectiveCaseIndex] as
      | { input?: unknown; expected?: unknown; schema?: string; seed_rows?: unknown[] }
      | undefined) ?? {};

  function updateLocalStreakOnAccept() {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const currentRaw = localStorage.getItem("de_practice_streak");
    let next = { lastSolvedDate: today, streak: 1 };
    if (currentRaw) {
      try {
        const parsed = JSON.parse(currentRaw) as { lastSolvedDate?: string; streak?: number };
        if (parsed.lastSolvedDate === today) {
          next = { lastSolvedDate: today, streak: parsed.streak ?? 1 };
        } else if (parsed.lastSolvedDate === yesterday) {
          next = { lastSolvedDate: today, streak: (parsed.streak ?? 0) + 1 };
        }
      } catch {
        next = { lastSolvedDate: today, streak: 1 };
      }
    }
    localStorage.setItem("de_practice_streak", JSON.stringify(next));
    setLocalStreak(next.streak);
  }

  async function execute(mode: "run" | "submit" | "run-custom") {
    setIsRunning(true);
    setExecError("");
    try {
      const payload: { problem_slug: string; language: string; code: string; custom_input?: unknown } = {
        problem_slug: slug,
        language,
        code: code || starter,
      };
      if (mode === "run-custom") {
        payload.custom_input = customInputText.trim() ? JSON.parse(customInputText) : null;
      }
      const result = await runOrSubmit(mode, payload);
      setLatest(result);
      setActiveTab("result");
      if (mode === "submit" && result.status === "Accepted") {
        updateLocalStreakOnAccept();
      }
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? String((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Execution failed")
          : "Execution failed";
      setExecError(message);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <strong>Contest Session</strong>
          <div style={{ opacity: 0.85 }}>
            Time: {String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:{String(elapsedSeconds % 60).padStart(2, "0")}
            {" | "}Local Streak: {localStreak} day(s)
            {sessionStartedAt ? ` | Started: ${sessionStartedAt.toLocaleTimeString()}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              if (!sessionStartedAt) setSessionStartedAt(new Date());
              setTimerRunning((v) => !v);
            }}
          >
            {timerRunning ? "Pause Timer" : "Start Timer"}
          </button>
          <button
            onClick={() => {
              setTimerRunning(false);
              setElapsedSeconds(0);
              setSessionStartedAt(null);
            }}
          >
            Reset Timer
          </button>
        </div>
      </div>
      <div id="problem-splitter-wrap" className="split-resizable" style={{ gridTemplateColumns: `${leftWidth}% 8px 1fr` }}>
        <div className="card">
          <h2>{problem.title}</h2>
          <p>{problem.difficulty} | {problem.tags.join(", ")}</p>
          <pre style={{ whiteSpace: "pre-wrap" }}>{problem.statement ?? "No statement provided."}</pre>
        </div>
        <div
          className="splitter-handle"
          onMouseDown={() => setIsDragging(true)}
          role="separator"
          aria-label="Resize panels"
        />

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          <Editor
            height="70vh"
            language={language}
            value={code || starter}
            onChange={(v) => setCode(v ?? "")}
            theme="vs-dark"
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => execute("run")} disabled={isRunning}>
              {isRunning ? "Running..." : "Run"}
            </button>
            <button onClick={() => execute("submit")} disabled={isRunning}>
              {isRunning ? "Submitting..." : "Submit"}
            </button>
            <button onClick={() => execute("run-custom")} disabled={isRunning}>
              {isRunning ? "Running..." : "Run Custom"}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        {execError ? (
          <div style={{ marginBottom: 10, color: "#fecaca" }}>
            <strong>Error:</strong> {execError}
          </div>
        ) : null}
        <div className="tabs">
          <button className={`tab-btn ${activeTab === "testcase" ? "active" : ""}`} onClick={() => setActiveTab("testcase")}>
            Testcase
          </button>
          <button className={`tab-btn ${activeTab === "result" ? "active" : ""}`} onClick={() => setActiveTab("result")}>
            Result
          </button>
          <button className={`tab-btn ${activeTab === "submissions" ? "active" : ""}`} onClick={() => setActiveTab("submissions")}>
            Submissions
          </button>
        </div>

        {activeTab === "testcase" ? (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              {testsForLanguage.map((_, idx) => (
                <button key={idx} className={`tab-btn ${effectiveCaseIndex === idx ? "active" : ""}`} onClick={() => setCaseIndex(idx)}>
                  Case {idx + 1}
                </button>
              ))}
            </div>
            <p><strong>Input</strong></p>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(language === "sql" ? { schema: sample.schema, seed_rows: sample.seed_rows } : sample.input, null, 2)}
            </pre>
            <p><strong>Expected Output</strong></p>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(sample.expected, null, 2)}</pre>
            <p><strong>Custom Input (JSON)</strong></p>
            <textarea
              value={customInputText}
              onChange={(e) => setCustomInputText(e.target.value)}
              placeholder={JSON.stringify(sample.input ?? null, null, 2)}
              style={{ width: "100%", minHeight: 130 }}
            />
          </div>
        ) : null}

        {activeTab === "result" ? (
          latest ? (
            <div>
              <p><strong>Status:</strong> {latest.status}</p>
              <p><strong>Testcases:</strong> {latest.passed_cases}/{latest.total_cases}</p>
              <p><strong>Runtime:</strong> {latest.runtime_ms}ms</p>
              <p><strong>Memory:</strong> {latest.memory_kb}KB</p>
              {runtimePercentile ? <p><strong>Runtime Percentile:</strong> Beats {runtimePercentile}% (mock)</p> : null}
              {(latest.case_results ?? []).length ? (
                latest.is_run ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {(latest.case_results ?? []).map((item) => (
                      <div key={item.index} className="card" style={{ margin: 0 }}>
                        <p>
                          <strong>Case {item.index}:</strong> {item.passed ? "Passed" : "Failed"}
                        </p>
                        <p><strong>Input</strong></p>
                        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(item.input, null, 2)}</pre>
                        <p><strong>Expected</strong></p>
                        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(item.expected, null, 2)}</pre>
                        <p><strong>Your Output</strong></p>
                        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(item.output, null, 2)}</pre>
                        <p><strong>Judge Message:</strong> {item.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="card" style={{ margin: 0 }}>
                    <p><strong>Hidden testcase panel locked for Submit.</strong></p>
                    <p>Run code to inspect visible testcase-level Input / Expected / Your Output.</p>
                  </div>
                )
              ) : (
                <pre style={{ whiteSpace: "pre-wrap" }}>{latest.logs}</pre>
              )}
            </div>
          ) : (
            <p>No execution yet.</p>
          )
        ) : null}

        {activeTab === "submissions" ? (
          <ul>
            {(history ?? []).map((item) => (
              <li key={item.id}>
                {item.status} - {item.passed_cases}/{item.total_cases}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
