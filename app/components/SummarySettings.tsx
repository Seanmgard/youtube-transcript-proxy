import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Crown } from "lucide-react";
import type { SummarySettings } from "@/lib/types";

interface SummarySettingsProps {
  settings: SummarySettings;
  onSettingsChange: (settings: SummarySettings) => void;
  isPremium: boolean;
  disabled?: boolean;
}

export function SummarySettings({ settings, onSettingsChange, isPremium, disabled }: SummarySettingsProps) {
  return (
    <div className="h-full flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium text-gray-900">Generate Summary</Label>
          <p className="text-xs text-gray-600">
            Create a detailed summary of your document
          </p>
        </div>
        <div className="flex items-center">
          {!isPremium && (
            <div className="flex items-center mr-4 gap-1 text-xs text-amber-600">
              <Crown className="h-3 w-3" />
              <span>Premium Only</span>
            </div>
          )}
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => {
              onSettingsChange({ ...settings, enabled: checked });
            }}
            disabled={disabled || !isPremium}
          />
        </div>
      </div>
    </div>
  );
} 