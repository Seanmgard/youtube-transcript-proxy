'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/app/components/ui/use-toast";
import { sendToAnki } from '@/utils/api-client';

interface AnkiExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  quizId: string;
}

export function AnkiExportDialog({ isOpen, onClose, quizId }: AnkiExportDialogProps) {
  console.log('AnkiExportDialog rendered', { isOpen, quizId });
  
  const [deckName, setDeckName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState(false);
  const { toast } = useToast();

  // Check if we're in a secure context (HTTPS)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSecureContext(window.isSecureContext);
      console.log('Secure context check:', window.isSecureContext);
    }
  }, []);

  // Log when the dialog opens or closes
  useEffect(() => {
    console.log('Dialog state changed:', { isOpen });
  }, [isOpen]);

  const handleExport = async () => {
    console.log('Export button clicked', { deckName, quizId });
    
    if (!deckName.trim()) {
      console.log('No deck name provided');
      toast({
        title: "Error",
        description: "Please enter a deck name",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('Starting export process...');
      setIsExporting(true);
      
      // Send the quiz to Anki
      console.log('Calling sendToAnki with:', { quizId, deckName: deckName.trim() });
      const result = await sendToAnki(quizId, deckName.trim());
      
      console.log('Export successful:', result);
      toast({
        title: "🎉 Anki Export Complete",
        description: `Your quiz has been successfully sent to Anki deck "${deckName.trim()}". Open Anki to start studying!`,
        className: "border-green-200 bg-green-50 text-green-900",
        duration: 5000
      });
      
      onClose();
    } catch (error) {
      console.error('Error exporting to Anki:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isConnectionError = 
        errorMessage.includes('Could not connect to Anki') || 
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError');
      const isMixedContentError = 
        isSecureContext && 
        (errorMessage.includes('mixed content') || errorMessage.includes('blocked by CORS policy'));

      console.log('Error details:', { errorMessage, isConnectionError, isMixedContentError });

      // Provide more detailed error information
      toast({
        title: "Failed to export to Anki",
        description: (
          <div className="space-y-2">
            <p>{errorMessage}</p>
            {isConnectionError && (
              <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
                <li>Anki is running on your computer</li>
                <li>The Anki-Connect plugin is installed</li>
                <li>You've configured Anki-Connect to allow connections from quizlabai.com</li>
                <li>You're using a desktop browser (not mobile)</li>
              </ul>
            )}
            {isMixedContentError && (
              <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Mixed Content Issue</p>
                    <p className="text-sm text-yellow-700">
                      Your browser is blocking the connection to Anki because you're accessing QuizLab AI 
                      over HTTPS and Anki-Connect uses HTTP.
                    </p>
                    <p className="text-sm mt-1 text-yellow-700">
                      Look for a shield icon in your browser's address bar and click it to allow mixed content.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <p className="mt-2">
              <a href="/dashboard/anki-setup" className="underline font-medium">
                View detailed setup instructions
              </a>
            </p>
          </div>
        ),
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsExporting(false);
      console.log('Export process completed');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      console.log('Dialog onOpenChange triggered', { open, isExporting });
      if (!isExporting && !open) {
        onClose();
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export to Anki</DialogTitle>
          <DialogDescription>
            Enter a deck name to export your quiz cards to Anki.
            Make sure Anki is running on your computer.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="deckName">Deck Name</Label>
            <Input
              id="deckName"
              placeholder="Enter deck name..."
              value={deckName}
              onChange={(e) => {
                console.log('Deck name changed:', e.target.value);
                setDeckName(e.target.value);
              }}
              disabled={isExporting}
            />
          </div>
          
          {isSecureContext && (
            <div className="text-sm p-3 bg-yellow-50 rounded border border-yellow-200">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Important Note</p>
                  <p className="text-yellow-700">
                    You're accessing this site via HTTPS. If you see a connection error, you may need to allow mixed content
                    in your browser to connect to Anki.
                  </p>
                  <p className="mt-1 text-yellow-700">
                    Look for a shield icon in your browser's address bar.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="text-sm text-gray-500">
            <p>Before exporting, please ensure:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Anki is running on your computer</li>
              <li>You've installed the Anki-Connect plugin</li>
              <li>You've configured Anki-Connect to allow connections from quizlabai.com</li>
            </ul>
            <p className="mt-2">
              <a href="/dashboard/anki-setup" className="text-blue-600 hover:underline" target="_blank">
                View setup instructions
              </a>
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              console.log('Cancel button clicked');
              onClose();
            }}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              console.log('Export button clicked directly');
              handleExport();
            }}
            disabled={isExporting || !deckName.trim()}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              'Export to Anki'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 