// Runs the in-browser model off the main thread so the UI stays smooth.
import { WebWorkerMLCEngineHandler } from "./vendor/web-llm.js";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);
