import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/contexts";
import { cleanupUserFromParticipants } from "@/lib/database";

interface UserIdentitySettingsProps {
  onSettingsChange?: () => void;
}

export const UserIdentitySettings = ({ onSettingsChange }: UserIdentitySettingsProps) => {
  const { userIdentity, setUserIdentity } = useApp();
  const [name, setName] = useState(userIdentity?.name || "");
  const [role, setRole] = useState(userIdentity?.role || "");
  const isFirstSaveRef = useRef(!userIdentity?.name);

  // Save on blur to avoid fighting with user input
  const saveIdentity = async (newName: string, newRole: string) => {
    const trimmedName = newName.trim();
    const trimmedRole = newRole.trim();

    if (trimmedName && trimmedRole) {
      await setUserIdentity({ name: trimmedName, role: trimmedRole });

      // If this is the first time setting identity, run retroactive cleanup
      if (isFirstSaveRef.current) {
        isFirstSaveRef.current = false;
        try {
          await cleanupUserFromParticipants(trimmedName);
        } catch (error) {
          console.error("Failed to cleanup user from participants:", error);
        }
      }

      onSettingsChange?.();
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRole(e.target.value);
  };

  const handleBlur = () => {
    saveIdentity(name, role);
  };

  return (
    <Card className="shadow-none border border-border/70 rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">User Identity</CardTitle>
        <CardDescription>
          Help AI recognize you in conversations and filter you from participant lists
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Name Input */}
        <div className="space-y-2">
          <Label htmlFor="user-name">Your Name</Label>
          <Input
            id="user-name"
            placeholder="e.g., Kevin"
            value={name}
            onChange={handleNameChange}
            onBlur={handleBlur}
          />
          <p className="text-xs text-muted-foreground">
            The name others call you in meetings
          </p>
        </div>

        {/* Role Input */}
        <div className="space-y-2">
          <Label htmlFor="user-role">Your Role</Label>
          <Input
            id="user-role"
            placeholder="e.g., Software Engineer"
            value={role}
            onChange={handleRoleChange}
            onBlur={handleBlur}
          />
          <p className="text-xs text-muted-foreground">
            Your professional role or title
          </p>
        </div>

        {/* Status indicator - always reserve space to prevent layout shift */}
        <p className={`text-xs min-h-4 ${name.trim() && role.trim() ? "text-green-600 dark:text-green-400" : "text-transparent"}`}>
          {name.trim() && role.trim()
            ? `AI will recognize "${name.trim()}" as you and exclude from participant lists`
            : "\u00A0"}
        </p>
      </CardContent>
    </Card>
  );
};
