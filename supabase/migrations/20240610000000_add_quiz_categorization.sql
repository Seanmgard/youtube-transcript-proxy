-- Add subject and color fields to quizzes table
ALTER TABLE quizzes
ADD COLUMN subject text,
ADD COLUMN color text;

-- Create an index on the subject field for faster queries
CREATE INDEX idx_quizzes_subject ON quizzes (subject);

COMMENT ON COLUMN quizzes.subject IS 'The subject category of the quiz';
COMMENT ON COLUMN quizzes.color IS 'The color code for visual categorization of the quiz'; 