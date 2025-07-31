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

      <div className="max-w-4xl mx-auto">
        <div className="p-6 bg-white rounded-lg shadow-md space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-4 text-gray-900">Anki Integration Setup</h1>
            <p className="text-gray-700">
              Follow these steps to set up the integration between QuizLab AI and Anki for seamless quiz export.
            </p>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Setup Instructions</h2>
            <p className="text-gray-700 mb-4">
              To export quizzes directly to Anki, you need to install and configure the Anki-Connect plugin.
            </p>

            <ol className="list-decimal pl-6 space-y-4 text-gray-700">
              <li>
                <strong className="text-gray-900">Install Anki-Connect Plugin:</strong>
                <ul className="list-disc pl-6 mt-2 space-y-2">
                  <li>
                    Download and install Anki from{' '}
                    <a 
                      href="https://apps.ankiweb.net/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      https://apps.ankiweb.net/
                    </a>
                  </li>
                  <li className="text-gray-700">Open Anki on your computer</li>
                  <li className="text-gray-700">Select <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">Tools</code> → <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">Add-ons</code> → <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">Get Add-ons...</code></li>
                  <li className="text-gray-700">Enter the code: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">2055492159</code></li>
                  <li className="text-gray-700">Click <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">OK</code></li>
                  <li className="text-gray-700">Restart Anki</li>
                </ul>
              </li>
              
              <li>
                <strong className="text-gray-900">Configure Anki-Connect:</strong>
                <ul className="list-disc pl-6 mt-2 space-y-2">
                  <li className="text-gray-700">In Anki, go to <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">Tools</code> → <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">Add-ons</code></li>
                  <li className="text-gray-700">Select <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">AnkiConnect</code> and click <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">Config</code></li>
                  <li className="text-gray-700">Replace the entire configuration with the following:</li>
                  <li>
                    <pre className="bg-gray-100 p-3 rounded-md overflow-x-auto text-sm mt-2 text-gray-800">
{`{
    "apiKey": null,
    "apiLogPath": null,
    "ignoreOriginList": [],
    "webBindAddress": "127.0.0.1",
    "webBindPort": 8765,
    "webCorsOriginList": [
        "http://localhost",
        "http://localhost:3000",
        "https://quizlabai.com",
        "https://www.quizlabai.com"
    ]
}`}
                    </pre>
                  </li>
                  <li className="text-gray-700">Click <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">Save</code></li>
                  <li className="text-gray-700">Restart Anki completely</li>
                </ul>
              </li>
              
              <li>
                <strong className="text-gray-900">Keep Anki Running:</strong> <span className="text-gray-700">Anki must be running in the background for the integration to work. When you click "Export to Anki" in QuizLab AI, your quiz will be sent directly to your Anki collection.</span>
              </li>
            </ol>
          </div>

          <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
            <h3 className="text-lg font-semibold mb-2 text-yellow-800">Important Notes</h3>
            <ul className="list-disc pl-6 space-y-2 text-yellow-700">
              <li>
                The "Export to Anki" feature <strong>only works on desktop browsers</strong>, not on mobile devices.
              </li>
              <li>
                You must have Anki running on the <strong>same computer</strong> as the browser you're using to access QuizLab AI.
              </li>
              <li>
                If you're using a secure connection (HTTPS) to access QuizLab AI, you may need to allow insecure content in your browser settings.
              </li>
            </ul>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Troubleshooting</h2>
            <ul className="list-disc pl-6 space-y-3 text-gray-700">
              <li>
                <strong className="text-gray-900">Connection Failed:</strong> Make sure Anki is running and Anki-Connect is properly installed. Verify that you've configured Anki-Connect with the correct settings as shown above.
              </li>
              <li>
                <strong className="text-gray-900">Firewall Issues:</strong> If you're using Windows, you might see a firewall nag dialog when Anki starts. This occurs because Anki-Connect runs a local HTTP server. You need to allow Anki through your firewall.
              </li>
              <li>
                <strong className="text-gray-900">Mac OS X Users:</strong> If you're using Mac OS X Mavericks or later, you might need to disable App Nap for Anki to ensure Anki-Connect works properly when Anki is in the background. Run these commands in Terminal:
                <pre className="bg-gray-100 p-2 rounded-md overflow-x-auto text-sm mt-2 text-gray-800">
{`defaults write net.ankiweb.dtop NSAppSleepDisabled -bool true
defaults write net.ichi2.anki NSAppSleepDisabled -bool true
defaults write org.qt-project.Qt.QtWebEngineCore NSAppSleepDisabled -bool true`}
                </pre>
              </li>
              <li>
                <strong className="text-gray-900">Browser Security:</strong> Modern browsers restrict mixed content (HTTP requests from HTTPS pages). If you're accessing QuizLab AI via HTTPS, your browser might block the HTTP connection to Anki-Connect. Look for a shield icon in your browser's address bar to allow mixed content.
              </li>
            </ul>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Testing the Connection</h2>
            <p className="text-gray-700">
              Once you've completed the setup, you can test the connection by:
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-gray-700 mt-2">
              <li>Make sure Anki is running</li>
              <li>Go to your quiz history in QuizLab AI</li>
              <li>Click on any quiz and select "Export to Anki"</li>
              <li>If the connection works, your quiz will appear in Anki</li>
            </ol>
            <p className="text-gray-700 mt-4">
              If you encounter any issues, please refer to the troubleshooting section above or contact our support team.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 