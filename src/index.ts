import { Hono } from "hono";
import { cors } from "hono/cors";
import manifest from "./routes/manifest";
import catalog from "./routes/catalog";

const app = new Hono();

app.use(
  cors({
    origin: "*",
    allowMethods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

app.onError((err, c) => {
  console.error(`${err}`);
  return c.text("Something went wrong, check logs", 500);
});

app.route("/", manifest);
app.route("/catalog", catalog);

export default app;
