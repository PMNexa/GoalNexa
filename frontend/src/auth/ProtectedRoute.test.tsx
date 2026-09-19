import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";

describe("ProtectedRoute", () => {
  const originalLocation = window.location;

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("redirects to /login when there is no access token", async () => {
    // The boot-time refresh call fails (no session), so the app should
    // settle on "not logged in" and redirect away from the protected route.
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ code: "unauthorized", message: "no session", field_errors: null }), {
            status: 401,
          }),
        ),
      ),
    );
    // jsdom's window.location.assign isn't configurable enough for
    // vi.spyOn; replace the whole object so the refresh-failure path (which
    // calls window.location.assign) is a harmless no-op in this test.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign: vi.fn() },
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Secret content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });
});
