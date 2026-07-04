import { useState, useEffect, useCallback } from "react";
import { DEFAULT_QUICK_ACTIONS, STORAGE_KEYS } from "@/config";

export interface UseQuickActionsReturn {
  actions: string[];
  isManaging: boolean;
  setIsManaging: (value: boolean) => void;
  show: boolean;
  setShow: (value: boolean) => void;
  addAction: (action: string) => void;
  removeAction: (action: string) => void;
  resetActions: () => void;
}

export const useQuickActions = (): UseQuickActionsReturn => {
  const [actions, setActions] = useState<string[]>(DEFAULT_QUICK_ACTIONS);
  const [isManaging, setIsManaging] = useState(false);
  const [show, setShow] = useState(false); // Default collapsed to fit 54px window

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedActions = localStorage.getItem(
        STORAGE_KEYS.COMPLETION_QUICK_ACTIONS
      );
      if (savedActions) {
        const parsed = JSON.parse(savedActions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActions(parsed);
        }
      }

      const savedVisibility = localStorage.getItem(
        STORAGE_KEYS.COMPLETION_QUICK_ACTIONS_VISIBLE
      );
      if (savedVisibility !== null) {
        setShow(savedVisibility === "true");
      }
    } catch (error) {
      console.error("Failed to load quick actions from localStorage:", error);
    }
  }, []);

  // Save actions to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.COMPLETION_QUICK_ACTIONS,
        JSON.stringify(actions)
      );
    } catch (error) {
      console.error("Failed to save quick actions to localStorage:", error);
    }
  }, [actions]);

  // Save visibility to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.COMPLETION_QUICK_ACTIONS_VISIBLE,
        String(show)
      );
    } catch (error) {
      console.error("Failed to save quick actions visibility:", error);
    }
  }, [show]);

  const addAction = useCallback((action: string) => {
    if (!action.trim()) return;
    setActions((prev) => {
      if (prev.includes(action.trim())) return prev;
      return [...prev, action.trim()];
    });
  }, []);

  const removeAction = useCallback((action: string) => {
    setActions((prev) => prev.filter((a) => a !== action));
  }, []);

  const resetActions = useCallback(() => {
    setActions(DEFAULT_QUICK_ACTIONS);
  }, []);

  return {
    actions,
    isManaging,
    setIsManaging,
    show,
    setShow,
    addAction,
    removeAction,
    resetActions,
  };
};
