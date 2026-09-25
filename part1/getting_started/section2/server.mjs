import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamText } from "hono/streaming";
import { serve } from "@hono/node-server";
import { Ollama } from "ollama";

const app = new Hono();

app.use(cors());

const ollama = new Ollama();

app.post('/', async (c) => {
  const body = await c.req.json();

  const streamIterator = await ollama.generate({
    model: 'llama3.2',
    prompt: body.question,
    stream: true
  });

  return streamText(c, async (stream) => {
    for await (const chunk of streamIterator) {
      await stream.write(chunk.response);
    }
  });
});

serve({ fetch: app.fetch, port: 8000 }, (info) => {
  console.log(`Server is running on port ${info.port}`);
});
