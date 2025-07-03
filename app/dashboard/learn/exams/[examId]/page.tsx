'use client';

import { useState, useEffect } from 'react';
import { Loader2, ArrowLeft, CheckCircle, XCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Quiz, Question, Exam, QuestionResult } from '@/lib/types';
import { useToast } from '@/components/ui/use-toast';
import { Progress } from "@/components/ui/progress";
import { v4 as uuidv4 } from 'uuid';
import { useSupabase } from '@/utils/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export default function TakeExamPage() {
  // Use the useParams hook to get route parameters in a client component
  const params = useParams();
  const examId = params.examId as string;
  const [user, setUser] = useState<any>(null);
  const [contentLoading, setContentLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exam, setExam] = useState<Exam | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [examCompleted, setExamCompleted] = useState(false);
  const [examResults, setExamResults] = useState<{
    score: number;
    totalQuestions: number;
    questionResults: QuestionResult[];
  } | null>(null);
  const { supabase, loading: supabaseLoading, error: supabaseError } = useSupabase();
  const { toast } = useToast();
  const router = useRouter();
  const { user: authUser } = useAuth();
  
  // Combine loading states
  const isLoading = contentLoading || supabaseLoading;

  useEffect(() => {
    const fetchExamAndQuizzes = async () => {
      // Wait for supabase to be initialized
      if (!supabase) return;
      
      try {
        // Use the user from AuthProvider if available, otherwise get from Supabase
        let currentUser = authUser;
        
        if (!currentUser) {
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          
          if (userError) {
            console.error("User authentication error:", userError);
            toast({
              title: "Authentication error",
              description: "Please sign in again to continue",
              variant: "destructive",
            });
            router.push('/auth/sign-in');
            return;
          }
          
          currentUser = user;
        }
        
        if (!currentUser) {
          console.log("No authenticated user found");
          toast({
            title: "Not signed in",
            description: "Please sign in to take this exam",
            variant: "destructive",
          });
          router.push('/auth/sign-in');
          return;
        }
        
        setUser(currentUser);
        console.log("Current user:", currentUser);
        console.log("Exam ID:", examId);

        // Fetch exam
        const { data: examData, error: examError } = await supabase
          .from('exams')
          .select('*')
          .eq('id', examId)
          .eq('user_id', currentUser.id)
          .single();

        if (examError) {
          console.error("Error fetching exam:", examError);
          
          // Check if the exam was not found
          if (examError.code === 'PGRST116') {
            toast({
              title: "Exam not found",
              description: "This exam may have been deleted or you don't have access to it",
              variant: "destructive",
            });
            
            // Redirect back to the learn page
            router.push('/dashboard/learn');
            return;
          }
          
          toast({
            title: "Error loading exam",
            description: examError.message || "Could not find the requested exam",
            variant: "destructive",
          });
          router.push('/dashboard/learn');
          return;
        }
        
        console.log("Fetched exam:", examData);
        setExam(examData);
        
        // Fetch all quizzes included in the exam
        if (examData.quiz_ids && examData.quiz_ids.length > 0) {
          const { data: quizzesData, error: quizzesError } = await supabase
            .from('quizzes')
            .select('*')
            .in('id', examData.quiz_ids)
            .eq('user_id', currentUser.id);
          
          if (quizzesError) {
            console.error("Error fetching quizzes:", quizzesError);
            toast({
              title: "Error loading quizzes",
              description: quizzesError.message || "Could not load the quizzes for this exam",
              variant: "destructive",
            });
            return;
          }
          
          console.log("Fetched quizzes:", quizzesData);
          
          // Normalize quiz data to handle field name mismatches
          const normalizedQuizzes = quizzesData.map((quiz: any) => ({
            id: quiz.id,
            title: quiz.title,
            user_id: quiz.user_id,
            created_at: quiz.created_at,
            pdf_url: quiz.pdf_url || '',
            questions: (quiz.questions || []).map((q: any) => ({
              ...q,
              // Ensure both field naming conventions are available
              id: q.id || `q-${uuidv4()}`,
              quizId: quiz.id,
              text: q.text || q.question || '',
              correctAnswer: q.correctAnswer || q.answer || '',
              type: q.type || 'open_ended',
              options: q.options || [] // Ensure options field exists
            })),
            settings: quiz.settings || {
              numberOfQuestions: quiz.questions?.length || 0,
              difficulty: 'medium',
              questionType: 'multiple_choice'
            },
            subject: quiz.subject || '',
            color: quiz.color || ''
          }));
          
          setQuizzes(normalizedQuizzes);
          
          // Combine all questions from all quizzes
          const allQuestionsArray: Question[] = [];
          normalizedQuizzes.forEach((quiz: any) => {
            if (quiz.questions && Array.isArray(quiz.questions)) {
              allQuestionsArray.push(...quiz.questions);
            }
          });
          
          console.log("All questions:", allQuestionsArray);
          setAllQuestions(allQuestionsArray);
        }
      } catch (error: any) {
        console.error('Error fetching exam:', error);
        toast({
          title: "Error loading exam",
          description: error.message || "There was a problem loading the exam data.",
          variant: "destructive",
        });
        router.push('/dashboard/learn');
      } finally {
        setContentLoading(false);
      }
    };

    fetchExamAndQuizzes();
  }, [examId, supabase, toast, router, authUser]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const submitExam = async () => {
    if (!exam || !allQuestions || allQuestions.length === 0) return;
    
    try {
      setSubmitting(true);
      
      // Calculate results
      let score = 0;
      const questionResults: QuestionResult[] = [];
      
      allQuestions.forEach(question => {
        const userAnswer = userAnswers[question.id] || '';
        
        let isCorrect = false;
        
        if (question.type === 'multiple_choice' && question.options) {
          // For multiple choice, we need to handle different ways the correct answer might be stored
          
          // First, try direct match with the correct answer text
          if (userAnswer === question.correctAnswer) {
            isCorrect = true;
          } else {
            // If no direct match, check if the correct answer is stored as a letter (A, B, C, D)
            // and find the corresponding option
            const letterMatch = question.correctAnswer.match(/^([A-D])\)/);
            if (letterMatch) {
              const letterIndex = letterMatch[1].charCodeAt(0) - 65; // A=0, B=1, etc.
              if (question.options[letterIndex] === userAnswer) {
                isCorrect = true;
              }
            } else {
              // Check if userAnswer matches any option and that option contains the correct answer
              const selectedOptionIndex = question.options.findIndex(option => option === userAnswer);
              if (selectedOptionIndex !== -1) {
                // Check if the selected option text matches the correct answer text
                const cleanUserAnswer = userAnswer.trim().toLowerCase();
                const cleanCorrectAnswer = question.correctAnswer.trim().toLowerCase();
                
                // Remove letter prefixes if they exist (like "A) " or "a) ")
                const cleanedCorrectAnswer = cleanCorrectAnswer.replace(/^[a-d]\)\s*/i, '');
                const cleanedUserAnswer = cleanUserAnswer.replace(/^[a-d]\)\s*/i, '');
                
                if (cleanedUserAnswer === cleanedCorrectAnswer) {
                  isCorrect = true;
                }
              }
            }
          }
        } else {
          // For open-ended questions, use case-insensitive comparison
          const cleanUserAnswer = userAnswer.trim().toLowerCase();
          const cleanCorrectAnswer = question.correctAnswer.trim().toLowerCase();
          isCorrect = cleanUserAnswer === cleanCorrectAnswer;
        }
        
        if (isCorrect) {
          score++;
        }
        
        questionResults.push({
          question_id: question.id,
          quiz_id: question.quizId,
          user_answer: userAnswer,
          correct_answer: question.correctAnswer,
          is_correct: isCorrect,
          question_text: question.text,
          options: question.options || [],
          type: question.type || 'open_ended',
        });
      });
      
      const totalQuestions = allQuestions.length;
      const results = {
        score,
        totalQuestions,
        questionResults
      };
      
      // Save results to database
      const examResult = {
        id: uuidv4(),
        user_id: user.id,
        exam_id: exam.id,
        score,
        total_questions: totalQuestions,
        question_results: questionResults,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      const { data: resultData, error: resultError } = await supabase
        .from('exam_results')
        .insert(examResult)
        .select()
        .single();

      if (resultError) {
        console.error('Error saving exam results:', resultError);
        toast({
          title: "Warning",
          description: "Your exam results could not be saved, but you can still view them here.",
          variant: "destructive",
        });
      }
      
      // Set state after database operations
      setExamResults(results);
      setExamCompleted(true);
      
      // Use setTimeout to ensure the state update has completed before scrolling
      setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: 'auto'
        });
      }, 0);
      
    } catch (error: any) {
      console.error('Error completing exam:', error);
      toast({
        title: "Error",
        description: error.message || "There was a problem completing your exam.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetExam = () => {
    setUserAnswers({});
    setExamCompleted(false);
    setExamResults(null);
    window.scrollTo(0, 0);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <h2 className="text-2xl font-bold mb-4">Exam not found</h2>
        <p className="mb-6">The exam you're looking for doesn't exist or you don't have access to it.</p>
        <Link href="/dashboard/learn">
          <Button>Back to Learn</Button>
        </Link>
      </div>
    );
  }

  if (examCompleted && examResults) {
    // Show exam results
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/dashboard/learn">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{exam.title} - Results</h1>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Exam Completed!</h2>
            <p className="text-gray-500">
              You scored {examResults.score} out of {examResults.totalQuestions} ({Math.round((examResults.score / examResults.totalQuestions) * 100)}%)
            </p>
          </div>
          
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-1">
              <span>Score</span>
              <span>{Math.round((examResults.score / examResults.totalQuestions) * 100)}%</span>
            </div>
            <Progress 
              value={Math.round((examResults.score / examResults.totalQuestions) * 100)} 
              className="h-2"
            />
          </div>
          
          <div className="space-y-4 mt-8">
            <h3 className="text-lg font-semibold">Question Review</h3>
            
            {examResults.questionResults.map((result, index) => {
              const question = allQuestions.find(q => q.id === result.question_id);
              if (!question) return null;
              
              return (
                <Card key={result.question_id} className={`border-l-4 ${result.is_correct ? 'border-l-green-500' : 'border-l-red-500'}`}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base">Question {index + 1}</CardTitle>
                      {result.is_correct ? (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          <span className="text-sm">Correct</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-red-600">
                          <XCircle className="h-4 w-4 mr-1" />
                          <span className="text-sm">Incorrect</span>
                        </div>
                      )}
                    </div>
                    <CardDescription className="text-sm mt-1">
                      {question.text}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 text-sm">
                      {question.type === 'multiple_choice' && question.options && (
                        <div className="mt-2">
                          {question.options.map((option, optionIndex) => {
                            // Determine if this option is the correct answer
                            let isCorrectOption = false;
                            
                            // Check direct match first
                            if (option === result.correct_answer) {
                              isCorrectOption = true;
                            } else {
                              // Check if correct answer is stored as a letter (A, B, C, D)
                              const letterMatch = result.correct_answer.match(/^([A-D])\)/);
                              if (letterMatch) {
                                const letterIndex = letterMatch[1].charCodeAt(0) - 65; // A=0, B=1, etc.
                                if (optionIndex === letterIndex) {
                                  isCorrectOption = true;
                                }
                              } else {
                                // Check if option text matches correct answer text (case insensitive, ignoring letter prefixes)
                                const cleanOption = option.trim().toLowerCase().replace(/^[a-d]\)\s*/i, '');
                                const cleanCorrectAnswer = result.correct_answer.trim().toLowerCase().replace(/^[a-d]\)\s*/i, '');
                                if (cleanOption === cleanCorrectAnswer) {
                                  isCorrectOption = true;
                                }
                              }
                            }
                            
                            const isUserSelected = option === result.user_answer;
                            
                            return (
                              <div 
                                key={optionIndex} 
                                className={`p-2 rounded-md mb-1 ${
                                  isCorrectOption
                                    ? 'bg-green-100 border border-green-300 text-green-800' 
                                    : isUserSelected && !isCorrectOption
                                      ? 'bg-red-100 border border-red-300 text-red-800'
                                      : 'bg-gray-100 border border-gray-300 text-gray-800'
                                }`}
                              >
                                {option}
                                {isCorrectOption && (
                                  <span className="ml-2 text-green-600">✓ Correct answer</span>
                                )}
                                {isUserSelected && !isCorrectOption && (
                                  <span className="ml-2 text-red-600">✗ Your answer</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {question.type === 'open_ended' && (
                        <>
                          <div>
                            <span className="font-medium">Your answer: </span>
                            <span className={result.is_correct ? 'text-green-600' : 'text-red-600'}>
                              {result.user_answer || '(No answer provided)'}
                            </span>
                          </div>
                          {!result.is_correct && (
                            <div>
                              <span className="font-medium">Correct answer: </span>
                              <span className="text-green-600">{result.correct_answer}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          <div className="flex justify-between mt-6">
            <Link href="/dashboard/learn">
              <Button variant="outline">
                Back to Learn
              </Button>
            </Link>
            <Button onClick={resetExam}>
              Retake Exam
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Taking the exam
  if (allQuestions.length === 0) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/dashboard/learn">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{exam.title}</h1>
        </div>

        <div className="p-6 bg-white rounded-lg shadow-md text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No questions available</h2>
          <p className="text-gray-500 mb-4">This exam doesn't contain any questions. Please edit the exam to include quizzes with questions.</p>
          <Link href="/dashboard/learn">
            <Button>Back to Learn</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Long-format exam view
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/dashboard/learn">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{exam.title}</h1>
      </div>

      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{exam.title}</h2>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Exam Instructions</h2>
          <p className="text-gray-600">
            This exam contains {allQuestions.length} questions from {quizzes.length} {quizzes.length === 1 ? 'quiz' : 'quizzes'}.
            Answer all questions and click "Submit Exam" at the bottom when you're finished.
            You will see your results after submission.
          </p>
          {exam.description && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <h3 className="text-sm font-medium mb-1">Exam Description:</h3>
              <p className="text-sm text-gray-600">{exam.description}</p>
            </div>
          )}
        </div>

        <Separator className="my-6" />

        <form onSubmit={(e) => { e.preventDefault(); submitExam(); }}>
          <div className="space-y-8">
            {allQuestions.map((question, index) => (
              <div key={question.id} className="p-4 border rounded-lg">
                <h3 className="text-lg font-medium mb-2">Question {index + 1}</h3>
                <p className="mb-4">
                  {question.type === 'cloze' 
                    ? (question as any).clozeText?.replace(/\{\{c1::(.*?)\}\}/g, '_______________')
                    : question.text
                  }
                </p>
                
                {question.type === 'multiple_choice' && question.options && (
                  <RadioGroup 
                    value={userAnswers[question.id] || ''} 
                    onValueChange={(value) => handleAnswerChange(question.id, value)}
                    className="space-y-2"
                  >
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`q${index}-option-${optionIndex}`} />
                        <Label htmlFor={`q${index}-option-${optionIndex}`} className="cursor-pointer">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
                
                {question.type === 'open_ended' && (
                  <Textarea
                    placeholder="Enter your answer here..."
                    value={userAnswers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    className="w-full"
                    rows={3}
                  />
                )}
                
                {question.type === 'cloze' && (
                  <div>
                    <Label htmlFor={`cloze-answer-${index}`} className="text-sm font-medium text-gray-700 mb-2 block">
                      Fill in the blank:
                    </Label>
                    <Input
                      id={`cloze-answer-${index}`}
                      placeholder="Enter your answer..."
                      value={userAnswers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      className="text-lg w-full"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-8 flex justify-between">
            <Link href="/dashboard/learn">
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit" 
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : 'Submit Exam'}
            </Button>
          </div>
        </form>
      </div>


    </div>
  );
} 