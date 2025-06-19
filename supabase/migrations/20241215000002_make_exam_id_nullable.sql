-- Make exam_id nullable in exam_results table to support ad-hoc test results
ALTER TABLE public.exam_results 
ALTER COLUMN exam_id DROP NOT NULL; 