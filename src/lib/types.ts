export type Task = {
  id: string;
  user_id: string;
  seq: number;
  name: string;
  created_at: string;
  is_running: boolean;
  started_at: string | null;
  total_seconds: number;
};
