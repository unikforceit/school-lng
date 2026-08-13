create index if not exists idx_assignment_submissions_assignment on public.assignment_submissions(assignment_id);
create index if not exists idx_intervention_notes_student_id on public.intervention_notes(student_id);
