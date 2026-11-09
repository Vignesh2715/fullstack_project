// Starts the app. On Vercel the exported app is run by Vercel itself.
import app from "./app.js";

const port = process.env.PORT || 4000;

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
  });
}

export default app;
