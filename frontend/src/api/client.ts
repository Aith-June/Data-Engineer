import axios from "axios";
import type { Problem, Submission } from "../types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

const api = axios.create({
  baseURL: apiBaseUrl,
});

export async function fetchProblems(): Promise<Problem[]> {
  const response = await api.get("/problems");
  return response.data as Problem[];
}

export async function fetchProblem(slug: string): Promise<Problem> {
  const response = await api.get(`/problems/${slug}`);
  return response.data as Problem;
}

export async function runOrSubmit(
  mode: "run" | "submit" | "run-custom",
  payload: { problem_slug: string; language: string; code: string; custom_input?: unknown },
): Promise<Submission> {
  const response = await api.post(`/submissions/${mode}`, payload);
  return response.data as Submission;
}

export async function fetchHistory(problemSlug: string): Promise<Submission[]> {
  const response = await api.get("/submissions/history", {
    params: { problem_slug: problemSlug },
  });
  return response.data as Submission[];
}
