'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  ArrowLeft,
  RotateCcw,
  Trophy,
  Target
} from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/components/ui/use-toast';
import { Quiz, Question, QuestionResult } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  quiz: Quiz;
  onComplete?: (score: number, totalQuestions: number) => void;
  onBack?: () => void;
  className?: string;
}

export function QuizTestComponent({ quiz, onComplete, onBack, className }: Props) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{
    score: number;
    totalQuestions: number;
    questionResults: QuestionResult[];
  } | null>(null);
  const [startTime] = useState(Date.now());
  const [timeSpent, setTimeSpent] = useState(0);

  const { supabase } = useSupabase();
  const { user } = useAuth();
  const { toast } = useToast();

  // Update time spent every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const submitQuiz = async () => {
    if (!user || !supabase) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save your quiz results.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Calculate results
      let score = 0;
      const questionResults: QuestionResult[] = [];

      quiz.questions.forEach(question => {
        const userAnswer = userAnswers[question.id] || '';
        let isCorrect = false;

        if (question.type === 'multiple_choice' && question.options) {
          // Try multiple matching strategies for multiple choice
          if (userAnswer === question.correctAnswer) {
            isCorrect = true;
          } else {
            // Check if correct answer is stored as a letter (A, B, C, D)
            const answerLetter = question.correctAnswer.trim().toUpperCase();
            if (answerLetter.match(/^[A-D]$/)) {
              const letterIndex = answerLetter.charCodeAt(0) - 65;
              if (question.options[letterIndex] === userAnswer) {
                isCorrect = true;
              }
            } else {
              // Check if answer contains the correct text
              const cleanUserAnswer = userAnswer.trim().toLowerCase();
              const cleanCorrectAnswer = question.correctAnswer.trim().toLowerCase();
              const cleanedCorrectAnswer = cleanCorrectAnswer.replace(/^[a-d]\)\s*/i, '');
              const cleanedUserAnswer = cleanUserAnswer.replace(/^[a-d]\)\s*/i, '');
              
              if (cleanedUserAnswer === cleanedCorrectAnswer) {
                isCorrect = true;
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
          quiz_id: quiz.id,
          user_answer: userAnswer,
          correct_answer: question.correctAnswer,
          is_correct: isCorrect
        });
      });

      const totalQuestions = quiz.questions.length;
      const finalTimeSpent = Math.floor((Date.now() - startTime) / 1000);

      const resultsData = {
        score,
        totalQuestions,
        questionResults
      };

      setResults(resultsData);
      setShowResults(true);

      // Save to database
      try {
        const response = await fetch('/api/quiz-attempts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quiz_id: quiz.id,
            score,
            total_questions: totalQuestions,
            question_results: questionResults,
            time_spent_seconds: finalTimeSpent
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save quiz attempt');
        }

        toast({
          title: "Quiz completed!",
          description: `You scored ${score} out of ${totalQuestions} (${Math.round((score/totalQuestions)*100)}%)`,
        });
      } catch (error) {
        console.error('Error saving quiz attempt:', error);
        toast({
          title: "Results saved locally",
          description: "Your results couldn't be saved to the server, but you can still view them here.",
          variant: "default",
        });
      }

      // Call completion callback
      if (onComplete) {
        onComplete(score, totalQuestions);
      }

    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast({
        title: "Error submitting quiz",
        description: "There was a problem processing your answers.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setShowResults(false);
    setResults(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (percentage: number) => {
    if (percentage >= 90) return 'default';
    if (percentage >= 70) return 'secondary';
    return 'destructive';
  };

  if (showResults && results) {
    const percentage = Math.round((results.score / results.totalQuestions) * 100);
    
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Results Header */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {percentage >= 90 ? (
                <Trophy className="h-16 w-16 text-yellow-500" />
              ) : percentage >= 70 ? (
                <Target className="h-16 w-16 text-blue-500" />
              ) : (
                <RotateCcw className="h-16 w-16 text-gray-500" />
              )}
            </div>
            <CardTitle className="text-2xl">Quiz Completed!</CardTitle>
            <CardDescription>
              You scored {results.score} out of {results.totalQuestions} questions correctly
            </CardDescription>
            
            <div className="flex justify-center items-center space-x-4 mt-4">
              <Badge variant={getScoreBadgeVariant(percentage)} className="text-lg px-4 py-2">
                {percentage}%
              </Badge>
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="h-4 w-4 mr-1" />
                {formatTime(timeSpent)}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Question Review */}
        <Card>
          <CardHeader>
            <CardTitle>Question Review</CardTitle>
            <CardDescription>
              Review your answers and see the correct solutions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.questionResults.map((result, index) => {
              const question = quiz.questions.find(q => q.id === result.question_id);
              if (!question) return null;

              return (
                <div key={result.question_id} className={`p-4 rounded-lg border-l-4 ${
                  result.is_correct ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">Question {index + 1}</h4>
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
                  
                  <p className="text-sm mb-3">{question.text}</p>
                  
                  {question.type === 'multiple_choice' && question.options && (
                    <div className="space-y-1 text-sm">
                      {question.options.map((option, optionIndex) => {
                        const isUserSelected = option === result.user_answer;
                        const isCorrectOption = option === result.correct_answer;
                        
                        return (
                          <div key={optionIndex} className={`p-2 rounded ${
                            isCorrectOption 
                              ? 'bg-green-100 text-green-800 border border-green-300' 
                              : isUserSelected 
                                ? 'bg-red-100 text-red-800 border border-red-300'
                                : 'bg-gray-50'
                          }`}>
                            {String.fromCharCode(65 + optionIndex)}) {option}
                            {isCorrectOption && <span className="float-right">✓</span>}
                            {isUserSelected && !isCorrectOption && <span className="float-right">✗</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {question.type === 'open_ended' && (
                    <div className="space-y-2 text-sm">
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
                    </div>
                  )}

                  {question.type === 'cloze' && (
                    <div className="space-y-3 text-sm">
                      <div className="p-3 bg-gray-50 border rounded-lg">
                        <p className="text-gray-800 leading-relaxed">
                          {(question as any).originalText}
                        </p>
                      </div>
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
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Learn
          </Button>
          <Button onClick={resetQuiz}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Retake Quiz
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;
  const hasAnswered = userAnswers[currentQuestion.id];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Quiz Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{quiz.title}</CardTitle>
              <CardDescription>
                Question {currentQuestionIndex + 1} of {quiz.questions.length}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="h-4 w-4 mr-1" />
                {formatTime(timeSpent)}
              </div>
              {onBack && (
                <Button variant="outline" size="sm" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
      </Card>

      {/* Current Question */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {currentQuestion.type === 'cloze' 
              ? (currentQuestion as any).clozeText?.replace(/\{\{c1::(.*?)\}\}/g, '_______________')
              : currentQuestion.text
            }
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
            <RadioGroup 
              value={userAnswers[currentQuestion.id] || ''} 
              onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
            >
              {currentQuestion.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="cursor-pointer flex-1">
                    {String.fromCharCode(65 + index)}) {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {currentQuestion.type === 'open_ended' && (
            <Textarea
              placeholder="Enter your answer here..."
              value={userAnswers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              rows={4}
            />
          )}

                    {currentQuestion.type === 'cloze' && (
            <div>
              <Label htmlFor="cloze-answer" className="text-sm font-medium text-gray-700 mb-2 block">
                Fill in the blank:
              </Label>
              <Input
                id="cloze-answer"
                placeholder="Enter your answer..."
                value={userAnswers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                className="text-lg"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
        >
          Previous
        </Button>
        
        <div className="flex space-x-2">
          {isLastQuestion ? (
            <Button 
              onClick={submitQuiz}
              disabled={isSubmitting || !hasAnswered}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
            </Button>
          ) : (
            <Button 
              onClick={handleNext}
              disabled={!hasAnswered}
            >
              Next
            </Button>
          )}
        </div>
      </div>

      {/* Progress Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between text-sm">
            <span>Answered: {Object.keys(userAnswers).length}/{quiz.questions.length}</span>
            <span>Time: {formatTime(timeSpent)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 