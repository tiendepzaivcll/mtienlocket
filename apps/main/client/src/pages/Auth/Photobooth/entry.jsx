import { Navigate } from "react-router-dom";

// Keep previously shared links opening the camera's inline Photobooth mode.
export default function PhotoboothEntry() {
  return <Navigate to="/locket-beta?camera=photobooth" replace />;
}
