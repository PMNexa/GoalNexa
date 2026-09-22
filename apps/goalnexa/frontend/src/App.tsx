import { useState } from "react";
import GoalsScreen from "./screens/GoalsScreen";

/**
 * Standalone dev entry only - this package has no login flow of its own
 * (GoalsScreen takes an accessToken prop; see its own docstring), so this
 * just lets you paste one in manually to exercise the screen in
 * isolation. apps/main is the real host, and gets the token from
 * platform-auth-frontend's LoginScreen/SignupScreen instead.
 */
function App() {
  const [accessToken, setAccessToken] = useState("");
  const [submitted, setSubmitted] = useState("");

  if (submitted) return <GoalsScreen accessToken={submitted} />;

  return (
    <div style={{ maxWidth: 640, margin: "48px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 20 }}>goalnexa (standalone dev)</h1>
      <p>Paste an access token issued by a compatible auth service (same JWT_SECRET) to exercise GoalsScreen.</p>
      <div style={{ display: "flex", gap: 8, maxWidth: 480 }}>
        <input
          type="text"
          placeholder="access token"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="button" onClick={() => setSubmitted(accessToken)}>
          Use token
        </button>
      </div>
    </div>
  );
}

export default App;
