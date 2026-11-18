"use client";

import { useEffect } from "react";

/**
 * Makes the browser's Back button leave this page for `homeHref`.
 *
 * The certificate verification page is normally opened straight from a printed
 * code, a PDF, or an email, so there is no page of ours behind it in history —
 * Back then does nothing at all, or returns to the sender's website. On mount
 * this pushes a same-URL entry so Back always has somewhere to travel to, then
 * takes over the resulting popstate and navigates to the session-appropriate
 * home: the landing page when signed out, the role's dashboard when signed in.
 *
 * stopImmediatePropagation keeps the app router from also handling the event —
 * it would treat the trip as a soft navigation back to this same page instead
 * of the hard navigation home we want. The pushed entry stays in history, so
 * Forward after Back returns to the verification result.
 */
export function VerificationBackRedirect({ homeHref }: { homeHref: string }) {
  useEffect(() => {
    // Same-URL entry: gives Back something to travel to even when this page is
    // the only entry in the tab's history.
    window.history.pushState(window.history.state, "", window.location.href);

    function onPopState(event: PopStateEvent) {
      event.stopImmediatePropagation();
      window.location.replace(homeHref);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [homeHref]);

  return null;
}
