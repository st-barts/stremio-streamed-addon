import { Hono } from "hono";
import { cors } from "hono/cors";
import manifest from "./routes/manifest";

const app = new Hono();

app.use(
  cors({
    origin: "*",
    allowMethods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

app.route("/", manifest);

export default app;
