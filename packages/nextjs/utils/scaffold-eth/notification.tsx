import React from "react";
import { Toast, ToastPosition, toast } from "react-hot-toast";
import {
  PiCheckCircleBold,
  PiInfoBold,
  PiSpinnerGapBold,
  PiWarningCircleBold,
  PiXBold,
  PiXCircleBold,
} from "react-icons/pi";

type NotificationProps = {
  content: React.ReactNode;
  status: "success" | "info" | "loading" | "error" | "warning";
  duration?: number;
  icon?: string;
  position?: ToastPosition;
};

type NotificationOptions = {
  duration?: number;
  icon?: string;
  position?: ToastPosition;
};

const ENUM_STATUSES = {
  success: (
    <span className="text-success">
      <PiCheckCircleBold size={20} />
    </span>
  ),
  loading: (
    <span className="text-base-content/70 animate-spin inline-flex">
      <PiSpinnerGapBold size={20} />
    </span>
  ),
  error: (
    <span className="text-error">
      <PiXCircleBold size={20} />
    </span>
  ),
  info: (
    <span className="text-info">
      <PiInfoBold size={20} />
    </span>
  ),
  warning: (
    <span className="text-warning">
      <PiWarningCircleBold size={20} />
    </span>
  ),
};

const DEFAULT_DURATION = 3000;
const DEFAULT_POSITION: ToastPosition = "top-center";

/**
 * Custom Notification
 */
const Notification = ({
  content,
  status,
  duration = DEFAULT_DURATION,
  icon,
  position = DEFAULT_POSITION,
}: NotificationProps) => {
  return toast.custom(
    (t: Toast) => (
      <div
        className={`flex flex-row items-start justify-between max-w-sm rounded-box border border-base-300 bg-base-100 shadow-lg shadow-black/10 dark:shadow-black/40 p-4 transform-gpu relative transition-all duration-500 ease-in-out space-x-2
        ${
          position.substring(0, 3) == "top"
            ? `hover:translate-y-1 ${t.visible ? "top-0" : "-top-96"}`
            : `hover:-translate-y-1 ${t.visible ? "bottom-0" : "-bottom-96"}`
        }`}
      >
        <div className="shrink-0 self-center">{icon ? icon : ENUM_STATUSES[status]}</div>
        <div
          className={`overflow-x-hidden break-words whitespace-pre-line text-sm font-medium leading-snug text-base-content ${icon ? "mt-1" : ""}`}
        >
          {content}
        </div>

        <button
          className={`shrink-0 text-base-content/50 hover:text-base-content transition-colors cursor-pointer ${icon ? "mt-1" : ""}`}
          onClick={() => toast.dismiss(t.id)}
        >
          <PiXBold size={16} />
        </button>
      </div>
    ),
    {
      duration: status === "loading" ? Infinity : duration,
      position,
    },
  );
};

export const notification = {
  success: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "success", ...options });
  },
  info: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "info", ...options });
  },
  warning: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "warning", ...options });
  },
  error: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "error", ...options });
  },
  loading: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "loading", ...options });
  },
  remove: (toastId: string) => {
    toast.remove(toastId);
  },
};
