CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.test_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  full_name text NOT NULL,
  age integer NOT NULL,
  gender text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  ip_address text,
  user_agent text,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0,
  answered_count integer NOT NULL DEFAULT 0,
  last_question integer NOT NULL DEFAULT 1,
  last_left_at timestamptz,
  last_returned_at timestamptz,
  leave_count integer NOT NULL DEFAULT 0,
  results jsonb,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.test_sessions TO service_role;
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read sessions" ON public.test_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.test_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.test_sessions(id) ON DELETE CASCADE,
  question_no integer NOT NULL,
  answer text NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_no)
);
CREATE INDEX test_answers_session_idx ON public.test_answers(session_id);
GRANT ALL ON public.test_answers TO service_role;
ALTER TABLE public.test_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read answers" ON public.test_answers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.test_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  question_no integer,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX session_events_session_idx ON public.session_events(session_id, created_at);
GRANT ALL ON public.session_events TO service_role;
ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read events" ON public.session_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER test_sessions_updated_at BEFORE UPDATE ON public.test_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();