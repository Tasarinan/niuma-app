import { Loader2, TrashIcon } from "lucide-react";
import { Button, Header } from "@/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteAllConversations } from "@/lib/database/chat-history.action";

export const DeleteChats = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [done, setDone] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { t } = useTranslation("pages");

  const deleteAllChats = async () => {
    setIsDeleting(true);
    setShowConfirm(false);
    try {
      await deleteAllConversations();
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (error) {
      console.error("Failed to delete all conversations:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id="delete-chats" className="space-y-3">
      <Header
        title={t("settingsPage.deleteChats.title")}
        description={t("settingsPage.deleteChats.description")}
        isMainTitle
      />

      <div className="space-y-2">
      {done && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-xs text-green-700 font-medium">
              {t("settingsPage.deleteChats.success")}
            </p>
          </div>
        )}

        {showConfirm ? (
          <div className="flex gap-2">
            <Button
              onClick={() => void deleteAllChats()}
              disabled={isDeleting}
              variant="destructive"
              className="flex-1 h-11"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("settingsPage.deleteChats.deleteAll")}
            </Button>
            <Button onClick={() => setShowConfirm(false)} variant="outline" className="flex-1 h-11">
              取消
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={isDeleting}
            variant="destructive"
            className="w-full h-11"
          >
            <TrashIcon className="h-4 w-4 mr-2" />
            {t("settingsPage.deleteChats.deleteAll")}
          </Button>
        )}
      </div>
    </div>
  );
};
