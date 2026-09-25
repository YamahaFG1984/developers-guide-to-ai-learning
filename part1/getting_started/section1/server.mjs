import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { Ollama } from "ollama";

const app = new Hono();

const ollama = new Ollama();

app.get('/', async (c) => {
  const modelResponse = await ollama.generate({
    model: 'llama3.2',
    prompt: "Can you simply say 'test'?"
  });

  console.log("\nAIMessage object response:\n")
  console.log(modelResponse);

  return c.text(modelResponse.response);
});

serve({ fetch: app.fetch, port: 8000 }, (info) => {
  console.log(`Server is running on port ${info.port}`);
});
