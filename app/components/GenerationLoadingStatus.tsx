'use client';

import { Loader2, FileText, Brain, CheckCircle, Clock } from 'lucide-react';

interface GenerationLoadingStatusProps {
  isGenerating: boolean;
  isUploading: boolean;
  uploadProgress: number;
  quizCompleted: boolean;
  summaryCompleted: boolean;
  summaryEnabled: boolean;
  currentStep: string;
}

export default function GenerationLoadingStatus({
  isGenerating,
  isUploading,
  uploadProgress,
  quizCompleted,
  summaryCompleted,
  summaryEnabled,
  currentStep
}: GenerationLoadingStatusProps) {
  if (!isGenerating) return null;

  const bothEnabled = summaryEnabled;
  const bothCompleted = quizCompleted && (summaryCompleted || !summaryEnabled);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {bothCompleted ? 'Generation Complete!' : 'Generating Content...'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {bothCompleted 
              ? 'Your content is ready!' 
              : 'Please wait while we process your document'
            }
          </p>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Uploading file...</span>
              <span className="text-sm text-gray-500">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Generation Status */}
        <div className="space-y-3">
          {/* Quiz Status */}
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              quizCompleted 
                ? 'bg-green-100 text-green-600' 
                : 'bg-blue-100 text-blue-600'
            }`}>
              {quizCompleted ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <Brain className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Quiz Generation</div>
              <div className="text-xs text-gray-500">
                {quizCompleted ? 'Completed' : 'Processing questions...'}
              </div>
            </div>
            {!quizCompleted && (
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
            )}
          </div>

          {/* Summary Status */}
          {bothEnabled && (
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                summaryCompleted 
                  ? 'bg-green-100 text-green-600' 
                  : quizCompleted 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'bg-gray-100 text-gray-400'
              }`}>
                {summaryCompleted ? (
                  <CheckCircle className="h-5 w-5" />
                ) : quizCompleted ? (
                  <FileText className="h-5 w-5" />
                ) : (
                  <Clock className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Study Guide Generation</div>
                <div className="text-xs text-gray-500">
                  {summaryCompleted 
                    ? 'Completed' 
                    : quizCompleted 
                      ? 'Creating comprehensive study guide...' 
                      : 'Waiting for quiz completion...'
                  }
                </div>
              </div>
              {!summaryCompleted && quizCompleted && (
                <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              )}
            </div>
          )}
        </div>

        {/* Current Step */}
        {currentStep && !bothCompleted && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-xs font-medium text-blue-800 mb-1">Current Step:</div>
            <div className="text-sm text-blue-700">{currentStep}</div>
          </div>
        )}

        {/* Completion Message */}
        {bothCompleted && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg text-center">
            <div className="text-sm font-medium text-green-800">
              All content generated successfully!
            </div>
            <div className="text-xs text-green-600 mt-1">
              You can now view your {bothEnabled ? 'quiz and study guide' : 'quiz'} below.
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 