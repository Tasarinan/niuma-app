import { Loader2, TrashIcon } from "lucide-react";
import { Button, Header } from "@/components";
import { UseSettingsReturn } from "@/types";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export const DeleteChats = ({
  handleDeleteAllChatsConfirm,
  showDeleteConfirmDialog,
  setShowDeleteConfirmDialog,
}: UseSettingsReturn) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { t } = useTranslation("pages");

  const deleteAllChats = () => {
    setIsDeleting(true);
    handleDeleteAllChatsConfirm();
    setTimeout(() => {
      setIsDeleting(false);
    }, 2000);
  };

  return (
    <div id="delete-chats" className="space-y-3">
      <Header
        title={t("settingsPage.deleteChats.title")}
        description={t("settingsPage.deleteChats.description")}
        isMainTitle
      />

      <div className="space-y-2">
        {isDeleting && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-xs text-green-700 font-medium">
              {t("settingsPage.deleteChats.success")}
            </p>
          </div>
        )}

        <Button
          onClick={() => setShowDeleteConfirmDialog(true)}
          disabled={isDeleting}
          variant="destructive"
          className="w-full h-11"
          title="Delete all chat history"
        >
          {isDeleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("settingsPage.deleteChats.deleting")}
            </>
          ) : (
            <>
              <TrashIcon className="h-4 w-4 mr-2" />
              {t("settingsPage.deleteChats.deleteAll")}
            </>
          )}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      {showDeleteConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-2">
              {t("settingsPage.deleteChats.dialogTitle")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("settingsPage.deleteChats.dialogDesc")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirmDialog(false)}
              >
                {t("common.actions.cancel", { ns: "common" })}
              </Button>
              <Button variant="destructive" onClick={deleteAllChats}>
                {t("settingsPage.deleteChats.confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
