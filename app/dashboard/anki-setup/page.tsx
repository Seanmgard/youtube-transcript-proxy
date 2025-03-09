'use client'

import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function AnkiSetupPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/dashboard">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Anki Integration Setup</h1>
      </div>

      <div className="p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">What is Anki?</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Anki is a powerful, intelligent flashcard program that makes remembering things easy. 
            It uses spaced repetition to optimize your learning and retention.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Setting Up Anki-Connect</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            To send quizzes directly from QuizLab AI to Anki, you need to install the Anki-Connect plugin. 
            Follow these steps:
          </p>
          
          <ol className="list-decimal pl-6 space-y-4 text-gray-600 dark:text-gray-300">
            <li>
              <strong>Install Anki:</strong> If you haven't already, download and install Anki from{' '}
              <a 
                href="https://apps.ankiweb.net/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                https://apps.ankiweb.net/
              </a>
            </li>
            
            <li>
              <strong>Install Anki-Connect:</strong>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>Open Anki</li>
                <li>Select <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">Tools</code> → <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">Add-ons</code> → <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">Get Add-ons...</code></li>
                <li>Enter the code: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">2055492159</code></li>
                <li>Click <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">OK</code></li>
                <li>Restart Anki when prompted</li>
              </ul>
            </li>
            
            <li>
              <strong>Keep Anki Running:</strong> Anki must be running in the background for the integration to work. When you click "Send to Anki" in QuizLab AI, your quiz will be sent directly to your Anki collection.
            </li>
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Troubleshooting</h2>
          <ul className="list-disc pl-6 space-y-3 text-gray-600 dark:text-gray-300">
            <li>
              <strong>Connection Failed:</strong> Make sure Anki is running and Anki-Connect is properly installed.
            </li>
            <li>
              <strong>Firewall Issues:</strong> If you're using Windows, you might see a firewall nag dialog when Anki starts. This occurs because Anki-Connect runs a local HTTP server. You need to allow Anki through your firewall.
            </li>
            <li>
              <strong>Mac OS X Users:</strong> If you're using Mac OS X Mavericks or later, you might need to disable App Nap for Anki to ensure Anki-Connect works properly when Anki is in the background.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Using the Integration</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Once set up, you can send quizzes directly to Anki by:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-gray-600 dark:text-gray-300 mt-2">
            <li>Navigate to your Quiz History</li>
            <li>Click the "Send to Anki" button for any quiz</li>
            <li>Enter a deck name (existing or new)</li>
            <li>Click "Send to Anki"</li>
          </ol>
          <p className="text-gray-600 dark:text-gray-300 mt-4">
            Your quiz questions will be added as flashcards to the specified deck in Anki.
          </p>
        </div>
      </div>
    </div>
  )
} 