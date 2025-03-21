
export interface Question {
  id: string;
  text: string;
}

export interface Criterion {
  id: string;
  name: string;
  description: string;
  maxScore: number;
}

export interface Room {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  questions: Question[];
  criteria: Criterion[];
  time_limit_per_question: number;
  is_active: boolean;
  share_id: string | null;
}
