import { toast } from "react-toastify";
import type { ToastOptions } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ToastHandler = (t: string, type: "success" | "error") => {
  const properties = {
    position: "bottom-center",
    autoClose: 1000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    delay: 0,
    theme: "dark",
  } as ToastOptions;

  if (!t || !type) return console.error("Missing toast properties");
  type === "success" ? toast.success(t, properties) : toast.error(t, properties);
};

export default ToastHandler;