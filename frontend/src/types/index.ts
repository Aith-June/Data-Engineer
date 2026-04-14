export type Problem = {
  id: number;
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  statement?: string;
  starter_code?: Record<string, string>;
  sample_tests?: Array<Record<string, unknown>>;
};

export type Submission = {
  id: number;
  status: string;
  passed_cases: number;
  total_cases: number;
  runtime_ms: number;
  memory_kb: number;
  logs: string;
  is_run: boolean;
  created_at: string;
  case_results?: Array<{
    index: number;
    passed: boolean;
    input: unknown;
    expected: unknown;
    output: unknown;
    message: string;
  }>;
};
