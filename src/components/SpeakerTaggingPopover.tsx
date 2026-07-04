import { useState } from "react";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Input,
} from "@/components";
import { UserIcon, UsersIcon, PlusIcon } from "lucide-react";

interface SpeakerTaggingPopoverProps {
  speakerId: string;
  onAssign: (speakerId: string, label: string, profileId?: string) => void;
  enrolledProfiles?: Array<{ id: string; name: string; type: string }>;
  children: React.ReactNode;
}

export function SpeakerTaggingPopover({
  speakerId,
  onAssign,
  enrolledProfiles = [],
  children,
}: SpeakerTaggingPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showNewPersonInput, setShowNewPersonInput] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");

  const handleAssign = (label: string, profileId?: string) => {
    onAssign(speakerId, label, profileId);
    setIsOpen(false);
    setShowNewPersonInput(false);
    setNewPersonName("");
  };

  const handleAddNewPerson = () => {
    if (newPersonName.trim()) {
      handleAssign(newPersonName.trim());
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-2 px-1">Who is this?</p>

          {/* Quick "That's me" button */}
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start h-8 text-xs"
            onClick={() => handleAssign("You", "user")}
          >
            <UserIcon className="h-3 w-3 mr-2" />
            That's me
          </Button>

          {/* Enrolled profiles */}
          {enrolledProfiles.length > 0 && (
            <>
              <div className="h-px bg-border my-1" />
              {enrolledProfiles.map((profile) => (
                <Button
                  key={profile.id}
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start h-8 text-xs"
                  onClick={() => handleAssign(profile.name, profile.id)}
                >
                  <UsersIcon className="h-3 w-3 mr-2" />
                  {profile.name}
                  {profile.type && (
                    <span className="ml-1 text-muted-foreground text-[10px]">
                      ({profile.type})
                    </span>
                  )}
                </Button>
              ))}
            </>
          )}

          <div className="h-px bg-border my-1" />

          {/* Add new person */}
          {showNewPersonInput ? (
            <div className="flex gap-1">
              <Input
                type="text"
                placeholder="Name"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddNewPerson();
                  } else if (e.key === "Escape") {
                    setShowNewPersonInput(false);
                    setNewPersonName("");
                  }
                }}
                className="h-7 text-xs"
                autoFocus
              />
              <Button
                size="sm"
                variant="default"
                className="h-7 px-2"
                onClick={handleAddNewPerson}
                disabled={!newPersonName.trim()}
              >
                <PlusIcon className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start h-8 text-xs text-muted-foreground"
              onClick={() => setShowNewPersonInput(true)}
            >
              <PlusIcon className="h-3 w-3 mr-2" />
              Add new person
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
