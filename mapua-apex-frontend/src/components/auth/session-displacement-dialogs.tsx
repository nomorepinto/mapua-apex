import { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";
import { useSignOut } from "@/hooks/use-sign-out";

export function SessionDisplacementDialogs() {
  const handleSignOut = useSignOut();
  const [isDisplaced, setIsDisplaced] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);
  const [showNewDeviceToast, setShowNewDeviceToast] = useState(false);

  useEffect(() => {
    const handleDisplaced = () => setIsDisplaced(true);
    const handleRevoked = () => setIsRevoked(true);
    const handleNewDevice = () => {
      setShowNewDeviceToast(true);
      const timer = setTimeout(() => setShowNewDeviceToast(false), 7000);
      return () => clearTimeout(timer);
    };

    window.addEventListener("apex:session_displaced", handleDisplaced);
    window.addEventListener("apex:session_revoked", handleRevoked);
    window.addEventListener("apex:session_displaced_previous", handleNewDevice);

    return () => {
      window.removeEventListener("apex:session_displaced", handleDisplaced);
      window.removeEventListener("apex:session_revoked", handleRevoked);
      window.removeEventListener("apex:session_displaced_previous", handleNewDevice);
    };
  }, []);

  return (
    <>
      {/* Informational Toast on New Device */}
      {showNewDeviceToast && !isDisplaced && !isRevoked && (
        <div className="fixed top-4 right-4 z-50 flex max-w-md items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg text-amber-900 transition-all duration-200 animate-in fade-in slide-in-from-top-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-amber-950">Active Session Transferred</p>
            <p className="mt-0.5 text-xs text-amber-800">
              Signed in on this device. An earlier active session on another device was logged out.
            </p>
          </div>
          <button
            onClick={() => setShowNewDeviceToast(false)}
            className="text-amber-700 hover:text-amber-950 p-1 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Displaced Modal on Old Device */}
      {isDisplaced && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100 text-[#8B0000]">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Signed In on Another Device</h3>
                <p className="text-xs text-neutral-500">One active session policy</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-neutral-600 leading-relaxed">
              You have been logged out because this account was logged into from another device or browser. Only one active session is allowed per account.
            </p>

            <div className="mt-6">
              <button
                onClick={() => handleSignOut({ skipSessionEnd: true })}
                className="w-full rounded-xl bg-[#8B0000] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#6b0000] transition-colors"
              >
                Log In Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoked Modal */}
      {isRevoked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Session Revoked</h3>
                <p className="text-xs text-neutral-500">Security enforcement</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-neutral-600 leading-relaxed">
              An administrator has terminated your active session. Please sign in again to continue.
            </p>

            <div className="mt-6">
              <button
                onClick={() => handleSignOut({ skipSessionEnd: true })}
                className="w-full rounded-xl bg-[#8B0000] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#6b0000] transition-colors"
              >
                Sign In Again
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
